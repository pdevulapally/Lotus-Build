import {
  getEventTitle,
  type ComputerSessionResponse,
  type ComputerSessionStatus,
  type ComputerTimelineEvent,
} from "@/components/computer/session-types"

export type ComputerSessionProgress = {
  state: "active" | "idle" | "complete" | "error"
  label: string
  description: string
  detail?: string
  active: boolean
}

type ProgressInput = {
  session: Pick<ComputerSessionResponse, "timeline" | "agentRuntime" | "previewUrl">
  status: ComputerSessionStatus
  optimisticStart?: boolean
}

function latestTimelineEvent(events: ComputerTimelineEvent[], predicate?: (event: ComputerTimelineEvent) => boolean) {
  const matching = predicate ? events.filter(predicate) : events
  return matching
    .filter((event) => event.title !== "Session created")
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .at(-1)
}

function firstMeaningfulLine(value?: string | null) {
  return value
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean)
}

function getEventDetail(event?: ComputerTimelineEvent) {
  if (!event) return undefined
  const descriptionLine = event.description
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean)
  return descriptionLine || getEventTitle(event)
}

function titleFromRuntimePhase(phase?: string) {
  if (!phase || phase === "idle") return "Working"
  return phase
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function activeProgress(input: ProgressInput): ComputerSessionProgress {
  const latestRunning = latestTimelineEvent(input.session.timeline, (event) => event.status === "running")
  const latestEvent = latestRunning ?? latestTimelineEvent(input.session.timeline)
  const runtime = input.session.agentRuntime
  const label = latestRunning
    ? getEventTitle(latestRunning)
    : firstMeaningfulLine(runtime?.nextAction) ?? `${titleFromRuntimePhase(runtime?.phase)}...`
  const description = getEventDetail(latestRunning ?? latestEvent)
    ?? firstMeaningfulLine(runtime?.nextAction)
    ?? "Lotus is working through the current request."

  return {
    state: "active",
    label,
    description,
    detail: latestRunning ? firstMeaningfulLine(runtime?.nextAction) : getEventDetail(latestEvent),
    active: true,
  }
}

export function deriveComputerSessionProgress(input: ProgressInput): ComputerSessionProgress {
  const active = input.optimisticStart || input.status === "planning" || input.status === "running"
  if (active) return activeProgress(input)

  if (input.status === "error") {
    const message = firstMeaningfulLine(input.session.agentRuntime?.lastError)
      ?? getEventDetail(latestTimelineEvent(input.session.timeline, (event) => event.status === "error"))
      ?? "The agent hit an issue before finishing this run."
    return {
      state: "error",
      label: "Something went wrong",
      description: message,
      active: false,
    }
  }

  if (input.status === "complete" && input.session.previewUrl) {
    return {
      state: "complete",
      label: "Preview ready",
      description: "Your generated app is ready to review.",
      active: false,
    }
  }

  return {
    state: "idle",
    label: "Ready to build",
    description: "Send a message to start the agent.",
    active: false,
  }
}
