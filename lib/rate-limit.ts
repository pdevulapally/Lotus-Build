import crypto from "crypto"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { adminDb } from "@/lib/firebase-admin"

export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super("Too many requests")
    this.name = "RateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type RateLimitOptions = {
  scope: string
  key: string
  limit: number
  windowMs: number
}

export async function assertRateLimit(options: RateLimitOptions) {
  const now = Date.now()
  const id = crypto
    .createHash("sha256")
    .update(`${options.scope}:${options.key}`)
    .digest("hex")
  const ref = adminDb.collection("rateLimits").doc(id)

  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref)
    const data = snap.exists ? snap.data() : null
    const windowStart = data?.windowStart instanceof Timestamp
      ? data.windowStart.toMillis()
      : typeof data?.windowStartMs === "number"
        ? data.windowStartMs
        : 0
    const count = typeof data?.count === "number" ? data.count : 0
    const windowExpired = !windowStart || now - windowStart >= options.windowMs

    if (windowExpired) {
      transaction.set(ref, {
        scope: options.scope,
        count: 1,
        windowStart: Timestamp.fromMillis(now),
        windowStartMs: now,
        updatedAt: FieldValue.serverTimestamp(),
      })
      return
    }

    if (count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((options.windowMs - (now - windowStart)) / 1000))
      throw new RateLimitError(retryAfterSeconds)
    }

    transaction.set(ref, {
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  })
}

export function rateLimitResponse(error: RateLimitError): Response {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(error.retryAfterSeconds) },
    }
  )
}
