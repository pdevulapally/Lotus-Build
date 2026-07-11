/**
 * USAGE LEDGER + BALANCE GATE
 *
 * Every billable model call produces exactly one append-only document in the
 * `usageEvents` collection and one transactional debit against the user's
 * canonical balance (`users/{uid}.tokenUsage.{used,remaining}`).
 *
 * Guarantees:
 *   - Idempotent: events keyed by the provider's message/request id — a retry
 *     that replays the same response cannot double-charge.
 *   - Actuals only: a call whose usage is unavailable is recorded as
 *     `usage_missing` with a zero charge for offline reconciliation. It is
 *     never estimated from character counts.
 *   - No over-quota debit: provider-reported usage is stored for audit, but
 *     the user balance is only debited up to the live remaining balance.
 *     Anything beyond the balance is recorded on the event as `overageTokens`.
 *   - Canonical shape: reads tolerate the legacy `tokensUsed`/`tokensLimit`
 *     fields, writes only ever touch `tokenUsage.*` (the same shape written
 *     by the Stripe webhook and the monthly reset).
 */
import { adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { DEFAULT_PLANS } from "@/lib/firebase"
import { computeChargedTokens, hasUsage, type NormalizedUsage } from "./pricing"

export class InsufficientTokensError extends Error {
  constructor(message = "Insufficient tokens") {
    super(message)
    this.name = "InsufficientTokensError"
  }
}

export class MeteringUserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message)
    this.name = "MeteringUserNotFoundError"
  }
}

export type UsageProvider = "anthropic" | "openai" | "nvidia"

export type UsageEventInput = {
  uid: string
  /** Which product surface generated the spend, e.g. "computer-agent" | "generate". */
  feature: string
  provider: UsageProvider
  /** The model that actually served the response (from the response, not the request). */
  model: string
  /** Provider-reported usage. `null` means the provider gave no usage — recorded, never estimated. */
  usage: NormalizedUsage | null
  /** Provider message/request id → idempotency key. Optional; falls back to a random id. */
  requestId?: string | null
  runId?: string | null
  /** Free-form diagnostics stored on the event (e.g. prompt sizes for reconciliation). */
  meta?: Record<string, number | string | boolean | null>
}

export type UsageChargeResult = {
  reportedTokens: number
  chargedTokens: number
  overageTokens: number
  remaining: number | null
  deduplicated: boolean
}

function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 480)
  return cleaned || "invalid"
}

type UserBalance = { used: number; remaining: number; planId: string; planTokensPerMonth: number }

/** Canonical balance read with legacy-field fallback — single source of truth. */
function readUserBalance(data: Record<string, unknown> | undefined): UserBalance {
  const d = (data ?? {}) as {
    planId?: string
    tokensLimit?: number
    tokensUsed?: number
    tokenUsage?: { used?: number; remaining?: number }
  }
  const planId = d.planId || "free"
  const planTokensPerMonth =
    d.tokensLimit != null
      ? Number(d.tokensLimit)
      : DEFAULT_PLANS[planId as keyof typeof DEFAULT_PLANS]?.tokensPerMonth ?? DEFAULT_PLANS.free.tokensPerMonth

  const used = Number(d.tokenUsage?.used ?? d.tokensUsed ?? 0)

  let remaining: number
  if (d.tokenUsage?.remaining != null) {
    remaining = Number(d.tokenUsage.remaining)
  } else if (d.tokensLimit != null && d.tokensUsed != null) {
    remaining = Number(d.tokensLimit) - Number(d.tokensUsed)
  } else {
    remaining = planTokensPerMonth
  }

  return {
    used: Number.isFinite(used) ? Math.max(0, used) : 0,
    remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
    planId,
    planTokensPerMonth,
  }
}

/**
 * Records a usage event and debits the user's balance in one transaction.
 * Safe to call concurrently; replays keyed by `requestId` are no-ops.
 */
