import { createHash } from "crypto"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { SCOPE_LIMITS, type PlanTier } from "@/lib/plan-limits"

async function resolveUserPlan(req: Request): Promise<{ tier: PlanTier; key: string }> {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""

  if (!token) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"
    return { tier: "anonymous", key: `anon:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}` }
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid

    // Race Firestore plan read against 500ms — falls back to free if slow
    const snap = await Promise.race([
      adminDb.collection("users").doc(uid).get(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
    ])

    const rawPlan = snap ? ((snap.data()?.planId as string | undefined) ?? "free") : "free"
    const tier: PlanTier =
      /team|business|elite/i.test(rawPlan) ? "team" :
      /pro/i.test(rawPlan) ? "pro" :
      "free"

    return { tier, key: `uid:${uid}` }
  } catch {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"
    return { tier: "anonymous", key: `anon:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}` }
  }
}

export async function checkRateLimit(req: Request, scope: string): Promise<Response | null> {
  const limits = SCOPE_LIMITS[scope] ?? SCOPE_LIMITS.default
  const { tier, key } = await resolveUserPlan(req)
  const { limit, windowMs } = limits[tier]

  try {
    await assertRateLimit({ scope: `plan:${scope}`, key, limit, windowMs })
    return null
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: "Too many requests. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
            "X-RateLimit-Plan": tier,
          },
        },
      )
    }
    throw error
  }
}
