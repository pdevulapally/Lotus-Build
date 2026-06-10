import type { ComputerConversationTurn } from "@/lib/computer-agent/types"
import { formatConversationForOrchestrator, summarizeTimelineForOrchestrator } from "@/lib/computer-agent/conversation"

export type OrchestratorAction =
  | "respond"
  | "ask_clarification"
  | "research"
  | "draft_plan"
  | "generate"
  | "edit_existing"
  | "stop"

export type OrchestratorQuestionOption = {
  id: string
  label: string
  description?: string
}

export type OrchestratorQuestion = {
  kind: "single" | "multi" | "text"
  title: string
  description?: string
  options?: OrchestratorQuestionOption[]
  allowCustom?: boolean
  customPlaceholder?: string
  placeholder?: string
}

export type OrchestratorDecision = {
  action: OrchestratorAction
  effectiveRequest: string
  assistantMessage?: string
  questions?: OrchestratorQuestion[]
  needsResearch?: boolean
  shouldDraftPlan?: boolean
  reason: string
}

export type OrchestratorPhaseState = {
  effectiveRequest: string
  researchCompleted: boolean
  planCompleted: boolean
  planText: string
  hasExistingProject: boolean
  previewAvailable: boolean
  fileCount: number
}

export type OrchestratorContext = {
  storedPrompt: string
  currentMessage: string
  conversationTurns: ComputerConversationTurn[]
  timeline: Array<{ title?: string; description?: string; kind?: string; status?: string }>
  phase: OrchestratorPhaseState
}

const VALID_ACTIONS = new Set<OrchestratorAction>([
  "respond",
  "ask_clarification",
  "research",
  "draft_plan",
  "generate",
  "edit_existing",
  "stop",
])

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Lotus Build orchestrator. You decide the next best action for an AI website builder session based on full conversation context — not just the latest message.

Return ONLY valid JSON — no markdown, no extra text:
{
  "action": "respond" | "ask_clarification" | "research" | "draft_plan" | "generate" | "edit_existing" | "stop",
  "effectiveRequest": string,
  "assistantMessage": string | null,
  "questions": array | null,
  "needsResearch": boolean,
  "shouldDraftPlan": boolean,
  "reason": string
}

Rules:
- Read the entire conversation. Short replies like "yes", "yes please", "website", "simple as that" must be interpreted relative to the previous assistant question and prior user intent. Never restart with a generic "what would you like to build?" if context already exists.
- "effectiveRequest" must be the best consolidated build/edit request so far, incorporating all relevant user turns. If the user is still clarifying, keep effectiveRequest as the current best understanding.
- Use "respond" for greetings, advice, explanations, or when one natural conversational reply is enough and building is not ready.
- Use "ask_clarification" only when one focused question (or a small question set) is still required before build quality would suffer. Include 1-3 QuestionConfig objects in "questions" when using this action.
- Use "research" when external/reference context would materially improve the build and research has not completed yet.
- Use "draft_plan" when a build brief should be created before generation and planning has not completed yet.
- Use "generate" for a new build when enough context exists to proceed.
- Use "edit_existing" when the session already has project files and the user wants a targeted change.
- Use "stop" only if the user clearly wants to pause/cancel with no further action.
- Prefer moving forward over asking repetitive questions. Do not ask the same question twice.
- Question objects use: kind "single" | "multi" | "text", title, optional description, optional options [{ id, label, description? }], optional allowCustom/customPlaceholder.
- assistantMessage is required for "respond" and optional for "ask_clarification" (intro copy before questions).`

export function buildOrchestratorUserMessage(context: OrchestratorContext): string {
  const conversation = formatConversationForOrchestrator(context.conversationTurns)
  const timeline = summarizeTimelineForOrchestrator(context.timeline)

  return [
    `Original session prompt:\n${context.storedPrompt || "(none)"}`,
    `Latest user message:\n${context.currentMessage}`,
    `Conversation:\n${conversation}`,
    `Recent timeline:\n${timeline}`,
    `Project state:\n- hasExistingProject: ${context.phase.hasExistingProject}\n- fileCount: ${context.phase.fileCount}\n- previewAvailable: ${context.phase.previewAvailable}`,
    `Phase state:\n- effectiveRequest: ${context.phase.effectiveRequest}\n- researchCompleted: ${context.phase.researchCompleted}\n- planCompleted: ${context.phase.planCompleted}\n- planTextLength: ${context.phase.planText.trim().length}`,
  ].join("\n\n")
}

export function parseOrchestratorDecision(
  text: string,
  fallbackRequest: string,
  phase: OrchestratorPhaseState
): OrchestratorDecision {
  const parsed = extractJsonRecord(text)

  const action = VALID_ACTIONS.has(parsed?.action as OrchestratorAction)
    ? (parsed!.action as OrchestratorAction)
    : phase.hasExistingProject
      ? "edit_existing"
      : "generate"

  const effectiveRequest =
    typeof parsed?.effectiveRequest === "string" && parsed.effectiveRequest.trim()
      ? parsed.effectiveRequest.trim().slice(0, 12000)
      : fallbackRequest

  const assistantMessage =
    typeof parsed?.assistantMessage === "string" && parsed.assistantMessage.trim()
      ? parsed.assistantMessage.trim()
      : undefined

  const questions = sanitizeQuestions(parsed?.questions)

  return {
    action,
    effectiveRequest,
    assistantMessage,
    questions,
    needsResearch: Boolean(parsed?.needsResearch),
    shouldDraftPlan: Boolean(parsed?.shouldDraftPlan),
    reason:
      typeof parsed?.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 500)
        : "orchestrator_default",
  }
}

function sanitizeQuestions(raw: unknown): OrchestratorQuestion[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const questions = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const kind =
        record.kind === "single" || record.kind === "multi" || record.kind === "text"
          ? record.kind
          : null
      const title = typeof record.title === "string" ? record.title.trim() : ""
      if (!kind || !title) return null

      const options = Array.isArray(record.options)
        ? record.options
            .map((option) => {
              if (!option || typeof option !== "object") return null
              const opt = option as Record<string, unknown>
              const id = typeof opt.id === "string" ? opt.id.trim() : ""
              const label = typeof opt.label === "string" ? opt.label.trim() : ""
              if (!id || !label) return null
              return {
                id,
                label,
                ...(typeof opt.description === "string" && opt.description.trim()
                  ? { description: opt.description.trim() }
                  : {}),
              }
            })
            .filter((option): option is OrchestratorQuestionOption => Boolean(option))
        : undefined

      return {
        kind,
        title,
        ...(typeof record.description === "string" && record.description.trim()
          ? { description: record.description.trim() }
          : {}),
        ...(options?.length ? { options } : {}),
        ...(typeof record.allowCustom === "boolean" ? { allowCustom: record.allowCustom } : {}),
        ...(typeof record.customPlaceholder === "string" && record.customPlaceholder.trim()
          ? { customPlaceholder: record.customPlaceholder.trim() }
          : {}),
        ...(typeof record.placeholder === "string" && record.placeholder.trim()
          ? { placeholder: record.placeholder.trim() }
          : {}),
      } satisfies OrchestratorQuestion
    })
    .filter((question): question is OrchestratorQuestion => Boolean(question))
    .slice(0, 3)

  return questions.length ? questions : undefined
}

function extractJsonRecord(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const direct = JSON.parse(trimmed) as unknown
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>
    }
  } catch {}

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {}

  return null
}

export function shouldExitOrchestratorLoop(decision: OrchestratorDecision): boolean {
  return decision.action === "generate" || decision.action === "edit_existing"
}