export async function recordUsageAndDebit(event: UsageEventInput): Promise<UsageChargeResult> {
  const reportedTokens = event.usage ? computeChargedTokens(event.model, event.usage) : 0
  const status = event.usage ? "charged" : "usage_missing"

  // A call that genuinely used zero tokens (and reported so) needs no ledger entry.
  if (event.usage && !hasUsage(event.usage) && reportedTokens === 0) {
    return { reportedTokens: 0, chargedTokens: 0, overageTokens: 0, remaining: null, deduplicated: false }
  }

  const eventsCollection = adminDb.collection("usageEvents")
  const eventRef = event.requestId
    ? eventsCollection.doc(sanitizeDocId(`${event.provider}_${event.requestId}`))
    : eventsCollection.doc()
  const userRef = adminDb.collection("users").doc(event.uid)

  return adminDb.runTransaction(async (tx) => {
    const [existingEvent, userSnap] = await Promise.all([tx.get(eventRef), tx.get(userRef)])

    if (existingEvent.exists) {
      const prior = existingEvent.data() as { reportedTokens?: number; chargedTokens?: number; overageTokens?: number }
      return {
        reportedTokens: prior?.reportedTokens ?? ((prior?.chargedTokens ?? 0) + (prior?.overageTokens ?? 0)),
        chargedTokens: prior?.chargedTokens ?? 0,
        overageTokens: prior?.overageTokens ?? 0,
        remaining: null,
        deduplicated: true,
      }
    }
    if (!userSnap.exists) throw new MeteringUserNotFoundError()

    const balance = readUserBalance(userSnap.data())
    const chargedTokens = Math.min(reportedTokens, balance.remaining)
    const overageTokens = Math.max(0, reportedTokens - chargedTokens)
    const newUsed = balance.used + chargedTokens
    const newRemaining = balance.remaining - chargedTokens

    tx.create(eventRef, {
      uid: event.uid,
      feature: event.feature,
      provider: event.provider,
      model: event.model,
      runId: event.runId ?? null,
      requestId: event.requestId ?? null,
      status,
      usage: event.usage
        ? {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            cacheCreationTokens: event.usage.cacheCreationTokens,
            cacheReadTokens: event.usage.cacheReadTokens,
          }
        : null,
      reportedTokens,
      chargedTokens,
      overageTokens,
      planId: balance.planId,
      ...(event.meta ? { meta: event.meta } : {}),
      createdAt: Timestamp.now(),
    })

    if (chargedTokens > 0) {
      tx.update(userRef, {
        "tokenUsage.used": newUsed,
        "tokenUsage.remaining": newRemaining,
      })
    }

    if (overageTokens > 0) {
      console.warn(
        `[metering] uid=${event.uid} feature=${event.feature} usage exceeded balance by ${overageTokens} tokens (reported ${reportedTokens}, charged ${chargedTokens}, remaining ${balance.remaining})`
      )
    }

    return { reportedTokens, chargedTokens, overageTokens, remaining: newRemaining, deduplicated: false }
  })
}

// ---------------------------------------------------------------------------
// Balance gate (shared by every LLM-backed route)
// ---------------------------------------------------------------------------

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

export type TokenBalance = {
  remaining: number
  planId: string
  planTokensPerMonth: number
}

/**
 * Verifies the user has tokens available, resetting the monthly period first
 * when it has lapsed. Throws InsufficientTokensError (map to HTTP 402) or
 * MeteringUserNotFoundError (map to 404).
 *
 * `allowExhausted` opts out of the InsufficientTokensError throw so a caller
 * can run a degraded (e.g. cheaper-model, queued) path instead of a hard
 * block once a plan's balance hits zero — recordUsageAndDebit still caps the
 * real charge at the live remaining balance either way, so this never lets
 * usage go negative.
 */
export async function assertTokenBalance(uid: string, opts?: { allowExhausted?: boolean }): Promise<TokenBalance> {
  const userRef = adminDb.collection("users").doc(uid)
  const userSnap = await userRef.get()
  if (!userSnap.exists) throw new MeteringUserNotFoundError()

  const userData = userSnap.data() as Record<string, unknown>
  const balance = readUserBalance(userData)

  const periodEnd = getPeriodEndDate((userData?.tokenUsage as { periodEnd?: unknown } | undefined)?.periodEnd)
  const now = new Date()
  const shouldReset = !periodEnd || isNaN(periodEnd.getTime()) || now >= periodEnd

  let remaining = balance.remaining
  if (shouldReset) {
    remaining = balance.planTokensPerMonth
    await userRef.update({
      tokenUsage: {
        used: 0,
        remaining,
        periodStart: Timestamp.fromDate(now),
        periodEnd: Timestamp.fromDate(getFirstDayOfNextMonth(now)),
      },
    })
  }

  if (remaining <= 0 && !opts?.allowExhausted) throw new InsufficientTokensError()

  return { remaining, planId: balance.planId, planTokensPerMonth: balance.planTokensPerMonth }
}
