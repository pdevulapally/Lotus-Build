'use client'

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { WorkspaceTab } from '@/components/computer/session-types'
import {
  decideWorkspaceAutoOpen,
  type WorkspacePanelMode,
} from '@/lib/workspace-auto-open'

export function useAutoOpenWorkspace({
  isRunning,
  previewUrl,
  workspacePanel,
  activeTab,
  setWorkspacePanel,
  setActiveTab,
  userClosedRef,
}: {
  isRunning: boolean
  previewUrl: string | null
  workspacePanel: WorkspacePanelMode
  activeTab: WorkspaceTab
  setWorkspacePanel: Dispatch<SetStateAction<WorkspacePanelMode>>
  setActiveTab: Dispatch<SetStateAction<WorkspaceTab>>
  userClosedRef: MutableRefObject<boolean>
}) {
  const wasRunningRef = useRef(false)
  const previousPreviewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const decision = decideWorkspaceAutoOpen({
      isDesktop: window.matchMedia('(min-width: 640px)').matches,
      isRunning,
      wasRunning: wasRunningRef.current,
      previewUrl,
      previousPreviewUrl: previousPreviewUrlRef.current,
      workspacePanel,
      activeTab,
      userClosed: userClosedRef.current,
    })
    wasRunningRef.current = isRunning
    previousPreviewUrlRef.current = previewUrl
    if (decision.resetUserClosed) userClosedRef.current = false
    if (decision.workspacePanel && workspacePanel === 'closed') {
      setWorkspacePanel(decision.workspacePanel)
    }
    if (decision.activeTab) setActiveTab(decision.activeTab)
  }, [activeTab, isRunning, previewUrl, setActiveTab, setWorkspacePanel, userClosedRef, workspacePanel])
}
