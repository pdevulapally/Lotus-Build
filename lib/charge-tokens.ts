import { adminDb } from "@/lib/firebase-admin"
import { DEFAULT_PLANS } from "@/lib/firebase"

type UsageInfo = {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
} | null

export async function chargeTokensForGeneration(params: {
  uid: string
  usageInfo: UsageInfo
  promptChars: number
  completionChars: number
}): Promise<void> {
  const { uid, usageInfo, promptChars, completionChars } = params

  const fallbackTokens = Math.ceil((promptChars + completionChars) / 4)
  const tokensToCharge = usageInfo
    ? (usageInfo.total_tokens ?? (usageInfo.prompt_tokens || 0) + (usageInfo.completion_tokens || 0))
    : fallbackTokens

  if (tokensToCharge <= 0) return

  const userRef = adminDb.collection("users").doc(uid)
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(userRef)
    if (!snap.exists) throw new Error("user-not-found")
    const data = snap.data() as any

    const planId = data?.planId || "free"
    const planTokensPerMonth =
      data?.tokensLimit != null
        ? Number(data.tokensLimit)
        : (DEFAULT_PLANS[planId as keyof typeof DEFAULT_PLANS]?.tokensPerMonth ??
           DEFAULT_PLANS.free.tokensPerMonth)

    let remaining: number
    if (data?.tokenUsage?.remaining != null) {
      remaining = Number(data.tokenUsage.remaining)
    } else if (data?.tokensLimit != null && data?.tokensUsed != null) {
      remaining = Number(data.tokensLimit) - Number(data.tokensUsed)
    } else {
      remaining = planTokensPerMonth
    }
    remaining = Math.max(0, remaining)

    if (tokensToCharge > planTokensPerMonth) {
      console.warn(`[tokens] Generation used ${tokensToCharge} tokens; plan=${planId} monthly=${planTokensPerMonth}`)
    }
    if (remaining < tokensToCharge) {
      console.warn(`[tokens] uid=${uid} has ${remaining} remaining but used ${tokensToCharge}; consuming balance`)
    }

    const actualCharge = Math.min(tokensToCharge, remaining)
    const currentUsed = data?.tokenUsage?.used ?? data?.tokensUsed ?? 0
    const newUsed = Number(currentUsed) + actualCharge
    const newRemaining = Math.max(0, remaining - actualCharge)

    console.log(`[tokens] uid=${uid} plan=${planId} charged=${actualCharge} used=${newUsed} remaining=${newRemaining}`)

    tx.update(userRef, {
      "tokenUsage.used": newUsed,
      "tokenUsage.remaining": newRemaining,
    })
  })
}
