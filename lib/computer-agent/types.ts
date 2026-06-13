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

export type ComputerAgentRuntimePhase =
  | "idle"
  | "understanding"
  | "researching"
  | "planning"
  | "generating"
  | "previewing"
  | "fixing"
  | "paused"
  | "complete"
  | "error"

export type ComputerFollowUpIntent =
  | "resume_previous_work"
  | "new_instruction"
  | "edit_existing_project"
  | "answer_clarification"
  | "cancel_or_pause"

export interface ComputerAgentRuntimeCheckpoint {
  phase: ComputerAgentRuntimePhase
  lastCompletedPhase?: ComputerAgentRuntimePhase
  nextAction?: string
  effectiveRequest?: string
  planText?: string
  generatedFileCount?: number
  lastError?: string
  paused?: boolean
  stoppedAt?: string
  updatedAt: string
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
  conversationTurns?: ComputerConversationTurn[]
  agentRuntime?: ComputerAgentRuntimeCheckpoint
  artifacts: ComputerArtifact[]
  createdAt: string
  updatedAt: string
}
