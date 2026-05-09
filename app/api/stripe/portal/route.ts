import { NextRequest } from "next/server"
import Stripe from "stripe"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe is not configured" }, { status: 500 })
  }

  const authHeader = req.headers.get("authorization")
  const idToken = authHeader?.replace(/Bearer\s+/i, "")?.trim()
  if (!idToken) return Response.json({ error: "Missing token" }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 })
  }

  const userDoc = await adminDb.collection("users").doc(uid).get()
  const data = userDoc.data()
  if (!data?.stripeSubscriptionId) {
    return Response.json({ error: "No active subscription found" }, { status: 400 })
  }

  try {
    const sub = await stripe.subscriptions.retrieve(data.stripeSubscriptionId)
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
    
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
