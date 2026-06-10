export type ComputerSessionStatus =
  | "idle"
  | "understanding"
  | "researching"
  | "planning"
  | "running"
  | "building"
  | "previewing"
  | "fixing"
  | "blocked"
  | "complete"
  | "error"

export type ComputerPanel = "chat" | "workspace" | "activity" | "files" | "browser" | "preview"

export type ComputerArtifactType =
  | "research"
  | "screenshot"
  | "file"
  | "log"
  | "decision"
  | "warning"
  | "security"

export type ComputerTimelineEventStatus = "pending" | "running" | "complete" | "error" | "skipped"

export type ComputerTimelineEventKind =
  | "understanding"
  | "research"
  | "browser"
  | "planning"
  | "code"
  | "sandbox"
  | "fix"
  | "security"
  | "user"
  | "question"

export interface ComputerTimelineEvent {
  id: string
  title: string
  description?: string
  status: ComputerTimelineEventStatus
  kind: ComputerTimelineEventKind
  createdAt: string
  completedAt?: string
  runId?: string
  index?: number
  metadata?: Record<string, string | number | boolean | null>
}

export type ComputerConversationTurnSource =
  | "initial_prompt"
  | "composer"
  | "clarification"
  | "agent_decision"
  | "response"

export interface ComputerConversationTurn {
  role: "user" | "assistant"
  content: string
  source: ComputerConversationTurnSource
  createdAt: string
  runId?: string
}

export interface ComputerArtifact {
  id: string
  type: ComputerArtifactType
  title: string
  description?: string
  createdAt: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface ComputerSession {
  id: string
  projectId?: string
  ownerId: string
  prompt?: string
  previewUrl?: string | null
  status: ComputerSessionStatus
  activePanel: ComputerPanel
  timeline: ComputerTimelineEvent[]
  artifacts: ComputerArtifact[]
  createdAt: string
  updatedAt: string
}
