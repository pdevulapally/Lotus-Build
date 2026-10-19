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
  desktopReady,
  workspacePanel,
  activeTab,
  setWorkspacePanel,
  setActiveTab,
  userClosedRef,
}: {
  isRunning: boolean
  previewUrl: string | null
  desktopReady: boolean
  workspacePanel: WorkspacePanelMode
  activeTab: WorkspaceTab
  setWorkspacePanel: Dispatch<SetStateAction<WorkspacePanelMode>>
  setActiveTab: Dispatch<SetStateAction<WorkspaceTab>>
  userClosedRef: MutableRefObject<boolean>
}) {
  const wasRunningRef = useRef(false)
  const previousPreviewUrlRef = useRef<string | null>(null)
  const previousDesktopReadyRef = useRef(false)

  useEffect(() => {
    const decision = decideWorkspaceAutoOpen({
      isDesktop: window.matchMedia('(min-width: 640px)').matches,
      isRunning,
      wasRunning: wasRunningRef.current,
      previewUrl,
      previousPreviewUrl: previousPreviewUrlRef.current,
      desktopReady,
      previousDesktopReady: previousDesktopReadyRef.current,
      workspacePanel,
      activeTab,
      userClosed: userClosedRef.current,
    })
    wasRunningRef.current = isRunning
    previousPreviewUrlRef.current = previewUrl
    previousDesktopReadyRef.current = desktopReady
    if (decision.resetUserClosed) userClosedRef.current = false
    if (decision.workspacePanel && workspacePanel === 'closed') {
      setWorkspacePanel(decision.workspacePanel)
    }
    if (decision.activeTab) setActiveTab(decision.activeTab)
  }, [activeTab, desktopReady, isRunning, previewUrl, setActiveTab, setWorkspacePanel, userClosedRef, workspacePanel])
}
