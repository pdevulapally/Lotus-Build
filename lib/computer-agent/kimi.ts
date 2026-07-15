import OpenAI from "openai"

/**
 * Free-tier model for the entire computer-agent agentic loop (both the
 * orchestrator's planning/reasoning calls in agent-config.ts and the
 * file-generation loop in agentic-generation.ts via kimi-anthropic-shim.ts).
 * Confirmed slug for this Moonshot account — do not alter or "correct" it.
 */
export const KIMI_MODEL = "kimi-k2.7-code"

let moonshotClient: OpenAI | null = null

export function getMoonshotClient(): OpenAI | null {
  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) return null
  moonshotClient ??= new OpenAI({
    apiKey,
    baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1",
  })
  return moonshotClient
}
