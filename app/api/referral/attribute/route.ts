import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { requireUserUid } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Records who referred a newly-created account. No credits are granted here —
 * the reward is issued by the Stripe webhook once the referred user subscribes
 * to a paid plan. This endpoint only persists the (pending) attribution and is
 * idempotent: it refuses to overwrite an existing referrer or a claimed reward.
 */
export async function POST(req: Request) {
  try {
    const refereeUid = await requireUserUid(req)

    const body = (await req.json().catch(() => ({}))) as { referrerUid?: unknown }
    const referrerUid = typeof body.referrerUid === "string" ? body.referrerUid.trim() : ""

    if (!referrerUid) {
      return NextResponse.json({ error: "Missing referrer." }, { status: 400 })
    }
    if (referrerUid === refereeUid) {
      return NextResponse.json({ error: "Self-referral is not allowed." }, { status: 400 })
    }

    const refereeRef = adminDb.collection("users").doc(refereeUid)
    const referrerRef = adminDb.collection("users").doc(referrerUid)

    const result = await adminDb.runTransaction(async (tx) => {
      const refereeSnap = await tx.get(refereeRef)
      if (!refereeSnap.exists) return { status: 404 as const, error: "Account not found." }

      const referee = refereeSnap.data() as Record<string, unknown>

      // Don't overwrite an existing attribution or a reward already granted.
      if (referee.referredBy || referee.referralClaimed === true) {
        return { status: 200 as const, alreadyAttributed: true }
      }

      const referrerSnap = await tx.get(referrerRef)
      if (!referrerSnap.exists) return { status: 404 as const, error: "Referrer not found." }

      tx.update(refereeRef, { referredBy: referrerUid })
      return { status: 200 as const, attributed: true }
    })

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed"
    return NextResponse.json(
      { error: message },
      { status: message.includes("Authorization") ? 401 : 500 }
    )
  }
}
