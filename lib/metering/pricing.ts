/**
 * TOKEN PRICING REGISTRY
 *
 * Converts provider-reported raw usage into charged app tokens ("credits").
 * Every model call in the product is billed through this module — there are
 * no per-route pricing branches anywhere else.
 *
 *   chargedTokens = ceil(
 *     input      * inputWeight +
 *     output     * outputWeight +
 *     cacheWrite * cacheWriteWeight +
 *     cacheRead  * cacheReadWeight
 *   )
 *
 * RULES:
 *   - Usage numbers must come from the provider response (`usage` on the
 *     Anthropic/OpenAI response). Never estimate from character counts.
 *   - Adding a model or changing its rate is a registry entry, not code.
 *   - Unknown models fall back to DEFAULT_PRICING and log loudly — they are
 *     never silently free.
 *   - Runtime overrides (no deploy) via LOTUS_TOKEN_PRICING_OVERRIDES:
 *     JSON of { "<model-or-prefix>": { "outputWeight": 2 } }.
 *
 * Default weights preserve the existing product economics (1 credit per raw
 * token) except cache traffic, which is priced at its true relative cost:
 * cache writes ~1.25x input, cache reads ~0.1x input.
 */

export type NormalizedUsage = {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export type ModelPricing = {
  inputWeight: number
  outputWeight: number
  cacheWriteWeight: number
  cacheReadWeight: number
}

export const DEFAULT_PRICING: ModelPricing = {
  inputWeight: 1,
  outputWeight: 1,
  cacheWriteWeight: 1.25,
  cacheReadWeight: 0.1,
}

/**
 * Keys are matched exactly first, then by longest prefix — so a dated model id
 * like "claude-sonnet-4-6-20261101" resolves to the "claude-sonnet-4-6" entry.
 * Values are partial overrides on top of DEFAULT_PRICING.
 */
const MODEL_PRICING: Record<string, Partial<ModelPricing>> = {
  // Anthropic
  "claude-sonnet-4-6": {},
  "claude-sonnet-4-5": {},
  "claude-haiku-4-5": {},
  "claude-opus-4-6": {},
  // OpenAI
  "gpt-5.5": {},
  "gpt-5.4": {},
  "o3-mini": {},
  // NVIDIA-hosted open models
  "deepseek-ai/deepseek-r1": {},
  "meta/llama-3.3-70b-instruct": {},
  "qwen/qwen2.5-coder-32b-instruct": {},
}

function loadEnvOverrides(): Record<string, Partial<ModelPricing>> {
  const raw = process.env.LOTUS_TOKEN_PRICING_OVERRIDES
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, Partial<ModelPricing>>
    }
    console.error("[metering] LOTUS_TOKEN_PRICING_OVERRIDES is not a JSON object — ignoring")
  } catch (err) {
    console.error("[metering] Failed to parse LOTUS_TOKEN_PRICING_OVERRIDES — ignoring:", err)
  }
  return {}
}

const ENV_OVERRIDES = loadEnvOverrides()
const warnedUnknownModels = new Set<string>()

function findEntry(registry: Record<string, Partial<ModelPricing>>, model: string): Partial<ModelPricing> | null {
  if (registry[model]) return registry[model]
  let bestKey = ""
  for (const key of Object.keys(registry)) {
    if (model.startsWith(key) && key.length > bestKey.length) bestKey = key
  }
  return bestKey ? registry[bestKey] : null
}

export function resolveModelPricing(model: string): ModelPricing {
  const base = findEntry(MODEL_PRICING, model)
  const override = findEntry(ENV_OVERRIDES, model)

  if (!base && !override && !warnedUnknownModels.has(model)) {
    warnedUnknownModels.add(model)
    console.error(
      `[metering] Unknown model "${model}" has no pricing entry — charging at DEFAULT_PRICING. ` +
        "Add it to MODEL_PRICING in lib/metering/pricing.ts."
    )
  }

  return { ...DEFAULT_PRICING, ...(base ?? {}), ...(override ?? {}) }
}

export function computeChargedTokens(model: string, usage: NormalizedUsage): number {
  const pricing = resolveModelPricing(model)
  const charged =
    usage.inputTokens * pricing.inputWeight +
    usage.outputTokens * pricing.outputWeight +
    usage.cacheCreationTokens * pricing.cacheWriteWeight +
    usage.cacheReadTokens * pricing.cacheReadWeight
  return Math.max(0, Math.ceil(charged))
}

// ---------------------------------------------------------------------------
// Usage normalization — one shape regardless of provider
// ---------------------------------------------------------------------------

export function emptyUsage(): NormalizedUsage {
  return { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
}

export function addUsage(a: NormalizedUsage, b: NormalizedUsage): NormalizedUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  }
}

export function hasUsage(usage: NormalizedUsage | null | undefined): usage is NormalizedUsage {
  if (!usage) return false
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.cacheCreationTokens > 0 ||
    usage.cacheReadTokens > 0
  )
}

/** Anthropic `usage`: { input_tokens, output_tokens, cache_creation_input_tokens?, cache_read_input_tokens? } */
export function normalizeAnthropicSdkUsage(usage: unknown): NormalizedUsage | null {
  const u = usage as
    | {
        input_tokens?: number | null
        output_tokens?: number | null
        cache_creation_input_tokens?: number | null
        cache_read_input_tokens?: number | null
      }
    | null
    | undefined
  if (!u || (u.input_tokens == null && u.output_tokens == null)) return null
  return {
    inputTokens: Math.max(0, u.input_tokens ?? 0),
    outputTokens: Math.max(0, u.output_tokens ?? 0),
    cacheCreationTokens: Math.max(0, u.cache_creation_input_tokens ?? 0),
    cacheReadTokens: Math.max(0, u.cache_read_input_tokens ?? 0),
  }
}

/**
 * OpenAI-compatible `usage` (OpenAI, NVIDIA): { prompt_tokens, completion_tokens, total_tokens,
 * prompt_tokens_details?: { cached_tokens } }. Cached tokens are a subset of prompt_tokens.
 */
export function normalizeOpenAiSdkUsage(usage: unknown): NormalizedUsage | null {
  const u = usage as
    | {
        prompt_tokens?: number | null
        completion_tokens?: number | null
        total_tokens?: number | null
        prompt_tokens_details?: { cached_tokens?: number | null } | null
      }
    | null
    | undefined
  if (!u || (u.prompt_tokens == null && u.completion_tokens == null && u.total_tokens == null)) return null
  const completion = Math.max(0, u.completion_tokens ?? 0)
  const prompt = Math.max(0, u.prompt_tokens ?? Math.max(0, (u.total_tokens ?? 0) - completion))
  const cached = Math.max(0, Math.min(u.prompt_tokens_details?.cached_tokens ?? 0, prompt))
  return {
    inputTokens: prompt - cached,
    outputTokens: completion,
    cacheCreationTokens: 0,
    cacheReadTokens: cached,
  }
}
