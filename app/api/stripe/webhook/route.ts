import { NextRequest } from "next/server"
import Stripe from "stripe"
import { adminDb } from "@/lib/firebase-admin"
import { Timestamp, FieldValue } from "firebase-admin/firestore"
import { PLAN_CONFIG } from "@/lib/plans"

const REFERRAL_CREDITS = 500

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  return secretKey ? new Stripe(secretKey) : null
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  const stripe = getStripeClient()
  if (!stripe || !webhookSecret) {
    return Response.json({ error: "Stripe webhook not configured" }, { status: 500 })
  }

  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error("[Stripe webhook] Signature verification failed:", err.message)
    return Response.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    const shouldProcess = await markWebhookProcessing(event.id, event.type)
    if (!shouldProcess) {
      return Response.json({ received: true, duplicate: true })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const uid = session.client_reference_id as string | null
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        if (subscriptionId && uid) {
          await syncSubscriptionToUser(stripe, subscriptionId, uid)
        } else if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const fallbackUid = sub.metadata?.firebase_uid || uid
          if (fallbackUid) await syncSubscriptionToUser(stripe, subscriptionId, fallbackUid)
        }
        break
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        const uid = subscription.metadata?.firebase_uid
        if (uid) await syncSubscriptionToUser(stripe, subscription.id, uid)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const uid = subscription.metadata?.firebase_uid
        if (uid) await setUserPlan(uid, "free", PLAN_CONFIG.free.tokensPerMonth, null)
        break
      }
      default:
        // ignore other events
        break
    }
    await markWebhookProcessed(event.id)
  } catch (err) {
    await markWebhookFailed(event.id).catch(() => {})
    console.error("[Stripe webhook] Handler error:", err)
    return Response.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return Response.json({ received: true })
}

async function markWebhookProcessing(eventId: string, eventType: string): Promise<boolean> {
  const ref = adminDb.collection("stripeWebhookEvents").doc(eventId)
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const status = snap.exists ? (snap.data() as { status?: unknown })?.status : null
    if (status === "processed" || status === "processing") return false
    tx.set(ref, {
      eventId,
      eventType,
      status: "processing",
      receivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return true
  })
}

async function markWebhookProcessed(eventId: string) {
  await adminDb.collection("stripeWebhookEvents").doc(eventId).set({
    status: "processed",
    processedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function markWebhookFailed(eventId: string) {
  await adminDb.collection("stripeWebhookEvents").doc(eventId).set({
    status: "failed",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function syncSubscriptionToUser(stripe: Stripe, subscriptionId: string, uid: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] })
  if (sub.status !== "active" && sub.status !== "trialing") {
    await setUserPlan(uid, "free", PLAN_CONFIG.free.tokensPerMonth, null)
    return
  }

  const price = sub.items.data[0]?.price
  const quantity = Math.max(1, sub.items.data[0]?.quantity || 1)
  if (!price) return

  const product = price.product as Stripe.Product
  const productName = (product?.name || "").toLowerCase()
  const meta = (price as any).metadata || {}
  const planId = meta.plan_id || (productName.includes("pro") ? "pro" : productName.includes("team") ? "team" : "pro")
  const baseTokensPerMonth = meta.tokens_per_month
    ? parseInt(meta.tokens_per_month, 10)
    : planId === "team" ? PLAN_CONFIG.team.tokensPerMonth : PLAN_CONFIG.pro.tokensPerMonth
  const tokensPerMonth = Math.max(1, baseTokensPerMonth) * quantity

  await setUserPlan(uid, planId, tokensPerMonth, subscriptionId)

  // Referral reward is earned only when the referred user pays for a plan.
  if (planId && planId !== "free") {
    await grantReferralReward(uid)
  }
}

/**
 * Grants 500 credits to both the referred user and their referrer the first
 * time the referred user activates a paid subscription. Idempotent via the
 * `referralClaimed` flag, so subscription renewals/updates never re-award.
 */
async function grantReferralReward(refereeUid: string) {
  const refereeRef = adminDb.collection("users").doc(refereeUid)
  try {
    await adminDb.runTransaction(async (tx) => {
      const refereeSnap = await tx.get(refereeRef)
      if (!refereeSnap.exists) return

      const referee = refereeSnap.data() as Record<string, unknown>
      const referrerUid = typeof referee.referredBy === "string" ? referee.referredBy : ""

      // No referrer, already rewarded, or self-referral → nothing to do.
      if (!referrerUid || referrerUid === refereeUid || referee.referralClaimed === true) {
        return
      }

      const referrerRef = adminDb.collection("users").doc(referrerUid)
      const referrerSnap = await tx.get(referrerRef)
      if (!referrerSnap.exists) {
        // Referrer no longer exists — close out so we don't re-check forever.
        tx.update(refereeRef, { referralClaimed: true })
        return
      }

      // Bumping tokensLimit keeps the bonus persistent across monthly resets.
      tx.update(refereeRef, {
        referralClaimed: true,
        tokensLimit: FieldValue.increment(REFERRAL_CREDITS),
        "tokenUsage.remaining": FieldValue.increment(REFERRAL_CREDITS),
      })
      tx.update(referrerRef, {
        referralCount: FieldValue.increment(1),
        referralCreditsEarned: FieldValue.increment(REFERRAL_CREDITS),
        tokensLimit: FieldValue.increment(REFERRAL_CREDITS),
        "tokenUsage.remaining": FieldValue.increment(REFERRAL_CREDITS),
      })
    })
  } catch (err) {
    // Never let referral bookkeeping break subscription provisioning.
    console.error("[Stripe webhook] Referral reward failed for", refereeUid, err)
  }
}

function getFirstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

async function setUserPlan(uid: string, planId: string, tokensPerMonth: number, stripeSubscriptionId: string | null) {
  const userRef = adminDb.collection("users").doc(uid)
  const snap = await userRef.get()
  if (!snap.exists) return

  const data = snap.data() as any
  const prevPlanId = data?.planId || "free"
  const existingUsage = data?.tokenUsage || {}
  const now = new Date()

  let used = typeof existingUsage.used === "number" ? existingUsage.used : 0
  let remaining =
    typeof existingUsage.remaining === "number"
      ? existingUsage.remaining
      : Math.max(0, tokensPerMonth - used)

  let periodStartRaw = existingUsage.periodStart
  let periodEndRaw = existingUsage.periodEnd

  const periodStart =
    periodStartRaw && typeof (periodStartRaw as any).toDate === "function"
      ? (periodStartRaw as any).toDate()
      : periodStartRaw
      ? new Date(periodStartRaw)
      : now

  const periodEnd =
    periodEndRaw && typeof (periodEndRaw as any).toDate === "function"
      ? (periodEndRaw as any).toDate()
      : periodEndRaw
      ? new Date(periodEndRaw)
      : getFirstDayOfNextMonth(now)

  const planChanged = prevPlanId !== planId

  // If the user upgraded/downgraded plan, start a fresh monthly bucket
  if (planChanged) {
    used = 0
    remaining = tokensPerMonth
  }

  const planName = planId.charAt(0).toUpperCase() + planId.slice(1)

  await userRef.update({
    planId,
    planName,
    tokensLimit: tokensPerMonth,
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    tokenUsage: {
      used,
      remaining: Math.max(0, remaining),
      periodStart: Timestamp.fromDate(planChanged ? now : periodStart),
      periodEnd: Timestamp.fromDate(planChanged ? getFirstDayOfNextMonth(now) : periodEnd),
    },
  })
}
