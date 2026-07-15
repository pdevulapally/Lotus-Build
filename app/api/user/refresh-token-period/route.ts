import { NextRequest } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { requireUserUid } from "@/lib/server-auth"
import { PLAN_CONFIG } from "@/lib/plans"

function getFirstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function getPeriodEndDate(raw: unknown): Date | null {
  if (!raw) return null
  if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof (raw as { toDate: () => Date }).toDate === "function") {
    return (raw as { toDate: () => Date }).toDate()
  }
  const d = new Date(raw as string | number)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  let uid: string
  try {
    uid = await requireUserUid(req)
  } catch {
    return Response.json({ error: "Missing or invalid auth token" }, { status: 401 })
  }

  const userRef = adminDb.collection("users").doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  const data = userSnap.data() as Record<string, unknown>
  const planTokensPerMonth =
    data?.tokensLimit != null
      ? Number(data.tokensLimit)
      : PLAN_CONFIG.free.tokensPerMonth

  const periodEnd = getPeriodEndDate(data?.tokenUsage && (data.tokenUsage as Record<string, unknown>)?.periodEnd)
  const now = new Date()
  const shouldReset = !periodEnd || isNaN(periodEnd.getTime()) || now >= periodEnd

  if (shouldReset) {
    const nextPeriodEnd = getFirstDayOfNextMonth(now)
    await userRef.update({
      tokenUsage: {
        used: 0,
        remaining: planTokensPerMonth,
        periodStart: Timestamp.fromDate(now),
        periodEnd: Timestamp.fromDate(nextPeriodEnd),
      },
    })
  }

  return Response.json({ ok: true, reset: shouldReset })
}
