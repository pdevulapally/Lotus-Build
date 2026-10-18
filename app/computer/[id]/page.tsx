"use client"




import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"



import Link from "next/link"



import { useParams } from "next/navigation"



import { currentBackend } from "@/lib/backend/browser"



import { useBackendSession } from "@/hooks/use-backend-session"



import { sendMessage, pendingMessageKey } from "@/lib/backend/send-message"
import { cancelSession } from "@/lib/backend/cancel-session"



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
  Loader2,
  Maximize2,
  Minimize2,
  Rocket,
  Search,
  X,
} from "lucide-react"



import { AnimatedAIInput } from "@/components/ui/animated-ai-input"



import { TokenLimitDialog } from "@/components/project/token-limit-dialog"



import { cn } from "@/lib/utils"



import { useAuth } from "@/contexts/auth-context"



import { DeployTerminal } from "@/components/project/deploy-terminal"



import { AgentFeed } from "@/components/computer/agent-feed"



import { ComputerTopBar, type ComputerTheme } from "@/components/computer/computer-top-bar"
import { ComputerNavigation } from "@/components/computer/computer-navigation"



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
  const id = typeof params?.id === 'string' ? params.id : ''
  const { user, userData, remainingTokens, loading: authLoading, getOptionalAuthHeader } = useAuth()
  const backend = useBackendSession(id, user, authLoading)
  const raw = backend.session
  const loading = authLoading || backend.loading
  const error = backend.error
  const effectiveStatus: ComputerSessionStatus = raw?.status === 'FAILED' ? 'error'
    : raw?.status === 'QUEUED' || raw?.status === 'RUNNING' ? 'running' : 'idle'
  const session: ComputerSessionResponse | null = raw && backend.project ? { id: raw.id, projectId: raw.projectId,
    status: effectiveStatus, sessionMode: raw.mode, timeline: backend.events,
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
  const [runError, setRunError] = useState<string | null>(null)
  const [isStartingRun, setIsStartingRun] = useState(false)
  const busyRef = useRef(false)
  const isRunning = effectiveStatus === 'running' || isStartingRun
  const optimisticStart = isStartingRun
  const isBuildTokenBlocked = false
  const [editText, setEditText] = useState('')
  const [computerTheme, setComputerTheme] = useState<ComputerTheme>('light')
  useEffect(() => { const value = localStorage.getItem(COMPUTER_THEME_KEY); if (value === 'light' || value === 'dark') setComputerTheme(value) }, [])
  const handleThemeToggle = () => setComputerTheme((value) => { const next = value === 'dark' ? 'light' : 'dark'; localStorage.setItem(COMPUTER_THEME_KEY, next); return next })
  const [deployOpen, setDeployOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
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
  const sessionProgress = session ? deriveComputerSessionProgress({ session, status: effectiveStatus }) : null
  const handleRun = async (prompt: string, nextMode?: 'build' | 'plan') => {
    if (busyRef.current) throw new Error('A message is already being submitted.')
    if (!raw || !user) throw new Error('Session is not available.')
    busyRef.current = true; setIsStartingRun(true); setRunError(null)
    try {
      await sendMessage(currentBackend(), sessionStorage, user.uid, raw.id, prompt, nextMode)
      void backend.refresh().catch((reason) => setRunError(`Message accepted, but history refresh failed: ${reason instanceof Error ? reason.message : 'Request failed.'}`))
    } catch (reason) {
      setRunError(reason instanceof Error ? reason.message : 'Could not send message.')
      throw reason
    } finally { busyRef.current = false; setIsStartingRun(false) }
  }
  const handleStop = async () => {
    if (!raw || !user || busyRef.current) return
    busyRef.current = true; setRunError(null)
    try { await cancelSession(currentBackend(), sessionStorage, user.uid, raw.id);
      void backend.refresh().catch((reason) => setRunError(`Cancellation accepted, but refresh failed: ${reason instanceof Error ? reason.message : 'Request failed.'}`)) }
    catch (reason) { setRunError(reason instanceof Error ? reason.message : 'Could not cancel session.') }
    finally { busyRef.current = false }
  }
  const requestPreviewRecovery = () => { backend.reconnect(); setPreviewNavSrc(null); setPreviewReloadNonce((value) => value + 1) }
  const showPlanApproval = raw?.mode === 'plan' && raw.status === 'IDLE' && backend.messages.some((message) => message.role === 'assistant')
  const handleApprovePlan = () => { void handleRun('Build the plan we just reviewed.', 'build').catch(() => { /* handleRun exposes the error in the feed. */ }) }
  const handleHistoryRestored = () => { void backend.refresh().catch((reason) => setRunError(String(reason))) }
  const handleClarificationAnswer = async (answer: string) => { await handleRun(answer) }

  if (loading) return <LoadingShell />
  if (error || !session || !backend.project) return <ErrorState message={error ?? "Session or project state is unavailable."} />

  const sessionPlatform = normalizePlatform(session.platform)
  const hasBrowser    = Boolean(browserInspection)
  const hasResearch   = session.timeline.some((e) => (e.kind === "research" || e.kind === "browser") && e.description?.trim())
  const deploymentLinks = getProjectDeploymentLinks(projectIntegration)
  const liveSiteUrl = deploymentLinks.netlify?.siteUrl || deploymentLinks.vercel?.siteUrl
  const planLabel = userData?.planId && userData.planId !== "free" ? userData.planId : "Free"

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] overflow-hidden bg-background font-sans text-foreground antialiased",
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
        onOpenNavigation={() => setMobileNavigationOpen(true)}
        navigationOpen={mobileNavigationOpen}
        workspacePanelOpen={workspacePanelOpen}
        onToggleWorkspacePanel={() => setWorkspacePanel(workspacePanelOpen ? "closed" : "split")}
        contextUsage={agentContextUsage}
        theme={computerTheme}
        onThemeToggle={handleThemeToggle}
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
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
          workspacePanel === "expanded" ? "hidden" : workspacePanelOpen && "hidden sm:flex sm:flex-[0_0_42%] lg:flex-[0_0_38%]",
        )}>
          {/* Feed scroll area */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="chat-scrollbar h-full overflow-y-auto">
              <div className="mx-auto w-full max-w-[792px] px-4 pb-8 pt-6 sm:px-6">
                <AgentFeed
                  prompt={firstPrompt} events={session.timeline}
                  canonicalMessages={backend.messages} queuedMessages={backend.queued} streamText={backend.text}
                  localMessages={localMessages} status={effectiveStatus}
                  progress={sessionProgress}
                  optimisticStart={optimisticStart}
                  editingIndex={null} editText=""




                  onClarificationAnswer={handleClarificationAnswer}
                  onApprovePlan={showPlanApproval ? handleApprovePlan : undefined}

                />
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="mx-auto w-full max-w-[792px] shrink-0 px-3 pt-2 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:pb-5 lg:px-4">
            {isBuildTokenBlocked && (
              <div className="mb-3 rounded-xl border border-border bg-muted px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">You have used all credits for this cycle.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upgrade your plan to continue running the computer agent.{" "}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">View plans</Link>
                </p>
              </div>
            )}
            {(runError || backend.streamError || backend.fileError) && !isBuildTokenBlocked && (
              <div className="mb-3 rounded-xl border border-destructive/25 bg-card px-3 py-2.5">
                <p className="text-xs leading-relaxed text-destructive">{getRunErrorMessage(runError || backend.streamError || backend.fileError || 'Live connection interrupted.')}</p>
                <button type="button" className="mt-1 text-xs underline" onClick={() => { setRunError(null); backend.reconnect() }}>Reconnect</button>
                <button type="button" className="ml-3 mt-1 text-xs underline" onClick={() => {
                  if (user) sessionStorage.removeItem(pendingMessageKey(user.uid, session.id)); setRunError(null)
                }}>Discard pending message</button>
              </div>
            )}
            <details className="mb-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer rounded-lg py-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Session usage</summary>
              {backend.usageError ? <p role="alert" className="mt-2 text-destructive">{backend.usageError}</p> : backend.usage === null ? <p role="status" className="mt-2">Loading usage…</p> : backend.usage.length === 0 ? <p className="mt-2">No usage recorded for this session.</p> : <dl className="mt-2 space-y-1">{backend.usage.map((meter) => <div key={meter.meterKey} className="flex justify-between gap-3"><dt>{meter.label}</dt><dd>{meter.settled.toLocaleString()} settled · {meter.open.toLocaleString()} reserved {meter.unit}</dd></div>)}</dl>}
            </details>
            <AnimatedAIInput
              mode="chat" compact compactSize="slim" appearance="assistant" initialModel={raw?.model}
              isLoading={isRunning} onStop={handleStop} onSubmit={(prompt) => handleRun(prompt)}
              placeholder="Ask LotusBuild about this project…"
              disabled={isBuildTokenBlocked}
            />
          </div>
        </aside>

        {/* ── Workspace panel ── */}
        <motion.section
          id="computer-preview-sidebar"
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
          "m-2 mt-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card",
        )}>
          <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2">
            <WorkspaceViewTabs activeTab={activeTab} onChange={setActiveTab} hasBrowser={hasBrowser} hasResearch={hasResearch} />
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={workspacePanel === "expanded" ? "Restore split view" : "Expand preview panel"} aria-pressed={workspacePanel === "expanded"} onClick={() => setWorkspacePanel(workspacePanel === "expanded" ? "split" : "expanded")} className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">
                {workspacePanel === "expanded" ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
              </button>
              <button type="button" aria-label="Close preview panel" onClick={() => { setWorkspacePanel("closed"); document.getElementById("computer-workspace-toggle")?.focus() }} className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></button>
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
