import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type {
  BetaTextBlockParam,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages"
import { normalizeOpenAiSdkUsage } from "@/lib/metering/pricing"
import type { UsageMeter } from "@/lib/metering/metered-anthropic"

export type ComputerAgentDefinition = {
  name: string
  description: string
  model: string
  system: string
  tools: Array<{ type: string }>
  skills: string[]
}

export type MemoryContext = {
  global?: string
  project?: string
}

type ComputerAgentMessageParams = Omit<MessageCreateParamsNonStreaming, "model"> & {
  model?: MessageCreateParamsNonStreaming["model"]
}

type ReasoningProvider = "nvidia" | "anthropic"
type BillingPlan = "free" | "paid" | "team" | string | null | undefined

const DEFAULT_ANTHROPIC_REASONING_MODEL = "claude-sonnet-4-6"
const DEFAULT_NVIDIA_REASONING_MODELS = [
  "deepseek-ai/deepseek-r1",
  "meta/llama-3.3-70b-instruct",
  "qwen/qwen2.5-coder-32b-instruct",
]

let nvidiaClient: OpenAI | null = null

export const LOTUS_BUILD_ORCHESTRATOR_AGENT: ComputerAgentDefinition = {
  name: "Lotus Build Orchestrator",
  description:
    "Autonomous website/app builder orchestration agent for Lotus Build. Understands build requests, plans when needed, researches when useful, prepares structured briefs, and coordinates the existing generation and preview pipelines.",
  model: DEFAULT_ANTHROPIC_REASONING_MODEL,
  system: `You are the Lotus Build Orchestrator, a senior product engineer who turns user requests into working web apps and sites.

You are calm, practical, careful, and product-minded. You do not guess, fabricate data, or invent unsupported capabilities. Ask concise clarifying questions only when the request is too ambiguous to build safely.

Your role is orchestration, not direct code generation. Preserve the existing Lotus Build architecture: code generation lives in /api/generate, preview/runtime lives in /api/sandbox, and project/session state is managed by the application. Do not reimplement these systems or create parallel generation or preview flows.

When UI quality matters, use available web/reference context before preparing the build brief. Do not install files or mutate the project from this agent path; generation must still happen through /api/generate.

Keep outputs brief, practical, and implementation-oriented.`,
  tools: [{ type: "agent_toolset_20260401" }],
  skills: [],
}

function buildMemoryBlock(memory?: MemoryContext): string {
  const parts: string[] = []
  if (memory?.global?.trim()) {
    parts.push(`GLOBAL MEMORY — user preferences that apply to every project:\n${memory.global.trim()}`)
  }
  if (memory?.project?.trim()) {
    parts.push(`PROJECT MEMORY — context specific to this project:\n${memory.project.trim()}`)
  }
  if (!parts.length) return ""
  return `---\nMEMORY CONTEXT (treat as authoritative user preferences and project facts):\n\n${parts.join("\n\n")}\n---`
}

function composeSystemPrompt(
  system?: MessageCreateParamsNonStreaming["system"],
  memory?: MemoryContext,
) {
  const memBlock = buildMemoryBlock(memory)
  const base = memBlock
    ? `${LOTUS_BUILD_ORCHESTRATOR_AGENT.system}\n\n${memBlock}`
    : LOTUS_BUILD_ORCHESTRATOR_AGENT.system
  if (!system) return base
  if (typeof system !== "string") return system
  return `${base}\n\nTask-specific instructions:\n${system}`
}

// Anthropic-path variant of composeSystemPrompt that emits cacheable blocks.
// The base block (agent identity + memory) is byte-identical for every call in
// a run, so one breakpoint lets all task prompts share a single cached prefix;
// the second breakpoint covers repeated calls with the same task instructions
// (e.g. the orchestrator loop). Prompts below the model's minimum cacheable
// length are processed uncached — the marker is a no-op, never an error.
function composeSystemBlocks(
  system: MessageCreateParamsNonStreaming["system"] | undefined,
  memory?: MemoryContext,
): MessageCreateParamsNonStreaming["system"] {
  if (system && typeof system !== "string") return system
  const memBlock = buildMemoryBlock(memory)
  const base = memBlock
    ? `${LOTUS_BUILD_ORCHESTRATOR_AGENT.system}\n\n${memBlock}`
    : LOTUS_BUILD_ORCHESTRATOR_AGENT.system
  const blocks: BetaTextBlockParam[] = [
    { type: "text", text: base, cache_control: { type: "ephemeral" } },
  ]
  if (system) {
    blocks.push({
      type: "text",
      text: `Task-specific instructions:\n${system}`,
      cache_control: { type: "ephemeral" },
    })
  }
  return blocks
}

function isFreeBillingPlan(plan: BillingPlan) {
  const normalized = typeof plan === "string" ? plan.trim().toLowerCase() : ""
  return normalized === "free"
}

function getReasoningProvider(plan: BillingPlan): ReasoningProvider {
  const configured = (process.env.LOTUS_REASONING_PROVIDER || "").toLowerCase()
  if (configured === "anthropic" || configured === "nvidia") return configured

  const freeConfigured = (process.env.LOTUS_FREE_REASONING_PROVIDER || "nvidia").toLowerCase()
  if (isFreeBillingPlan(plan) && freeConfigured === "nvidia") return "nvidia"

  return "anthropic"
}

function getNvidiaClient() {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY
  if (!apiKey) return null
  nvidiaClient ??= new OpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  })
  return nvidiaClient
}

