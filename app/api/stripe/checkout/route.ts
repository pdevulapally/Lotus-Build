import { NextRequest } from "next/server"
import Stripe from "stripe"
import { adminAuth } from "@/lib/firebase-admin"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"
import { getAppBaseUrl, getSameOriginUrl } from "@/lib/security/url"

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  return secretKey ? new Stripe(secretKey) : null
}

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  if (!stripe) {
    return Response.json({ error: "Stripe is not configured" }, { status: 500 })
  }

  let uid: string
  const authHeader = req.headers.get("authorization")
  let body: { idToken?: string; priceId?: string; successUrl?: string; cancelUrl?: string; quantity?: number } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const idToken = authHeader?.replace(/Bearer\s+/i, "")?.trim() || body.idToken
  if (!idToken) {
    return Response.json({ error: "Missing idToken" }, { status: 401 })
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return Response.json({ error: "Invalid idToken" }, { status: 401 })
  }

  try {
    await assertRateLimit({
      scope: "stripe-checkout",
      key: uid,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    throw error
  }

  const priceId = typeof body.priceId === "string" && /^price_[A-Za-z0-9]+$/.test(body.priceId) ? body.priceId : null
  const quantity =
    typeof body.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0
      ? Math.floor(body.quantity)
      : 1

  if (!priceId) {
    return Response.json({ error: "Missing priceId (get it from /api/stripe/plans)" }, { status: 400 })
  }

  const baseUrl = getAppBaseUrl(new URL(req.url).origin)
  const success = getSameOriginUrl(body.successUrl, baseUrl) || `${baseUrl}/projects?checkout=success`
  const cancel = getSameOriginUrl(body.cancelUrl, baseUrl) || `${baseUrl}/pricing?checkout=cancelled`

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity }],
      success_url: success,
      cancel_url: cancel,
      client_reference_id: uid,
      subscription_data: {
        metadata: { firebase_uid: uid },
        ...(process.env.FRIEND_STRIPE_ACCOUNT_ID
          ? {
              transfer_data: {
                destination: process.env.FRIEND_STRIPE_ACCOUNT_ID,
                amount_percent: 50,
              },
            }
          : {}),
      },
      allow_promotion_codes: true,
    })

    return Response.json({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    console.error("[Stripe checkout]", err)
    return Response.json({ error: err?.message || "Checkout failed" }, { status: 500 })
  }
}
