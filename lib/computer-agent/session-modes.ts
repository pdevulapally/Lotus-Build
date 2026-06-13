export type ComputerSessionMode = "auto" | "ask" | "plan" | "build"

export type GenerationPolicy = "orchestrator" | "never" | "after_plan" | "always"
export type PlanningPolicy = "orchestrator" | "force" | "avoid"

export interface ComputerSessionModeConfig {
  id: ComputerSessionMode
  label: string
  description: string
  shortDescription: string
  orchestratorGuidance: string
  planningPolicy: PlanningPolicy
  generationPolicy: GenerationPolicy
}

export const COMPUTER_SESSION_MODES = [
  {
    id: "auto",
    label: "Smart",
    description: "Choose whether to ask, plan, or build based on the prompt.",
    shortDescription: "Lotus chooses the next step",
    orchestratorGuidance:
      "Mode: Auto. Choose the safest next action from the full context. Ask if the request is vague, draft a plan when structure is useful, and generate when enough context exists.",
    planningPolicy: "orchestrator",
    generationPolicy: "orchestrator",
  },
  {
    id: "ask",
    label: "Ask",
    description: "Clarify requirements before planning or building.",
    shortDescription: "Questions first",
    orchestratorGuidance:
      "Mode: Ask. Do not generate code. Focus on understanding the user request and ask concise clarifying questions when requirements are incomplete.",
    planningPolicy: "avoid",
    generationPolicy: "never",
  },
  {
    id: "plan",
    label: "Plan",
    description: "Create a plan before any code generation.",
    shortDescription: "Plan only",
    orchestratorGuidance:
      "Mode: Plan. Do not generate code in this run. Produce or refine a concise implementation plan once enough context exists.",
    planningPolicy: "force",
    generationPolicy: "after_plan",
  },
  {
    id: "build",
    label: "Build",
    description: "Move directly toward generation when the request is actionable.",
    shortDescription: "Build now",
    orchestratorGuidance:
      "Mode: Build. Move toward generation when the request is actionable. Ask only for truly blocking information that would make the build fail or clearly miss the user's goal.",
    planningPolicy: "avoid",
    generationPolicy: "always",
  },
] as const satisfies readonly ComputerSessionModeConfig[]

const MODE_BY_ID = new Map<ComputerSessionMode, ComputerSessionModeConfig>(
  COMPUTER_SESSION_MODES.map((mode) => [mode.id, mode]),
)

export function isComputerSessionMode(value: unknown): value is ComputerSessionMode {
  return typeof value === "string" && MODE_BY_ID.has(value as ComputerSessionMode)
}

export function normalizeComputerSessionMode(value: unknown): ComputerSessionMode {
  return isComputerSessionMode(value) ? value : "auto"
}

export function getComputerSessionModeConfig(value: unknown): ComputerSessionModeConfig {
  return MODE_BY_ID.get(normalizeComputerSessionMode(value)) ?? COMPUTER_SESSION_MODES[0]
}

export function buildComputerSessionModeInstructions(value: unknown): string {
  const config = getComputerSessionModeConfig(value)
  return [
    config.orchestratorGuidance,
    `Planning policy: ${config.planningPolicy}.`,
    `Generation policy: ${config.generationPolicy}.`,
  ].join("\n")
}

export function shouldDraftPlanForMode(value: unknown, current: boolean): boolean {
  const policy = getComputerSessionModeConfig(value).planningPolicy
  const policyHandlers: Record<PlanningPolicy, () => boolean> = {
    orchestrator: () => current,
    force: () => true,
    avoid: () => false,
  }
  return policyHandlers[policy]()
}

export function shouldGenerateForMode(value: unknown, current: boolean): boolean {
  const policy = getComputerSessionModeConfig(value).generationPolicy
  const policyHandlers: Record<GenerationPolicy, () => boolean> = {
    orchestrator: () => current,
    never: () => false,
    after_plan: () => false,
    always: () => true,
  }
  return policyHandlers[policy]()
}
