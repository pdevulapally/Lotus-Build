import type { WorkspaceTab } from '@/components/computer/session-types'

export type WorkspacePanelMode = 'closed' | 'split' | 'expanded'

export type WorkspaceAutoOpenInput = {
  isDesktop: boolean
  isRunning: boolean
  wasRunning: boolean
  previewUrl: string | null
  previousPreviewUrl: string | null
  workspacePanel: WorkspacePanelMode
  activeTab: WorkspaceTab
  userClosed: boolean
}

export type WorkspaceAutoOpenDecision = {
  resetUserClosed: boolean
  workspacePanel?: 'split'
  activeTab?: 'preview' | 'terminal'
}

export function decideWorkspaceAutoOpen(input: WorkspaceAutoOpenInput): WorkspaceAutoOpenDecision {
  if (!input.isDesktop) return { resetUserClosed: false }

  const runStarted = !input.wasRunning && input.isRunning
  const previewReady = input.previewUrl !== null && input.previewUrl !== input.previousPreviewUrl
  const userClosed = runStarted ? false : input.userClosed
  const canSwitchTab = input.activeTab === 'preview' || input.activeTab === 'terminal'
  const decision: WorkspaceAutoOpenDecision = { resetUserClosed: runStarted }

  if (runStarted) {
    if (input.workspacePanel === 'closed') decision.workspacePanel = 'split'
    if (input.previewUrl === null && canSwitchTab) decision.activeTab = 'terminal'
  }

  if (previewReady && !userClosed) {
    if (input.workspacePanel === 'closed') decision.workspacePanel = 'split'
    if (canSwitchTab) decision.activeTab = 'preview'
  }

  return decision
}
