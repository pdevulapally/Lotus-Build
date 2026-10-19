import type { WorkspaceTab } from '@/components/computer/session-types'

export type WorkspacePanelMode = 'closed' | 'split' | 'expanded'

export type WorkspaceAutoOpenInput = {
  isDesktop: boolean
  isRunning: boolean
  wasRunning: boolean
  previewUrl: string | null
  previousPreviewUrl: string | null
  desktopReady: boolean
  previousDesktopReady: boolean
  workspacePanel: WorkspacePanelMode
  activeTab: WorkspaceTab
  userClosed: boolean
}

export type WorkspaceAutoOpenDecision = {
  resetUserClosed: boolean
  workspacePanel?: 'split'
  activeTab?: 'preview' | 'terminal' | 'desktop'
}

export function decideWorkspaceAutoOpen(input: WorkspaceAutoOpenInput): WorkspaceAutoOpenDecision {
  if (!input.isDesktop) return { resetUserClosed: false }

  const runStarted = !input.wasRunning && input.isRunning
  const previewReady = input.previewUrl !== null && input.previewUrl !== input.previousPreviewUrl
  const desktopReady = input.isRunning && input.desktopReady && !input.previousDesktopReady
  const userClosed = runStarted ? false : input.userClosed
  const canSwitchFromDesktop = input.activeTab === 'preview' || input.activeTab === 'terminal' || input.activeTab === 'desktop'
  const decision: WorkspaceAutoOpenDecision = { resetUserClosed: runStarted }

  if (runStarted) {
    if (input.workspacePanel === 'closed') decision.workspacePanel = 'split'
    if (input.previewUrl === null && (input.activeTab === 'preview' || input.activeTab === 'terminal')) decision.activeTab = 'terminal'
  }

  if ((previewReady || desktopReady) && !userClosed) {
    if (input.workspacePanel === 'closed') decision.workspacePanel = 'split'
    if (canSwitchFromDesktop) decision.activeTab = input.desktopReady ? 'desktop' : 'preview'
  }

  return decision
}
