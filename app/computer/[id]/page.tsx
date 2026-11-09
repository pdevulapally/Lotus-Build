"use client"




import { incompleteRunsShown, runEndUnrecorded } from '@/lib/backend/feed-incomplete'
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"



import Link from "next/link"



import { useParams, useSearchParams } from "next/navigation"



import { currentBackend } from "@/lib/backend/browser"



import { useBackendSession } from "@/hooks/use-backend-session"
import { useAutoOpenWorkspace } from "@/hooks/use-auto-open-workspace"



import { sendMessage, readPendingMessage } from "@/lib/backend/send-message"
import { ContinuationStatus } from "@/components/computer/continuation-status"
import { PendingInputCard } from "@/components/computer/pending-input-card"
import { RequestError } from "@/components/ui/request-error"
import { BackendError } from "@/lib/backend/client"
import { presentRequestError } from "@/lib/backend/error-presentation"
import { continueSession, readPendingContinuation, type ContinuationCommand } from "@/lib/backend/continue-session"
import { pendingCommandStorage } from "@/lib/backend/pending-storage"
import { cancelSession, pendingCancelKey } from "@/lib/backend/cancel-session"
import { approvePlan, editPlan, planAvailability } from "@/lib/backend/session-plan"
import type { PlanCardActions } from "@/components/computer/plan-card"
import type { ComputerSessionMode } from "@/lib/backend/session-modes"
import type { AttachmentRef } from "@/lib/backend/attachments"



import { AnimatePresence, motion } from "framer-motion"
import { duration, ease, spring } from "@/lib/motion"



import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Globe,
  GitBranch,
  KeyRound,
  Rocket,
  Search,
} from "lucide-react"



import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { CloseIcon, CollapseIcon, ExpandIcon } from "@/components/ui/lotus-icons"



import { TokenLimitDialog } from "@/components/project/token-limit-dialog"



import { cn } from "@/lib/utils"



import { useAuth } from "@/contexts/auth-context"



import { DeployTerminal } from "@/components/project/deploy-terminal"



import { AgentFeed } from "@/components/computer/agent-feed"
import { sessionLatency } from "@/lib/backend/latency"
import { VoiceControls } from "@/components/computer/voice-controls"
import { ConversationScrollArea } from "@/components/computer/conversation-scroll-area"



import { ComputerTopBar, type ComputerTheme } from "@/components/computer/computer-top-bar"
import { RepositoryDialog } from "@/components/computer/repository-dialog"
import { ComputerNavigation } from "@/components/computer/computer-navigation"
import styles from "@/components/computer/computer-workspace.module.css"



import { VersionHistoryPanel } from "@/components/computer/version-history-panel"



import { deriveComputerSessionProgress } from "@/components/computer/session-progress-model"



import {
  ErrorState,
  LoadingShell,
  WorkspaceContent,
  WorkspaceTabBar,
  WorkspaceViewTabs,
} from "@/components/computer/workspace-panel"



import {
  getLatestBrowserInspection,
  getRunIdGroups,
  isTokenLimitError,
  type BrowserInspection,
  type ComputerSessionResponse,
  type ComputerSessionStatus,
  type ComputerTimelineEvent,
  type LocalMessage,
  type WorkspaceTab,
} from "@/components/computer/session-types"



import { normalizePlatform } from "@/lib/projects/platform"



import type {
  ComputerAgentRuntimeCheckpoint,
  ComputerConversationTurn,
} from "@/lib/computer-agent/types"




// ─── Types ────────────────────────────────────────────────────────────────────

type MobileView = "feed" | "workspace"




type DeployProvider = "netlify" | "vercel"




type DeploymentLink = {
  siteUrl: string
  adminUrl?: string | null
}




type ComputerProjectIntegration = {
  name?: string
  files?: Array<{ path: string; content: string }>
  githubRepoUrl?: string
  githubRepoFullName?: string
  githubSyncedAt?: unknown
  netlifySiteUrl?: string
  netlifyAdminUrl?: string
  vercelSiteUrl?: string
  vercelDeployUrl?: string
  vercelDeploymentId?: string
  supabaseUrl?: string
  supabaseProjectRef?: string
  envVarNames?: string[]
}




// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRuntimeFixPrompt(
  error: { message: string; stack: string },
  files: Array<{ path: string; content: string }>
): string {
  // Parse every stack frame for filename + line number
  const framePattern = /\/([^/\s:()]+\.[a-zA-Z0-9]+):(\d+):\d+/g
  const frameMap = new Map<string, number>()
  for (const m of error.stack.matchAll(framePattern)) {
    const filename = m[1].toLowerCase()
    const line = parseInt(m[2], 10)
    if (!frameMap.has(filename)) frameMap.set(filename, line)
  }

  // Match project files by basename
  const matched = files.flatMap((f) => {
    const basename = f.path.split("/").pop()?.toLowerCase() ?? ""
    if (!basename || !frameMap.has(basename)) return []
    return [{ file: f, errorLine: frameMap.get(basename)! }]
  })

  // Total character budget split evenly across matched files
  const TOTAL_BUDGET = 14_000
  const perFileBudget = matched.length > 0 ? Math.floor(TOTAL_BUDGET / matched.length) : TOTAL_BUDGET

  const lines: string[] = [
    "A runtime JavaScript error occurred in the generated app. Find the exact line causing it and fix only that — do not rewrite unrelated code.",
    "",
    `Error: ${error.message}`,
    "",
    "Stack trace:",
    "```",
    error.stack,
    "```",
  ]

  if (matched.length > 0) {
    lines.push("", "Source files referenced in the stack:")
    for (const { file, errorLine } of matched) {
      const fileLines = file.content.split("\n")
      const totalLines = fileLines.length
      // Estimate lines we can afford given the budget (~80 chars avg per line)
      const contextRadius = Math.max(20, Math.floor(perFileBudget / 80 / 2))
      const start = Math.max(0, errorLine - contextRadius - 1)
      const end = Math.min(totalLines, errorLine + contextRadius)
      const snippet = fileLines
        .slice(start, end)
        .map((l, i) => `${start + i + 1} | ${l}`)
        .join("\n")
      const prefix = start > 0 ? `… lines 1–${start} omitted\n` : ""
      const suffix = end < totalLines ? `\n… lines ${end + 1}–${totalLines} omitted` : ""
      lines.push("", `File: ${file.path} (error near line ${errorLine})`, "```", prefix + snippet + suffix, "```")
    }
  }

  lines.push("", "Fix the broken code precisely. Output only the corrected file(s).")
  return lines.join("\n")
}



const COMPUTER_THEME_KEY = "lotus.computerTheme"




function getRunErrorMessage(message: string) {
  return isTokenLimitError(message)
    ? "You have used all credits for this cycle. Upgrade your plan to continue."
    : message
}




function getProjectDeploymentLinks(project?: ComputerProjectIntegration | null): Partial<Record<DeployProvider, DeploymentLink>> {
  const links: Partial<Record<DeployProvider, DeploymentLink>> = {}
  if (project?.netlifySiteUrl) {
    links.netlify = {
      siteUrl: project.netlifySiteUrl,
      adminUrl: project.netlifyAdminUrl,
    }
  }
  const vercelSiteUrl = project?.vercelSiteUrl || project?.vercelDeployUrl
  if (vercelSiteUrl) {
    links.vercel = {
      siteUrl: vercelSiteUrl,
      adminUrl: project?.vercelDeploymentId
        ? `https://vercel.com/dashboard/deployments/${project.vercelDeploymentId}`
        : null,
    }
  }
  return links
}





// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComputerPage() {
  const params = useParams()
  const openVoice = useSearchParams().get('voice') === '1'
  const id = typeof params?.id === 'string' ? params.id : ''
  const { user, userData, remainingTokens, loading: authLoading, getOptionalAuthHeader } = useAuth()
  const backend = useBackendSession(id, user, authLoading)
  const raw = backend.session
  const loading = authLoading || backend.loading
  const error = backend.error
  useEffect(() => {
    if (!user || loading || !backend.project || !raw) return
    const trace = sessionLatency(user.uid, id)
    trace.mark('workspace')
    if (backend.text || backend.liveLabel || backend.events.length) trace.mark('feedVisible')
  }, [user, id, loading, raw, backend.project, backend.text, backend.liveLabel, backend.events])
  const effectiveStatus: ComputerSessionStatus = raw?.status === 'FAILED' ? 'error' : raw?.status === 'STOPPED' ? 'stopped'
    : raw?.status === 'QUEUED' ? 'queued' : raw?.status === 'RUNNING' ? 'running' : 'idle'
  const session: ComputerSessionResponse | null = raw && backend.project ? { id: raw.id, projectId: raw.projectId,
    status: effectiveStatus, sessionMode: raw.mode, timeline: backend.events, execution: raw.execution,
    prompt: backend.messages[0]?.content, previewUrl: backend.preview, platform: backend.project.platform } : null
  const projectIntegration: ComputerProjectIntegration | null = backend.project ? { name: backend.project.name } : null
  const projectFileCount = backend.fileCount
  const hasProjectFiles = projectFileCount !== null && projectFileCount > 0
  const browserInspection: BrowserInspection | null = null
  const agentContextUsage = undefined
  const localMessages: LocalMessage[] = []
  const firstPrompt = backend.messages.find((message) => message.role === 'user')?.content
  const [workspacePanel, setWorkspacePanel] = useState<"closed" | "split" | "expanded">("closed")
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const workspacePanelOpen = workspacePanel !== "closed"
  const mobileView: MobileView = workspacePanelOpen ? "workspace" : "feed"
  const setMobileView = (view: MobileView) => setWorkspacePanel(view === "workspace" ? "split" : "closed")
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview')
  const [runError, setRunError] = useState<Error | string | null>(null)
  const [isStartingRun, setIsStartingRun] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<ReturnType<typeof readPendingMessage>>(null)
  const [pendingContinuation, setPendingContinuation] = useState<ReturnType<typeof readPendingContinuation>>(null)
  const [pendingCancellation, setPendingCancellation] = useState(false)
  const busyRef = useRef(false)
  const readPending = useCallback(() => {
    if (!user || !raw) return
    try {
      setPendingContinuation(readPendingContinuation(pendingCommandStorage(), user.uid, raw.id))
      setPendingMessage(readPendingMessage(pendingCommandStorage(), user.uid, raw.id))
      setPendingCancellation(pendingCommandStorage().getItem(pendingCancelKey(user.uid, raw.id)) !== null)
    } catch (reason) { setRunError(reason instanceof Error ? reason.message : 'Pending commands could not be read.') }
  }, [user, raw?.id])
  useEffect(() => { readPending(); window.addEventListener('storage', readPending); return () => window.removeEventListener('storage', readPending) }, [readPending])
  const isRunning = effectiveStatus === 'running' || effectiveStatus === 'queued'
  const isStopping = isRunning && backend.stopping
  const feedStatus: ComputerSessionStatus = effectiveStatus
  const optimisticStart = false
  const isBuildTokenBlocked = false
  const [editText, setEditText] = useState('')
  const [computerTheme, setComputerTheme] = useState<ComputerTheme>('dark')
  useEffect(() => { const value = localStorage.getItem(COMPUTER_THEME_KEY); if (value === 'light' || value === 'dark') setComputerTheme(value) }, [])
  const handleThemeToggle = () => setComputerTheme((value) => { const next = value === 'dark' ? 'light' : 'dark'; localStorage.setItem(COMPUTER_THEME_KEY, next); return next })
  const [deployOpen, setDeployOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [repositoryOpen, setRepositoryOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [tokenLimitModalOpen, setTokenLimitModalOpen] = useState(false)
  const [previewNavSrc, setPreviewNavSrc] = useState<string | null>(null)
  const [previewReloadNonce, setPreviewReloadNonce] = useState(0)
  const previewRetryNonce = 0
  const isEnsuringPreview = false
  const previewEnsureError = backend.streamError
  const [runtimeError, setRuntimeError] = useState<{ message: string; stack: string } | null>(null)
  const [fixingError, setFixingError] = useState(false)
  const userClosedRef = useRef(false)
  const sessionProgress = session ? deriveComputerSessionProgress({ session, status: effectiveStatus }) : null
  useAutoOpenWorkspace({
    isRunning,
    previewUrl: backend.preview,
    desktopReady: backend.desktop.status === 'ready',
    workspacePanel,
    activeTab,
    setWorkspacePanel,
    setActiveTab,
    userClosedRef,
  })
  useEffect(() => {
    if (backend.desktop.status === 'none' && activeTab === 'desktop') setActiveTab('preview')
  }, [activeTab, backend.desktop.status])
  const handleRun = async (prompt: string, nextMode?: ComputerSessionMode, attachments: AttachmentRef[] = [], originalInput?: { id: string; answer: string } | null) => {
    if (busyRef.current) throw new Error('A message is already being submitted.')
    if (!raw || !user) throw new Error('Session is not available.')
    busyRef.current = true; setIsStartingRun(true); setRunError(null)
    try {
      const request = raw.pendingInput
      if (originalInput === undefined && request?.kind === 'approval' && !['approve', 'reject'].includes(prompt)) throw new Error('Use Approve or Reject to answer this request.')
      await sendMessage(currentBackend(), pendingCommandStorage(), user.uid, raw.id, prompt, nextMode, attachments,
        originalInput === undefined ? (request === undefined ? undefined : { id: request.id, answer: prompt }) : originalInput ?? undefined)
      void backend.refresh().catch((reason) => setRunError(`Message accepted, but history refresh failed: ${reason instanceof Error ? reason.message : 'Request failed.'}`))
    } catch (reason) {
      // The composer shows the submit error itself; a second copy here would be noise.
      throw reason
    } finally { busyRef.current = false; setIsStartingRun(false); readPending() }
  }
  const handleStop = async () => {
    if (!raw || !user || busyRef.current) return
    busyRef.current = true; setRunError(null); setPendingCancellation(true)
    try { const accepted = await cancelSession(currentBackend(), pendingCommandStorage(), user.uid, raw.id, raw.execution); backend.applyState(accepted); setPendingCancellation(false);
      void backend.refresh().catch((reason) => setRunError(`Cancellation accepted, but refresh failed: ${reason instanceof Error ? reason.message : 'Request failed.'}`)) }
    catch (reason) {
      // A newer run started before the Stop landed: nothing was stopped, and that is not an error to show — just catch up with the server.
      if (reason instanceof BackendError && reason.code === 'session/execution-changed') { setPendingCancellation(false); void backend.refresh().catch(() => {}) }
      else setRunError(reason instanceof Error ? reason.message : 'Could not cancel session.')
    }
    finally { busyRef.current = false; readPending() }
  }
  const handleContinue = async (lane: 'premium' | 'fallback', original?: ContinuationCommand) => {
    if (!raw || !user || busyRef.current) return
    const state = raw.fallback
    let command: ContinuationCommand
    if (original) command = original
    else {
      const checkpointId = state?.checkpointId
      const model = lane === 'fallback' ? state?.offer?.model : raw.model
      const effort = lane === 'fallback' ? state?.offer?.effort : raw.effort
      if (!checkpointId || !state?.resumable || !model || !effort) { setRunError('This task has no verified continuation available.'); return }
      command = { lane, model, effort, checkpointId }
    }
    busyRef.current = true; setIsStartingRun(true); setRunError(null)
    try {
      await continueSession(currentBackend(), pendingCommandStorage(), user.uid, raw.id, command)
      await backend.refresh()
    } catch (reason) { setRunError(reason instanceof Error ? reason.message : 'Could not confirm this continuation.') }
    finally { busyRef.current = false; setIsStartingRun(false); readPending() }
  }
  const requestPreviewRecovery = () => { backend.reconnect(); setPreviewNavSrc(null); setPreviewReloadNonce((value) => value + 1) }
  const planState = planAvailability(raw)
  const runPlanCommand = async (label: string, command: () => Promise<unknown>) => {
    if (!raw || !user || busyRef.current) return
    busyRef.current = true; setPlanBusy(true); setRunError(null)
    try { await command(); await backend.refresh() }
    catch (reason) {
      // The plan moved on under this tab (another tab or the agent changed it): the refreshed card is the answer, not an error.
      if (reason instanceof BackendError && reason.code === 'plan/stale-revision') void backend.refresh().catch(() => {})
      else setRunError(reason instanceof Error ? reason.message : `Could not ${label}.`)
    } finally { busyRef.current = false; setPlanBusy(false) }
  }
  const planActions: PlanCardActions = {
    approvalRequired: planState.approvalRequired ?? false,
    canApprove: planState.canApprove, canEdit: planState.canEdit, busy: planBusy,
    onApprove: (revision) => { void runPlanCommand('approve the plan', async () => { if (raw && user) backend.applyState(await approvePlan(currentBackend(), pendingCommandStorage(), user.uid, raw.id, revision)) }) },
    onEdit: (revision, update) => { void runPlanCommand('update the plan', async () => { if (raw && user) await editPlan(currentBackend(), pendingCommandStorage(), user.uid, raw.id, revision, update) }) },
  }
  const handleHistoryRestored = () => { void backend.refresh().catch((reason) => setRunError(String(reason))) }
  const handleClarificationAnswer = async (answer: string) => { await handleRun(answer) }
  const closeWorkspacePanel = () => {
    userClosedRef.current = true
    setWorkspacePanel("closed")
  }
  const toggleWorkspacePanel = () => {
    if (workspacePanelOpen) {
      closeWorkspacePanel()
    } else {
      setWorkspacePanel("split")
    }
  }

  if (loading) return <LoadingShell theme={computerTheme} />
  if (error || !session || !backend.project) return <ErrorState theme={computerTheme} message={error ?? "Session or project state is unavailable."} />

  const sessionPlatform = normalizePlatform(session.platform)
  const hasBrowser    = Boolean(browserInspection)
  const hasResearch   = session.timeline.some((e) => (e.kind === "research" || e.kind === "browser") && e.description?.trim())
  const deploymentLinks = getProjectDeploymentLinks(projectIntegration)
  const liveSiteUrl = deploymentLinks.netlify?.siteUrl || deploymentLinks.vercel?.siteUrl
  const planLabel = userData?.planId && userData.planId !== "free" ? userData.planId : "Free"

  return (
    <div
      data-product-theme={computerTheme}
      className={cn(
        styles.shell,
        "relative flex h-[100dvh] overflow-hidden bg-card font-sans text-foreground antialiased",
        computerTheme === "dark" && "dark",
      )}
    >
      <a
        href="#computer-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        Skip to workspace
      </a>

      <ComputerNavigation currentProjectId={backend.project.id} mobileOpen={mobileNavigationOpen} onMobileOpenChange={setMobileNavigationOpen} onCurrentProjectChanged={() => { void backend.refresh().catch((reason) => setRunError(String(reason))) }} theme={computerTheme} />

      {/* ── App shell ── */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

      <ComputerTopBar
        session={session}
        sessionTitle={backend.project.name}
        firstPrompt={firstPrompt}
        projectIntegration={projectIntegration}
        projectFileCount={projectFileCount}
        remainingTokens={remainingTokens}
        planLabel={planLabel}
        liveSiteUrl={liveSiteUrl}
        isEditingTitle={isEditingTitle}
        titleDraft={titleDraft}
        titleSaving={titleSaving}
        titleError={titleError}
        onTitleDraftChange={setTitleDraft}
        onEditTitleStart={() => {
          setTitleDraft(projectIntegration?.name || firstPrompt || "")
          setTitleError(null)
          setIsEditingTitle(true)
        }}
        onEditTitleCancel={() => {
          setIsEditingTitle(false)
          setTitleError(null)
          setTitleDraft(firstPrompt || "")
        }}
        onTitleSave={async () => {
          if (!session) return
          const trimmed = titleDraft.trim()
          if (!trimmed) return
          setTitleSaving(true)
          setTitleError(null)
          try {
            if (!session.projectId) throw new Error("Project is missing.")
            await currentBackend().renameProject(session.projectId, trimmed)
            await backend.refresh()
            setIsEditingTitle(false)
          } catch {
            setTitleError("Could not save title. Please try again.")
          } finally {
            setTitleSaving(false)
          }
        }}
        onTitleError={setTitleError}


        onOpenHistory={() => {
          setHistoryOpen(true)
          setDeployOpen(false)
          setIntegrationsOpen(false)
        }}
        onOpenRepository={() => setRepositoryOpen(true)}
        repository={backend.project.source?.fullName}
        onOpenNavigation={() => setMobileNavigationOpen(true)}
        navigationOpen={mobileNavigationOpen}
        workspacePanelOpen={workspacePanelOpen}
        onToggleWorkspacePanel={toggleWorkspacePanel}
        contextUsage={agentContextUsage}
        theme={computerTheme}
        onThemeToggle={handleThemeToggle}
      />
      <RepositoryDialog
        open={repositoryOpen}
        projectId={backend.project.id}
        source={backend.project.source}
        dark={computerTheme === 'dark'}
        onClose={() => setRepositoryOpen(false)}
        onBound={(source) => backend.setProject((current) => (current ? { ...current, ...(source ? { source } : {}) , ...(source ? {} : { source: undefined }) } : current))}
      />

      {(deployOpen || historyOpen) && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-30 hidden bg-transparent sm:block"
          onClick={() => {
            setDeployOpen(false)
            setHistoryOpen(false)
          }}
        />
      )}

      <></>
      <></>

      <VersionHistoryPanel
        projectId={session.projectId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={handleHistoryRestored}
        getAuthHeader={getOptionalAuthHeader}
        variant="popover"
      />
      <VersionHistoryPanel
        projectId={session.projectId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={handleHistoryRestored}
        getAuthHeader={getOptionalAuthHeader}
        variant="sheet"
      />

      {/* ── Body ── */}
      <main
        id="computer-main"
        className="relative flex min-h-0 w-full flex-1 overflow-hidden"
        aria-label="Computer build workspace"
      >

        {/* ── Chat panel ── */}
        <aside
          aria-label="Agent conversation"
          className={cn(
          styles.conversation,
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card",
          workspacePanel === "expanded" ? "hidden" : workspacePanelOpen && "hidden lg:flex lg:flex-[0_0_38%]",
        )}>
          {/* Feed scroll area */}
          <ConversationScrollArea key={session.id}>
                <AgentFeed
                  prompt={firstPrompt} events={session.timeline}
                  canonicalMessages={backend.messages} queuedMessages={backend.queued} streamText={backend.text} liveLabel={backend.liveLabel} stopping={isStopping} stoppingSince={raw?.cancelRequestedAt ?? null}
                  localMessages={localMessages} status={feedStatus}
                  progress={sessionProgress}
                  optimisticStart={optimisticStart}
                  editingIndex={null} editText=""




                  onClarificationAnswer={handleClarificationAnswer}
                  incompleteRuns={incompleteRunsShown(raw?.feedIncomplete, session.timeline, raw?.execution, backend.incompleteRuns)}
                  endUnrecorded={raw !== null && runEndUnrecorded(raw.status, raw.execution, raw.runEnd)}
                  plan={raw?.plan ?? null} planActions={planActions}
                  delivery={raw?.delivery ?? null}

                />
          </ConversationScrollArea>

          {/* Composer */}
          <div className={cn(styles.composerDock, "mx-auto w-full max-w-[792px] shrink-0 px-3 pt-2 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:pb-5 lg:px-4")}>
            {isBuildTokenBlocked && (
              <div className="mb-3 rounded-xl border border-border bg-muted px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">You have used all credits for this cycle.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upgrade your plan to continue running the computer agent.{" "}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">View plans</Link>
                </p>
              </div>
            )}
            {(runError || backend.streamError || backend.fileError || raw?.error) && !isBuildTokenBlocked && (() => {
              const message = runError instanceof Error ? runError.message : (runError || backend.streamError || backend.fileError || raw?.error || 'Live connection interrupted.')
              const allowance = /allows (\d[\d,]*) (\S+) of (.+?), and (\d[\d,]*) \S+ of that is already used or held/i.exec(message)
              const limit = runError instanceof Error ? presentRequestError(runError).isQuota : allowance !== null || isTokenLimitError(message)
              // The continuation card already tells the story of this stop — the limit,
              // the wait, or why the free model could not finish — so the generic error
              // card would only contradict it. Transport problems still show while the
              // card is informational (running or finished).
              if (raw?.fallback !== undefined && raw.fallback.status !== 'RUNNING' && raw.fallback.status !== 'COMPLETED') return null
              const details = allowance === null ? undefined : { label: allowance[3], unit: allowance[2], limit: Number(allowance[1].replaceAll(',', '')), consumed: Number(allowance[4].replaceAll(',', '')), reserved: 0 }
              const error = runError instanceof Error ? runError : limit ? new BackendError(402, 'usage/limit-reached', message, undefined, details) : new Error(message)
              return <div className="mb-3">
                <RequestError error={error} planName={allowance?.[0] ? /^The (\S+) plan/.exec(message)?.[1] : undefined}>
                  {!limit && <button type="button" onClick={() => { setRunError(null); backend.reconnect() }}>Reconnect</button>}
                </RequestError>
              </div>
            })()}
            {backend.connection !== 'connected' && <p role="status" className="mb-2 text-xs text-muted-foreground">{backend.connection === 'offline' ? 'You are offline.' : 'Reconnecting...'} Showing the last confirmed task state. Accepted work runs on the server.</p>}
            {isStartingRun && <p role="status" className="mb-2 text-xs text-muted-foreground">Sending command. Waiting for confirmation...</p>}
            {pendingMessage && !isStartingRun && <p role="status" className="mb-2 text-xs text-muted-foreground">Message pending confirmation: {pendingMessage.prompt.slice(0, 160)}{' '}
              <button type="button" className="underline" onClick={() => { void handleRun(pendingMessage.prompt, pendingMessage.mode, pendingMessage.attachments, pendingMessage.inputResponse ?? null).catch(() => {}) }}>Retry original message</button>
            </p>}
            {pendingCancellation && <p role="status" className="mb-2 text-xs text-muted-foreground">Cancellation pending confirmation.{' '}
              <button type="button" className="underline" onClick={() => { void handleStop() }}>Retry cancellation</button>
            </p>}
            {pendingContinuation && <p role="status" className="mb-2 text-xs text-muted-foreground">Continuation pending confirmation.{' '}
              <button type="button" className="underline" onClick={() => { void handleContinue(pendingContinuation.lane, pendingContinuation) }}>Retry original continuation</button>
            </p>}
            {raw && <ContinuationStatus session={raw} busy={isStartingRun} onContinue={(lane) => { void handleContinue(lane) }} onCancel={() => { void handleStop() }} />}
            {raw?.pendingInput && <PendingInputCard key={raw.pendingInput.id}
              request={raw.pendingInput}
              busy={isStartingRun}
              onAnswer={(answer) => { void handleRun(answer).catch(() => {}) }}
            />}
            <VoiceControls key={`${user?.uid}:${raw?.id}`} session={raw} identity={user?.uid} refresh={backend.refresh} initiallyExpanded={openVoice}>
              {(voiceProps) => <AnimatedAIInput
                {...voiceProps}
                mode="chat" compact compactSize="slim" appearance="assistant" initialModel={raw?.model}
                wrapperClassName={cn(styles.composer, "!shadow-none focus-within:!border-ring")}
                isLoading={isRunning} isStopping={isStopping} onStop={handleStop} onSubmit={(prompt, _model, attachments) => handleRun(prompt, undefined, attachments)}
                placeholder="Ask LotusBuild about this project…"
                disabled={isBuildTokenBlocked || isStartingRun || raw?.pendingInput?.kind === 'approval' || (raw?.status === 'IDLE' && raw.fallback?.resumable === true)}
              />}
            </VoiceControls>
          </div>
        </aside>

        {/* ── Workspace panel ── */}
        <motion.section
          id="computer-preview-sidebar"
          data-state={workspacePanelOpen ? "open" : "closed"}
          aria-label="Workspace preview and files"
          initial={false}
          animate={workspacePanelOpen ? "open" : "closed"}
          variants={{
            open: { opacity: 1, x: 0, display: "flex", transition: spring },
            closed: {
              opacity: 0,
              x: 24,
              transitionEnd: { display: "none" },
              transition: { duration: duration.fast, ease },
            },
          }}
          className={cn(
          styles.preview,
          "m-2 mt-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card",
        )}>
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
            <WorkspaceViewTabs activeTab={activeTab} onChange={setActiveTab} hasBrowser={hasBrowser} hasResearch={hasResearch} hasDesktop={backend.desktop.status !== 'none'} />
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={workspacePanel === "expanded" ? "Restore split view" : "Expand preview panel"} aria-pressed={workspacePanel === "expanded"} onClick={() => setWorkspacePanel(workspacePanel === "expanded" ? "split" : "expanded")} className="hidden size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex">
                {workspacePanel === "expanded" ? <CollapseIcon className="size-4" /> : <ExpandIcon className="size-4" />}
              </button>
              <button type="button" aria-label="Close preview panel" onClick={() => { closeWorkspacePanel(); document.getElementById("computer-workspace-toggle")?.focus() }} className="hidden size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"><CloseIcon className="size-4" /></button>
            </div>
          </div>
          {/* Workspace content — fills panel edge to edge */}
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
              <WorkspaceTabBar
                activeTab={activeTab}
                previewUrl={session.previewUrl}
                onRefreshPreview={requestPreviewRecovery}
                onNavigatePreview={(url) => setPreviewNavSrc(url)}
              />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                id="computer-workspace-panel"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby={`workspace-tab-${activeTab}`}
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="min-h-0 flex-1 overflow-hidden"
              >
                <WorkspaceContent
                  session={session} status={effectiveStatus} activeTab={activeTab}
                  panelOpen={workspacePanelOpen}
                  progress={sessionProgress}
                  browserInspection={browserInspection}
                  hasProjectFiles={hasProjectFiles}
                  projectFileCount={projectFileCount}
                  isEnsuringPreview={isEnsuringPreview}
                  previewEnsureError={previewEnsureError}
                  onSwitchView={setActiveTab}
                  getAuthHeader={getOptionalAuthHeader}
                  runtimeError={runtimeError}
                  fixingError={fixingError}
                  onFixError={async () => {
                    if (!runtimeError || fixingError) return
                    setFixingError(true)
                    setMobileView("feed")
                    const fixPrompt = buildRuntimeFixPrompt(runtimeError, projectIntegration?.files ?? [])
                    setRuntimeError(null)
                    await handleRun(fixPrompt)
                    setFixingError(false)
                  }}
                  onDismissError={() => setRuntimeError(null)}
                  onRetryPreview={requestPreviewRecovery}
                  previewSyncNonce={previewRetryNonce}
                  previewSrc={previewNavSrc}
                  iframeReloadNonce={previewReloadNonce}
                  files={projectIntegration?.files ?? []}
                  codeTheme={computerTheme}
                  terminalEntries={backend.terminal}
                  desktop={backend.desktop}
                />
              </motion.div>
            </AnimatePresence>
            </div>
          </div>
        </motion.section>

      </main>
      </div>

      <TokenLimitDialog
        open={tokenLimitModalOpen}
        onOpenChange={setTokenLimitModalOpen}
        description="This workspace has no credits left in the current cycle. Upgrade to continue running the computer agent."
      />
      <></>
    </div>
  )
}