function getReasoningModels() {
  const configured = process.env.LOTUS_NVIDIA_REASONING_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_NVIDIA_REASONING_MODELS
}

function chooseReasoningModel(params: ComputerAgentMessageParams) {
  const models = getReasoningModels()
  const seed = JSON.stringify(params.messages || []).slice(0, 2000)
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return models[hash % models.length]
}

function stringifyAnthropicContent(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .map((block) => {
      if (typeof block === "string") return block
      if (!block || typeof block !== "object") return ""
      const record = block as Record<string, unknown>
      return typeof record.text === "string" ? record.text : ""
    })
    .filter(Boolean)
    .join("\n")
}

function toOpenAIMessages(
  params: ComputerAgentMessageParams,
  system: string | MessageCreateParamsNonStreaming["system"] | undefined,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  if (typeof system === "string" && system.trim()) {
    messages.push({ role: "system", content: system })
  }

  for (const message of params.messages || []) {
    const role = message.role === "assistant" ? "assistant" : "user"
    messages.push({ role, content: stringifyAnthropicContent(message.content) })
  }

  return messages
}

function toAnthropicLikeResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  }
}

async function createNvidiaReasoningMessage(
  params: ComputerAgentMessageParams,
  memory?: MemoryContext,
  meter?: UsageMeter,
) {
  const client = getNvidiaClient()
  if (!client) return null

  const model = chooseReasoningModel(params)
  const system = composeSystemPrompt(params.system, memory)
  const response = await client.chat.completions.create({
    model,
    messages: toOpenAIMessages(params, system),
    temperature: params.temperature,
    max_tokens: params.max_tokens,
  })

  // NVIDIA is OpenAI-compatible and reports usage on the response; bill the
  // actuals through the same ledger as Anthropic calls.
  meter?.record({
    provider: "nvidia",
    model: response.model || model,
    usage: normalizeOpenAiSdkUsage(response.usage),
    requestId: response.id ?? null,
  })

  return toAnthropicLikeResponse(response.choices[0]?.message?.content || "")
}

export async function createComputerAgentMessage(
  anthropic: Anthropic,
  params: ComputerAgentMessageParams,
  options?: { enableMcp?: boolean; memory?: MemoryContext; billingPlan?: BillingPlan; meter?: UsageMeter },
) {
  if (getReasoningProvider(options?.billingPlan) === "nvidia") {
    options?.meter?.assertBudget()
    const nvidiaResponse = await createNvidiaReasoningMessage(params, options?.memory, options?.meter)
    if (nvidiaResponse) return nvidiaResponse
  }

  return anthropic.beta.messages.create({
    ...params,
    model: DEFAULT_ANTHROPIC_REASONING_MODEL,
    system: composeSystemBlocks(params.system, options?.memory),
  })
}
