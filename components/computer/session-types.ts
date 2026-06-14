import type { ProjectPlatform } from "@/lib/projects/platform"
import type {
  ComputerAgentRuntimeCheckpoint,
  ComputerConversationTurn,
} from "@/lib/computer-agent/types"

export type ComputerSessionStatus = "idle" | "planning" | "running" | "error" | "complete"

export type ComputerTimelineEvent = {
  id?: string
  title: string
  status: "pending" | "running" | "complete" | "error" | "skipped"
  kind?: "understanding" | "research" | "browser" | "planning" | "code" | "sandbox" | "fix" | "security" | "user" | "question"
  createdAt: string
  description?: string
  runId?: string
  index: number
  metadata?: Record<string, string | number | boolean | null>
}

export type ComputerSessionResponse = {
  id: string
  prompt?: string
  status: ComputerSessionStatus
  sessionMode?: string
  timeline: ComputerTimelineEvent[]
  conversationTurns?: ComputerConversationTurn[]
  agentRuntime?: ComputerAgentRuntimeCheckpoint
  previewUrl?: string | null
  projectId?: string
  platform?: ProjectPlatform
}

export type WorkspaceTab = "preview" | "browser" | "research"

export type BrowserInspection = {
  url: string
  liveUrl: string
  sessionId?: string
  baseUrl?: string
  provider?: string
  title: string
  expiresAt?: string
  isExpired: boolean
}

export type LocalMessage = {
  role: "user" | "system"
  content: string
  runId?: string
}

export const STATUS_LABELS: Record<ComputerSessionStatus, string> = {
  idle: "Ready",
  planning: "Thinking",
  running: "Thinking",
  error: "Error",
  complete: "Done",
}

const EVENT_TITLES: Record<string, string> = {
  "Run started": "Starting run",
  "Understanding request": "Reading request",
  "Understanding insight": "Understanding insight",
  "Planning execution": "Planning approach",
  "Planning failed": "Planning hit a snag",
  "Decision": "Deciding next step",
  "Web plan": "Planning web context",
  "Web skipped": "Web context skipped",
  "Researching web": "Researching",
  "Research complete": "Research complete",
  "Research insight": "Research insight",
  "Research failed": "Research failed",
  "Research skipped": "Research skipped",
  "Browser decision": "Choosing whether to inspect",
  "Browser live": "browser live",
  "Browser fallback": "Collecting page context",
  "Page inspected": "Page inspected",
  "Browser insight": "Browser insight",
  "Browser failed": "Browser failed",
  "Browser skipped": "Browser skipped",
  "Scrape context collected": "Page context collected",
  "Fallback scrape collected": "Fallback context collected",
  "Scrape failed": "Page context failed",
  "Generation decision": "Preparing build",
  "Build approach": "Build approach",
  "Code generated": "Application generated",
  "Generation failed": "Generation failed",
  "Fix applied": "Fix applied",
  "Fix failed": "Fix failed",
  "Starting sandbox": "Starting preview",
  "Preview ready": "Preview ready",
  "Sandbox run successful": "Preview running",
  "Sandbox error": "Preview error",
  "Runtime fix applied": "Runtime fix applied",
  "Runtime fix failed": "Runtime fix failed",
  "Run failed": "Run failed",
}

export function getEventTitle(event: ComputerTimelineEvent) {
  return EVENT_TITLES[event.title] || event.title
}

export function isTokenLimitError(message?: string | null) {
  return /insufficient tokens|out of credits|token limit|no credits/i.test(message || "")
}

export function getRunIdGroups(events: ComputerTimelineEvent[]): {
  firstRunId: string | null
  followUpRunIds: string[]
} {
  const visible = events.filter((e) => e.title !== "Session created")
  const firstRunId = visible.find((e) => e.runId)?.runId ?? null
  const seen = new Set<string>()
  const followUpRunIds: string[] = []
  for (const event of visible) {
    if (!event.runId || event.runId === firstRunId) continue
    if (!seen.has(event.runId)) {
      seen.add(event.runId)
      followUpRunIds.push(event.runId)
    }
  }
  return { firstRunId, followUpRunIds }
}

export function isBrowserLiveViewExpired(event: ComputerTimelineEvent) {
  const explicitExpiry = typeof event.metadata?.browserExpiresAt === "string" ? event.metadata.browserExpiresAt : ""
  const expiryTime = explicitExpiry ? Date.parse(explicitExpiry) : NaN
  if (Number.isFinite(expiryTime)) return Date.now() >= expiryTime

  const createdTime = Date.parse(event.createdAt)
  if (!Number.isFinite(createdTime)) return false
  return Date.now() - createdTime > 5 * 60 * 1000
}

export function getLatestBrowserInspection(events: ComputerTimelineEvent[]): BrowserInspection | null {
  const browserEvents = [...events].sort((a, b) => a.index - b.index).reverse()
  const found = browserEvents.find((e) =>
    e.kind === "browser" &&
    e.title !== "Browser live" &&
    typeof e.metadata?.targetUrl === "string" &&
    (e.metadata.targetUrl as string).startsWith("http")
  )
  if (!found?.metadata) return null
  const url = typeof found.metadata.targetUrl === "string" ? found.metadata.targetUrl : ""
  if (!url) return null
  const liveUrl =
    typeof found.metadata.browserLiveUrl === "string" && found.metadata.browserLiveUrl.startsWith("http")
      ? found.metadata.browserLiveUrl
      : ""
  return {
    url,
    liveUrl,
    sessionId: typeof found.metadata.browserSessionId === "string" ? found.metadata.browserSessionId : undefined,
    baseUrl: typeof found.metadata.browserBaseUrl === "string" ? found.metadata.browserBaseUrl : undefined,
    provider: typeof found.metadata.browserProvider === "string" ? found.metadata.browserProvider : undefined,
    expiresAt: typeof found.metadata.browserExpiresAt === "string" ? found.metadata.browserExpiresAt : undefined,
    isExpired: liveUrl ? isBrowserLiveViewExpired(found) : false,
    title: typeof found.metadata.pageTitle === "string" && found.metadata.pageTitle.trim() ? found.metadata.pageTitle : url,
  }
}
