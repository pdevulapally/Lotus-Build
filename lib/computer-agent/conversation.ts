import type { DocumentReference } from "firebase-admin/firestore"
import type { ComputerConversationTurn, ComputerConversationTurnSource } from "@/lib/computer-agent/types"

const MAX_TURNS = 40
const MAX_TURN_CHARS = 4000

export function sanitizeConversationTurns(raw: unknown): ComputerConversationTurn[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const record = item as Record<string, unknown>
      const role = record.role === "user" || record.role === "assistant" ? record.role : null
      const content = typeof record.content === "string" ? record.content.trim().slice(0, MAX_TURN_CHARS) : ""
      const source = sanitizeTurnSource(record.source)
      const createdAt =
        typeof record.createdAt === "string" && record.createdAt.trim()
          ? record.createdAt
          : new Date().toISOString()
      const runId = typeof record.runId === "string" ? record.runId : undefined

      if (!role || !content) return null

      return {
        role,
        content,
        source,
        createdAt,
        ...(runId ? { runId } : {}),
      } satisfies ComputerConversationTurn
    })
    .filter((turn): turn is ComputerConversationTurn => Boolean(turn))
    .slice(-MAX_TURNS)
}

function sanitizeTurnSource(raw: unknown): ComputerConversationTurnSource {
  const allowed: ComputerConversationTurnSource[] = [
    "initial_prompt",
    "composer",
    "clarification",
    "agent_decision",
    "response",
  ]
  return allowed.includes(raw as ComputerConversationTurnSource)
    ? (raw as ComputerConversationTurnSource)
    : "composer"
}

export function seedConversationFromPrompt(
  turns: ComputerConversationTurn[],
  storedPrompt: string
): ComputerConversationTurn[] {
  if (turns.length > 0 || !storedPrompt.trim()) return turns

  return [
    {
      role: "user",
      content: storedPrompt.trim().slice(0, MAX_TURN_CHARS),
      source: "initial_prompt",
      createdAt: new Date().toISOString(),
    },
  ]
}

export function appendConversationTurn(
  turns: ComputerConversationTurn[],
  turn: ComputerConversationTurn
): ComputerConversationTurn[] {
  return [...turns, turn].slice(-MAX_TURNS)
}

export function createConversationTurn(params: {
  role: ComputerConversationTurn["role"]
  content: string
  source: ComputerConversationTurnSource
  runId?: string
}): ComputerConversationTurn {
  return {
    role: params.role,
    content: params.content.trim().slice(0, MAX_TURN_CHARS),
    source: params.source,
    createdAt: new Date().toISOString(),
    ...(params.runId ? { runId: params.runId } : {}),
  }
}

export function formatConversationForOrchestrator(
  turns: ComputerConversationTurn[],
  limit = 16
): string {
  const recent = turns.slice(-limit)
  if (!recent.length) return "No prior conversation."

  return recent
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"} (${turn.source}): ${turn.content}`)
    .join("\n\n")
}

export function summarizeTimelineForOrchestrator(
  timeline: Array<{ title?: string; description?: string; kind?: string; status?: string }>,
  limit = 8
): string {
  const recent = timeline.slice(-limit)
  if (!recent.length) return "No prior run events."

  return recent
    .map((event) => {
      const title = typeof event.title === "string" ? event.title : "Event"
      const description =
        typeof event.description === "string" && event.description.trim()
          ? event.description.trim().slice(0, 240)
          : ""
      const kind = typeof event.kind === "string" ? event.kind : "unknown"
      const status = typeof event.status === "string" ? event.status : "unknown"
      return `- [${kind}/${status}] ${title}${description ? `: ${description}` : ""}`
    })
    .join("\n")
}

export async function persistConversationTurns(
  docRef: DocumentReference,
  turns: ComputerConversationTurn[]
) {
  await docRef.update({
    conversationTurns: turns.slice(-MAX_TURNS),
    updatedAt: new Date(),
  })
}
