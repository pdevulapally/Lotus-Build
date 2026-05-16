import { NextRequest } from "next/server"
import Stripe from "stripe"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(req: NextRequest) {
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
    return Response.json({ invoices: [] })
  }

  try {
    const sub = await stripe.subscriptions.retrieve(data.stripeSubscriptionId)
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id

    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
      expand: ["data.subscription"],
    })

    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.created,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
      description: inv.lines.data[0]?.description ?? null,
    }))

    return Response.json({ invoices })
  } catch (err: any) {
    console.error("[Stripe invoices]", err)
    return Response.json({ error: err?.message || "Failed to fetch invoices" }, { status: 500 })
  }
}
