import { NextRequest } from "next/server"
import Stripe from "stripe"
import { adminDb } from "@/lib/firebase-admin"
import { getAppBaseUrl } from "@/lib/security/url"
import { requireUserUid } from "@/lib/server-auth"

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
  try {
    uid = await requireUserUid(req)
  } catch {
    return Response.json({ error: "Missing or invalid token" }, { status: 401 })
  }

  const userDoc = await adminDb.collection("users").doc(uid).get()
  const data = userDoc.data()
  if (!data?.stripeSubscriptionId) {
    return Response.json({ error: "No active subscription found" }, { status: 400 })
  }

  try {
    const sub = await stripe.subscriptions.retrieve(data.stripeSubscriptionId)
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id

    const baseUrl = getAppBaseUrl(new URL(req.url).origin)
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings`,
    })

    return Response.json({ url: portalSession.url })
  } catch (err: any) {
    console.error("[Stripe portal]", err)
    return Response.json({ error: err?.message || "Failed to create portal session" }, { status: 500 })
  }
}
