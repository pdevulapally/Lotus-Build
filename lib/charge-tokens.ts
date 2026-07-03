/**
 * Adapter between /api/generate's accumulated OpenAI-shape usage and the
 * metering ledger (lib/metering). All debits flow through recordUsageAndDebit
 * so generation charges share the same idempotent ledger, pricing registry,
 * and canonical balance shape as every other surface.
 *
 * There is deliberately no character-count fallback: when a provider fails to
 * report usage, the call is recorded as `usage_missing` (zero charge) with the
 * prompt/output sizes attached for offline reconciliation — never estimated.
 */
import { recordUsageAndDebit, type UsageProvider } from "@/lib/metering/ledger"
import type { NormalizedUsage } from "@/lib/metering/pricing"

type UsageInfo = {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number | null } | null
} | null

function toNormalizedUsage(usageInfo: UsageInfo): NormalizedUsage | null {
  if (!usageInfo) return null

  const completion = Math.max(0, usageInfo.completion_tokens ?? 0)
  const prompt = Math.max(
    0,
    usageInfo.prompt_tokens ?? Math.max(0, (usageInfo.total_tokens ?? 0) - completion)
  )
  if (prompt === 0 && completion === 0) return null

  // Anthropic-normalized usage folds cache tokens into prompt_tokens and also
  // reports them separately; OpenAI-compatible providers report cached prompt
  // tokens under prompt_tokens_details. Both are subsets of `prompt`.
  const cacheWrite = Math.max(0, usageInfo.cache_creation_input_tokens ?? 0)
  const cacheRead = Math.max(
    0,
    usageInfo.cache_read_input_tokens ?? usageInfo.prompt_tokens_details?.cached_tokens ?? 0
  )
  const bounded = Math.min(cacheWrite + cacheRead, prompt)
  const boundedWrite = Math.min(cacheWrite, bounded)
  const boundedRead = bounded - boundedWrite

  return {
    inputTokens: prompt - bounded,
    outputTokens: completion,
    cacheCreationTokens: boundedWrite,
    cacheReadTokens: boundedRead,
  }
}

export async function chargeTokensForGeneration(params: {
  uid: string
  usageInfo: UsageInfo
  promptChars: number
  completionChars: number
  provider?: UsageProvider
  model?: string
  requestId?: string | null
}): Promise<void> {
  const usage = toNormalizedUsage(params.usageInfo)

  await recordUsageAndDebit({
    uid: params.uid,
    feature: "generate",
    provider: params.provider ?? "anthropic",
    model: params.model ?? "unknown",
    usage,
    requestId: params.requestId ?? null,
    meta: {
      promptChars: params.promptChars,
      completionChars: params.completionChars,
    },
  })
}
