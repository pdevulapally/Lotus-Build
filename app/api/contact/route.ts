import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"
import { checkRateLimit } from "@/lib/rate-limit-plan"
import { CONTACT_FIELD_LIMITS, contactFormSchema } from "@/lib/contact-schema"
import {
  countLinks,
  issueContactToken,
  sanitizeText,
  scanForThreats,
  verifyContactToken,
} from "@/lib/contact-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Messages with this many links or more are stored for review instead of the
// regular support queue — link stuffing is the most common contact-form spam.
const SPAM_LINK_THRESHOLD = 4

function clientIpHash(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  return createHash("sha256").update(ip).digest("hex").slice(0, 16)
}

/**
 * Issues the proof-of-interaction token the contact form must present when it
 * submits. The form fetches this on mount; the token's minimum age check means
 * a bot that grabs it and posts immediately is rejected.
 */
export async function GET(req: Request) {
  const blocked = await checkRateLimit(req, "contact-token")
  if (blocked) return blocked
  return NextResponse.json(
    { token: issueContactToken() },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(req: Request) {
  const blocked = await checkRateLimit(req, "contact")
  if (blocked) return blocked

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    // Honeypot: a hidden field humans never see. Bots that fill it get a fake
    // success so they don't learn they were detected.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ ok: true })
    }

    const verdict = verifyContactToken(typeof body.token === "string" ? body.token : "")
    if (verdict !== "valid") {
      return NextResponse.json(
        { error: "Your session expired. Please try sending again.", code: `token_${verdict}` },
        { status: 400 }
      )
    }

    const parsed = contactFormSchema.safeParse(body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "")
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
      }
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      )
    }

    const clean = {
      name: sanitizeText(parsed.data.name, CONTACT_FIELD_LIMITS.name.max),
      email: sanitizeText(parsed.data.email, CONTACT_FIELD_LIMITS.email.max).toLowerCase(),
      topic: parsed.data.topic,
      message: sanitizeText(parsed.data.message, CONTACT_FIELD_LIMITS.message.max, true),
    }

    // Re-validate after sanitization so input that was only control characters
    // or padding can't slip under the minimum lengths.
    const revalidated = contactFormSchema.safeParse(clean)
    if (!revalidated.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields." },
        { status: 400 }
      )
    }

    const threats = scanForThreats(clean)
    if (threats.length > 0) {
      return NextResponse.json(
        { error: "Your message contains content we can't accept. Remove any code or markup and try again." },
        { status: 400 }
      )
    }

    const linkCount = countLinks(clean.message)

    await adminDb.collection("contactMessages").add({
      ...revalidated.data,
      status: linkCount >= SPAM_LINK_THRESHOLD ? "flagged" : "new",
      linkCount,
      ipHash: clientIpHash(req),
      userAgent: sanitizeText(req.headers.get("user-agent") ?? "", 256),
      source: "help-page",
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[contact] Failed to save message:", err)
    return NextResponse.json(
      { error: "Something went wrong sending your message. Please try again." },
      { status: 500 }
    )
  }
}
