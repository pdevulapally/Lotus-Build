import Anthropic from "@anthropic-ai/sdk"
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages"

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

export const LOTUS_BUILD_ORCHESTRATOR_AGENT: ComputerAgentDefinition = {
  name: "Lotus Build Orchestrator",
  description:
    "Autonomous website/app builder orchestration agent for Lotus Build. Understands build requests, plans when needed, researches when useful, prepares structured briefs, and coordinates the existing generation and preview pipelines.",
  model: "claude-sonnet-4-6",
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

export function createComputerAgentMessage(
  anthropic: Anthropic,
  params: ComputerAgentMessageParams,
  options?: { enableMcp?: boolean; memory?: MemoryContext },
) {
  return anthropic.beta.messages.create({
    ...params,
    model: LOTUS_BUILD_ORCHESTRATOR_AGENT.model,
    system: composeSystemPrompt(params.system, options?.memory),
  })
}
