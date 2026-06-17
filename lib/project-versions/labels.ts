import type { ComputerConversationTurn, ComputerTimelineEvent } from "@/lib/computer-agent/types"
import type { ProjectVersionSource } from "@/lib/project-versions/types"

const LABEL_MAX = 72

function truncate(text: string, max = LABEL_MAX): string {
  const trimmed = text.trim().replace(/\s+/g, " ")
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[^.!?]+[.!?]?/)
  return match ? match[0].trim() : trimmed
}

export function deriveVersionLabel(params: {
  runId?: string
  firstRunId?: string | null
  conversationTurns?: ComputerConversationTurn[]
  timeline?: ComputerTimelineEvent[]
  source?: ProjectVersionSource
  explicitLabel?: string
}): { label: string; summary?: string } {
  if (params.explicitLabel?.trim()) {
    return { label: truncate(params.explicitLabel) }
  }

  if (params.source === "restore") {
    return { label: "Saved before restore" }
  }

  if (params.source === "fix") {
    return { label: "After: automatic fix" }
  }

  const buildApproach = params.timeline?.find(
    (event) => event.runId === params.runId && event.title === "Build approach"
  )
  const summary = buildApproach?.description
    ? truncate(firstSentence(buildApproach.description), 160)
    : undefined

  const userTurn = params.conversationTurns?.find(
    (turn) => turn.role === "user" && turn.runId === params.runId
  )
  if (userTurn?.content?.trim()) {
    const prompt = truncate(userTurn.content)
    const isFirstRun = !params.firstRunId || params.runId === params.firstRunId
    if (isFirstRun) {
      return { label: "Initial build", summary }
    }
    return { label: `After: ${prompt}`, summary }
  }

  const isFirstRun = !params.firstRunId || params.runId === params.firstRunId
  if (isFirstRun) {
    return { label: "Initial build", summary }
  }

  if (summary) {
    return { label: truncate(summary), summary }
  }

  return { label: "Update", summary }
}
