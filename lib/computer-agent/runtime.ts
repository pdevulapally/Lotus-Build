import type {
  ComputerAgentRuntimeCheckpoint,
  ComputerAgentRuntimePhase,
  ComputerFollowUpIntent,
} from "@/lib/computer-agent/types"

const RUNTIME_PHASES = new Set<ComputerAgentRuntimePhase>([
  "idle",
  "understanding",
  "researching",
  "planning",
  "generating",
  "previewing",
  "fixing",
  "paused",
  "complete",
  "error",
])

const FOLLOW_UP_INTENT_RULES = [
  {
    intent: "resume_previous_work",
    patterns: [
      /\bcontinue\b/i,
      /\bresume\b/i,
      /\bcarry\s+on\b/i,
      /\bkeep\s+going\b/i,
      /\bfinish\s+(it|this|the\s+build)\b/i,
      /\bpick\s+up\s+where\s+(you|it)\s+(left\s+off|stopped)\b/i,
    ],
  },
  {
    intent: "cancel_or_pause",
    patterns: [
      /^(please\s+)?stop[.!?\s]*$/i,
      /^(please\s+)?pause[.!?\s]*$/i,
      /^(please\s+)?cancel[.!?\s]*$/i,
      /^(please\s+)?halt[.!?\s]*$/i,
    ],
  },
  {
    intent: "answer_clarification",
    patterns: [
      /\byes\b/i,
      /\bno\b/i,
      /\bsure\b/i,
      /\bthat'?s?\s+right\b/i,
      /\boption\s+\w+\b/i,
    ],
  },
  {
    intent: "edit_existing_project",
    patterns: [
      /\bchange\b/i,
      /\bmake\s+it\b/i,
      /\bupdate\b/i,
      /\bfix\b/i,
      /\breplace\b/i,
      /\bremove\b/i,
      /\badd\b/i,
    ],
  },
] as const satisfies readonly Array<{
  intent: Exclude<ComputerFollowUpIntent, "new_instruction">
  patterns: readonly RegExp[]
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function normalizeRuntimePhase(value: unknown): ComputerAgentRuntimePhase {
  return typeof value === "string" && RUNTIME_PHASES.has(value as ComputerAgentRuntimePhase)
    ? (value as ComputerAgentRuntimePhase)
    : "idle"
}

export function normalizeComputerAgentRuntime(value: unknown): ComputerAgentRuntimeCheckpoint {
  const record = isRecord(value) ? value : {}
  const phase = normalizeRuntimePhase(record.phase)
  const lastCompletedPhase = normalizeRuntimePhase(record.lastCompletedPhase)

  return {
    phase,
    ...(lastCompletedPhase !== "idle" ? { lastCompletedPhase } : {}),
    ...(asString(record.nextAction) ? { nextAction: asString(record.nextAction) } : {}),
    ...(asString(record.effectiveRequest) ? { effectiveRequest: asString(record.effectiveRequest) } : {}),
    ...(asString(record.planText) ? { planText: asString(record.planText) } : {}),
    ...(typeof record.generatedFileCount === "number" ? { generatedFileCount: record.generatedFileCount } : {}),
    ...(asString(record.lastError) ? { lastError: asString(record.lastError) } : {}),
    ...(typeof record.paused === "boolean" ? { paused: record.paused } : {}),
    ...(asString(record.stoppedAt) ? { stoppedAt: asString(record.stoppedAt) } : {}),
    updatedAt: asString(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function resolveComputerFollowUpIntent(
  prompt: string,
  runtime: ComputerAgentRuntimeCheckpoint,
): ComputerFollowUpIntent {
  const trimmed = prompt.trim()
  if (!trimmed) return "new_instruction"

  for (const rule of FOLLOW_UP_INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      if (rule.intent !== "resume_previous_work") return rule.intent
      if (runtime.paused || runtime.nextAction || runtime.phase !== "idle") return rule.intent
    }
  }

  return "new_instruction"
}

export function buildComputerRuntimeContext(
  runtime: ComputerAgentRuntimeCheckpoint,
  intent: ComputerFollowUpIntent,
): string {
  return [
    `Follow-up intent: ${intent}`,
    `Runtime phase: ${runtime.phase}`,
    runtime.lastCompletedPhase ? `Last completed phase: ${runtime.lastCompletedPhase}` : "",
    runtime.nextAction ? `Next action: ${runtime.nextAction}` : "",
    runtime.effectiveRequest ? `Effective request: ${runtime.effectiveRequest}` : "",
    runtime.planText ? `Saved plan:\n${runtime.planText}` : "",
    typeof runtime.generatedFileCount === "number" ? `Generated files so far: ${runtime.generatedFileCount}` : "",
    runtime.lastError ? `Last error: ${runtime.lastError}` : "",
    runtime.paused ? `Paused at: ${runtime.stoppedAt || runtime.updatedAt}` : "",
  ].filter(Boolean).join("\n")
}

export function createRuntimeCheckpoint(
  patch: Partial<Omit<ComputerAgentRuntimeCheckpoint, "updatedAt">>,
): ComputerAgentRuntimeCheckpoint {
  const checkpoint = {
    phase: patch.phase ?? "idle",
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  return Object.fromEntries(
    Object.entries(checkpoint).filter(([, value]) => value !== undefined),
  ) as ComputerAgentRuntimeCheckpoint
}
