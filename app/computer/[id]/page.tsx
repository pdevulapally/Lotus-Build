"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronDown,
  Database,
  ExternalLink,
  Github,
  KeyRound,
  Loader2,
  MessageSquare,
  Monitor,
  Rocket,
} from "lucide-react"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { TokenLimitDialog } from "@/components/project/token-limit-dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { DeployTerminal } from "@/components/project/deploy-terminal"
import { AgentFeed } from "@/components/computer/agent-feed"
import { ComputerTopBar } from "@/components/computer/computer-top-bar"
import { deriveComputerSessionProgress } from "@/components/computer/session-progress-model"
import {
  ErrorState,
  LoadingShell,
  WorkspaceContent,
  WorkspaceTabBar,
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

type DeployState = {
  provider: DeployProvider | null
  busy: boolean
  step: string
  logs: string[]
  error: string | null
  siteUrl: string | null
  adminUrl: string | null
}

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

type IntegrationAction = "github" | "supabase" | "env"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}...${id.slice(-4)}`
}

function normalizeStatus(status: unknown): ComputerSessionStatus {
  return status === "idle" || status === "planning" || status === "running" ||
    status === "error" || status === "complete" ? status : "idle"
}

function normalizeConversationTurns(value: unknown): ComputerConversationTurn[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const turn = item as Record<string, unknown>
    if ((turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string") return []
    return [{
      role: turn.role,
      content: turn.content,
      source: typeof turn.source === "string" ? turn.source as ComputerConversationTurn["source"] : "composer",
      createdAt: typeof turn.createdAt === "string" ? turn.createdAt : new Date().toISOString(),
      ...(typeof turn.runId === "string" ? { runId: turn.runId } : {}),
    }]
  })
}

function normalizeAgentRuntime(value: unknown): ComputerAgentRuntimeCheckpoint | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  return {
    phase: typeof record.phase === "string"
      ? record.phase as ComputerAgentRuntimeCheckpoint["phase"]
      : "idle",
    ...(typeof record.lastCompletedPhase === "string"
      ? { lastCompletedPhase: record.lastCompletedPhase as ComputerAgentRuntimeCheckpoint["lastCompletedPhase"] }
      : {}),
    ...(typeof record.nextAction === "string" ? { nextAction: record.nextAction } : {}),
    ...(typeof record.effectiveRequest === "string" ? { effectiveRequest: record.effectiveRequest } : {}),
    ...(typeof record.planText === "string" ? { planText: record.planText } : {}),
    ...(typeof record.generatedFileCount === "number" ? { generatedFileCount: record.generatedFileCount } : {}),
    ...(typeof record.lastError === "string" ? { lastError: record.lastError } : {}),
    ...(typeof record.paused === "boolean" ? { paused: record.paused } : {}),
    ...(typeof record.stoppedAt === "string" ? { stoppedAt: record.stoppedAt } : {}),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  }
}

const STOPPED_COMPUTER_SESSIONS_KEY = "lotus.stoppedComputerSessions"

function readStoppedComputerSessions(): string[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STOPPED_COMPUTER_SESSIONS_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []
  } catch {
    return []
  }
}

function writeStoppedComputerSessions(sessionIds: Set<string>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STOPPED_COMPUTER_SESSIONS_KEY, JSON.stringify([...sessionIds]))
}

function normalizeTimeline(timeline: unknown): ComputerTimelineEvent[] {
  if (!Array.isArray(timeline)) return []
  return timeline
    .map((e, i) => ({ ...(e as ComputerTimelineEvent), index: typeof (e as { index?: unknown }).index === "number" ? (e as { index: number }).index : i }))
    .sort((a, b) => a.index - b.index)
}

function getRunErrorMessage(message: string) {
  return isTokenLimitError(message)
    ? "You have used all credits for this cycle. Upgrade your plan to continue."
    : message
}

function normalizePreviewEnsureError(value: unknown) {
  const rawMessage = value instanceof Error ? value.message : String(value || "")
  const jsonMatch = rawMessage.match(/\{[\s\S]*\}/)
  let nestedError = ""

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { error?: unknown }
      nestedError = typeof parsed.error === "string" ? parsed.error : ""
    } catch {}
  }

  const message = `${rawMessage}\n${nestedError}`.toLowerCase()
  const messages = [
    {
      matches: [/missing package\.json/, /project has no files/],
      copy: "The preview is not ready yet because the generated app is missing required project files.",
    },
    {
      matches: [/missing-import/, /failed to resolve import/, /missing import/],
      copy: "The preview could not start because the app still has an unresolved import.",
    },
    {
      matches: [/dev server/, /preview did not become ready/, /sandbox/],
      copy: "The preview runtime could not be restored right now.",
    },
  ]

  return messages.find((item) => item.matches.some((pattern) => pattern.test(message)))?.copy
    ?? "The preview could not be restored right now."
}

function getTokenLimitEvent(events: ComputerTimelineEvent[]) {
  return events.find((event) =>
    event.status === "error" &&
    (isTokenLimitError(event.description) || isTokenLimitError(event.title))
  )
}

const INITIAL_DEPLOY_STATE: DeployState = {
  provider: null,
  busy: false,
  step: "",
  logs: [],
  error: null,
  siteUrl: null,
  adminUrl: null,
}

function getDeployProviderLabel(provider: DeployProvider) {
  return provider === "netlify" ? "Netlify" : "Vercel"
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

function getDeployErrorMessage(value: unknown) {
  const message = String(value || "Deploy failed")
  if (/netlify not connected/i.test(message)) {
    return "Netlify is not connected. Starting Netlify connection..."
  }
  if (/vercel not connected/i.test(message)) {
    return "Vercel is not connected for this project. Add a Vercel token in project integrations, then deploy again."
  }
  return message
}

function formatSyncedAt(value: unknown) {
  if (!value) return ""
  const date = typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString()
}

// ─── Deploy + integrations ────────────────────────────────────────────────────

function DeployButton({
  projectId,
  open,
  state,
  deploymentLinks,
  onOpenChange,
  onDeploy,
  headless = false,
}: {
  projectId?: string
  open: boolean
  state: DeployState
  deploymentLinks?: Partial<Record<DeployProvider, DeploymentLink>>
  onOpenChange: (open: boolean) => void
  onDeploy: (provider: DeployProvider) => void
  headless?: boolean
}) {
  if (!projectId) return null
  const visibleStateSiteUrl = state.siteUrl || (state.provider ? deploymentLinks?.[state.provider]?.siteUrl ?? null : null)
  const hasStoredDeployments = Boolean(deploymentLinks?.netlify?.siteUrl || deploymentLinks?.vercel?.siteUrl)

  return (
    <div className={cn("relative", headless && !open && "hidden")}>
      {!headless && (
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        disabled={state.busy}
        aria-label="Deploy project"
        aria-expanded={open}
        className={cn(
          "group inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:px-3 sm:text-[13px]",
          open
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 sm:hover:shadow-md"
        )}
      >
        {state.busy
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Rocket className="h-3.5 w-3.5" />}
        <span>Deploy</span>
      </button>
      )}

      {open && (
        <div className={cn(
          "z-30 hidden w-[480px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 shadow-[0_24px_70px_-32px_var(--primary)] sm:block",
          headless ? "fixed right-6 top-16" : "absolute right-0 top-11",
        )}>
          <div className="px-1 pb-2">
            <p className="text-[12px] font-semibold text-foreground">Publish this project</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Deploy directly from this generated project.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["netlify", "vercel"] as DeployProvider[]).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => onDeploy(provider)}
                disabled={state.busy}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-[12px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {getDeployProviderLabel(provider)}
              </button>
            ))}
          </div>
          {hasStoredDeployments && (
            <div className="mt-2 space-y-1.5">
              {(["netlify", "vercel"] as DeployProvider[]).map((provider) => {
                const link = deploymentLinks?.[provider]
                if (!link?.siteUrl) return null
                return (
                  <a
                    key={provider}
                    href={link.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-muted"
                  >
                    <span className="truncate">{getDeployProviderLabel(provider)} live site</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                )
              })}
            </div>
          )}

          {(state.step || state.error || visibleStateSiteUrl) && (
            <div className="mt-2 rounded-xl border border-border bg-secondary p-2.5">
              <div className="flex items-center gap-1.5">
                {state.busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
                  {state.provider ? getDeployProviderLabel(state.provider) : "Deploy"}
                  {state.step ? ` - ${state.step}` : ""}
                </p>
              </div>
              {state.error && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-destructive">{state.error}</p>
              )}
                <DeployTerminal 
                  logs={state.logs}
                  currentStep={state.step}
                  className="mt-1.5"
                />
              {visibleStateSiteUrl && (
                <a
                  href={visibleStateSiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-[11px] font-bold text-success-foreground transition-all hover:bg-success/90 active:scale-[0.98]"
                >
                  <span>Open live site</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IntegrationsButton({
  projectId,
  project,
  open,
  busy,
  message,
  envValues,
  onOpenChange,
  onGithubSync,
  onSupabaseSetup,
  onEnvChange,
  onEnvAdd,
  onEnvSave,
  headless = false,
}: {
  projectId?: string
  project: ComputerProjectIntegration | null
  open: boolean
  busy: IntegrationAction | null
  message: string
  envValues: Record<string, string>
  onOpenChange: (open: boolean) => void
  onGithubSync: () => void
  onSupabaseSetup: () => void
  onEnvChange: (key: string, value: string) => void
  onEnvAdd: (key: string, value: string) => void
  onEnvSave: () => void
  headless?: boolean
}) {
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvValue, setNewEnvValue] = useState("")
  if (!projectId) return null

  const envNames = project?.envVarNames || []
  const hasGitHub = Boolean(project?.githubRepoUrl || project?.githubRepoFullName)
  const hasSupabase = Boolean(project?.supabaseUrl || project?.supabaseProjectRef)
  const syncedAt = formatSyncedAt(project?.githubSyncedAt)

  return (
    <div className={cn("relative", headless && !open && "hidden")}>
      {!headless && (
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Project integrations"
        aria-expanded={open}
        className={cn(
          "group hidden h-9 items-center justify-center gap-1.5 rounded-full border text-[13px] font-medium transition-all duration-200 active:scale-[0.98] sm:inline-flex sm:w-auto sm:px-3",
          open
            ? "bg-card text-foreground shadow-sm sm:border-border-strong sm:bg-muted"
            : "text-muted-foreground hover:bg-card hover:text-foreground sm:border-border sm:bg-card sm:hover:border-border-strong sm:hover:bg-muted"
        )}
      >
        <KeyRound className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Integrations</span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 opacity-50 transition-transform duration-200 sm:block", open && "rotate-180")} />
      </button>
      )}

      {open && (
        <div className={cn(
          "z-30 hidden w-[360px] rounded-2xl border border-border bg-card p-3 shadow-[0_24px_70px_-32px_var(--primary)] sm:block",
          headless ? "fixed right-6 top-16" : "absolute right-0 top-11",
        )}>
          <div className="mb-3">
            <p className="text-[12px] font-semibold text-foreground">Project integrations</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Connect services directly to this generated website.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="rounded-xl border border-border bg-background p-3 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] font-semibold text-foreground">GitHub</p>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {hasGitHub ? project?.githubRepoFullName || project?.githubRepoUrl : "Create or update a repository"}
                  </p>
                  {syncedAt ? <p className="mt-0.5 text-[10.5px] text-muted-foreground/70">Last synced {syncedAt}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onGithubSync}
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {busy === "github" ? "Syncing..." : hasGitHub ? "Sync" : "Publish"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-3 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[12px] font-semibold text-foreground">Supabase</p>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {hasSupabase ? project?.supabaseProjectRef || project?.supabaseUrl : "Provision database and app credentials"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSupabaseSetup}
                  disabled={busy !== null}
                  className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy === "supabase" ? "Setting up..." : hasSupabase ? "Re-run" : "Set up"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[12px] font-semibold text-foreground">Environment variables</p>
              </div>
              <div className="mt-2 space-y-2">
                {envNames.map((name) => (
                  <label key={name} className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{name}</span>
                    <input
                      value={envValues[name] || ""}
                      onChange={(event) => onEnvChange(name, event.target.value)}
                      placeholder="Value"
                      className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:border-ring"
                    />
                  </label>
                ))}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={newEnvKey}
                    onChange={(event) => setNewEnvKey(event.target.value)}
                    placeholder="KEY"
                    className="h-8 min-w-0 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:border-ring"
                  />
                  <input
                    value={newEnvValue}
                    onChange={(event) => setNewEnvValue(event.target.value)}
                    placeholder="Value"
                    className="h-8 min-w-0 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:border-ring"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const key = newEnvKey.trim()
                      if (!key) return
                      onEnvAdd(key, newEnvValue)
                      setNewEnvKey("")
                      setNewEnvValue("")
                    }}
                    disabled={busy !== null || !newEnvKey.trim()}
                    className="rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onEnvSave}
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {busy === "env" ? "Saving..." : "Save and update preview"}
                </button>
              </div>
            </div>
          </div>

          {message ? (
            <p className="mt-3 rounded-xl border border-border bg-secondary px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function MobileDeploySheet({
  open,
  state,
  deploymentLinks,
  onClose,
  onDeploy,
}: {
  open: boolean
  state: DeployState
  deploymentLinks?: Partial<Record<DeployProvider, DeploymentLink>>
  onClose: () => void
  onDeploy: (provider: DeployProvider) => void
}) {
  if (!open) return null
  const visibleStateSiteUrl = state.siteUrl || (state.provider ? deploymentLinks?.[state.provider]?.siteUrl ?? null : null)
  return (
    <div className="fixed inset-x-3 bottom-[5.6rem] z-50 max-h-[min(72dvh,32rem)] overflow-y-auto rounded-[1.45rem] border border-border bg-card p-3 shadow-[0_24px_80px_-32px_var(--primary)] [scrollbar-width:thin] sm:hidden">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Deploy website</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Publish this generated project.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span className="text-base leading-none">×</span>
        </button>
      </div>
      <div className="space-y-2">
        {(["netlify", "vercel"] as DeployProvider[]).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => onDeploy(provider)}
            disabled={state.busy}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-3.5 py-3 text-left text-[13px] font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-muted disabled:opacity-60"
          >
            <span>{getDeployProviderLabel(provider)}</span>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      {visibleStateSiteUrl && (
        <a href={visibleStateSiteUrl} target="_blank" rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-success py-3 text-[12px] font-bold text-success-foreground transition-colors hover:bg-success/90">
          Open live site
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {(state.step || state.error) && (
        <div className="mt-3 rounded-2xl border border-border bg-secondary p-3">
          <div className="flex items-center gap-1.5">
            {state.busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <p className="min-w-0 truncate text-[12px] font-medium text-muted-foreground">
              {state.provider ? getDeployProviderLabel(state.provider) : "Deploy"}{state.step ? ` - ${state.step}` : ""}
            </p>
          </div>
          {state.error && <p className="mt-2 text-[11px] leading-relaxed text-destructive">{state.error}</p>}
        </div>
      )}
    </div>
  )
}

function MobileIntegrationsSheet({
  open,
  project,
  busy,
  message,
  onClose,
  onGithubSync,
  onSupabaseSetup,
}: {
  open: boolean
  project: ComputerProjectIntegration | null
  busy: IntegrationAction | null
  message: string
  onClose: () => void
  onGithubSync: () => void
  onSupabaseSetup: () => void
}) {
  if (!open) return null
  const hasGitHub = Boolean(project?.githubRepoUrl || project?.githubRepoFullName)
  const hasSupabase = Boolean(project?.supabaseUrl || project?.supabaseProjectRef)
  return (
    <div className="fixed inset-x-3 bottom-[5.6rem] z-50 max-h-[min(72dvh,32rem)] overflow-y-auto rounded-[1.45rem] border border-border bg-card p-3 shadow-[0_24px_80px_-32px_var(--primary)] [scrollbar-width:thin] sm:hidden">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Integrations</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Connect services to this website.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span className="text-base leading-none">×</span>
        </button>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onGithubSync}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-muted disabled:opacity-60"
        >
          <span>
            <span className="block text-[13px] font-semibold text-foreground">GitHub</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{hasGitHub ? project?.githubRepoFullName || "Repository connected" : "Publish repository"}</span>
          </span>
          <Github className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onSupabaseSetup}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-muted disabled:opacity-60"
        >
          <span>
            <span className="block text-[13px] font-semibold text-foreground">Supabase</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{hasSupabase ? project?.supabaseProjectRef || "Database connected" : "Provision database"}</span>
          </span>
          <Database className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {message ? (
        <p className="mt-3 rounded-2xl border border-border bg-secondary px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComputerPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : ""
  const { user, userData, remainingTokens, loading: authLoading, getOptionalAuthHeader } = useAuth()
  // ── State (all unchanged) ─────────────────────────────────────────────────
  const [session,           setSession]           = useState<ComputerSessionResponse | null>(null)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState<string | null>(null)
  const [mobileView,        setMobileView]        = useState<MobileView>("feed")
  const [localMessages,     setLocalMessages]     = useState<LocalMessage[]>([])
  const [isStartingRun,     setIsStartingRun]     = useState(false)
  const [runError,          setRunError]          = useState<string | null>(null)
  const [optimisticStart,   setOptimisticStart]   = useState(false)
  const [activeTab,         setActiveTab]         = useState<WorkspaceTab>("preview")
  const [editingMsgIndex,   setEditingMsgIndex]   = useState<number | null>(null)
  const [editText,          setEditText]          = useState("")
  const [deployOpen,        setDeployOpen]        = useState(false)
  const [deployState,       setDeployState]       = useState<DeployState>(INITIAL_DEPLOY_STATE)
  const [integrationsOpen,  setIntegrationsOpen]  = useState(false)
  const [integrationBusy,   setIntegrationBusy]   = useState<IntegrationAction | null>(null)
  const [integrationMessage,setIntegrationMessage]= useState("")
  const [projectIntegration,setProjectIntegration]= useState<ComputerProjectIntegration | null>(null)
  const [envValues,         setEnvValues]         = useState<Record<string, string>>({})
  const [isEditingTitle,    setIsEditingTitle]    = useState(false)
  const [titleDraft,        setTitleDraft]        = useState("")
  const [titleSaving,       setTitleSaving]       = useState(false)
  const [titleError,        setTitleError]        = useState<string | null>(null)
  const [tokenLimitModalOpen, setTokenLimitModalOpen] = useState(false)
  const [isEnsuringPreview, setIsEnsuringPreview] = useState(false)
  const [previewEnsureError, setPreviewEnsureError] = useState<string | null>(null)
  const [previewRetryNonce, setPreviewRetryNonce] = useState(0)
  const [runtimeError,      setRuntimeError]      = useState<{ message: string; stack: string } | null>(null)
  const [fixingError,       setFixingError]       = useState(false)
  const [stoppedSessionIds, setStoppedSessionIds] = useState<Set<string>>(() => new Set(readStoppedComputerSessions()))
  const hasStartedRef = useRef(false)
  const runAbortRef = useRef<AbortController | null>(null)
  const previousPreviewUrlRef = useRef<string | null | undefined>(undefined)
  const previewEnsureKeyRef = useRef<string | null>(null)
  const prevSessionStatusRef = useRef<ComputerSessionStatus | null>(null)
  const prevMobileSyncStatusRef = useRef<ComputerSessionStatus | null>(null)
  const lastCodeEventCountRef = useRef(0)

  // ── Firestore listener (unchanged) ────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user || !id) { setError("Session not found or access denied."); setLoading(false); return }
    setLoading(true); setError(null)
    const unsub = onSnapshot(
      doc(db, "computerSessions", id),
      (snap) => {
        if (!snap.exists()) { setSession(null); setError("Session not found or access denied."); setLoading(false); return }
        const d = snap.data()
        // Ownership check — deny access if session belongs to a different user
        if (d.ownerId && d.ownerId !== user.uid) {
          setSession(null); setError("Session not found or access denied."); setLoading(false); return
        }
        const conversationTurns = normalizeConversationTurns(d.conversationTurns)
        setSession({
          id: snap.id,
          prompt:    typeof d.prompt    === "string" ? d.prompt    : undefined,
          status:    normalizeStatus(d.status),
          timeline:  normalizeTimeline(d.timeline),
          conversationTurns,
          agentRuntime: normalizeAgentRuntime(d.agentRuntime),
          previewUrl: typeof d.previewUrl === "string" ? d.previewUrl : null,
          projectId:  typeof d.projectId  === "string" ? d.projectId  : undefined,
          platform: normalizePlatform(d.platform),
        })
        setLocalMessages(
          conversationTurns
            .filter((turn) => turn.role === "user" && turn.source === "composer")
            .map((turn) => ({ role: "user", content: turn.content, runId: turn.runId }))
        )
        setError(null); setLoading(false)
      },
      () => { setSession(null); setError("Failed to load session."); setLoading(false) }
    )
    return () => unsub()
  }, [authLoading, id, user, setError, setLoading, setSession])

  useEffect(() => {
    const projectId = session?.projectId
    if (!projectId) {
      setProjectIntegration(null)
      return
    }

    const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
      if (!snap.exists()) {
        setProjectIntegration(null)
        return
      }
      const data = snap.data() as ComputerProjectIntegration
      setProjectIntegration((current) => {
        const savedEnvNames = Array.isArray(data.envVarNames) ? data.envVarNames.filter((name): name is string => typeof name === "string") : []
        return {
          name: typeof data.name === "string" ? data.name : undefined,
          files: Array.isArray(data.files)
            ? data.files.filter((file): file is { path: string; content: string } =>
                typeof file?.path === "string" && typeof file?.content === "string"
              )
            : undefined,
          githubRepoUrl: typeof data.githubRepoUrl === "string" ? data.githubRepoUrl : undefined,
          githubRepoFullName: typeof data.githubRepoFullName === "string" ? data.githubRepoFullName : undefined,
          githubSyncedAt: data.githubSyncedAt,
          netlifySiteUrl: typeof data.netlifySiteUrl === "string" ? data.netlifySiteUrl : undefined,
          netlifyAdminUrl: typeof data.netlifyAdminUrl === "string" ? data.netlifyAdminUrl : undefined,
          vercelSiteUrl: typeof data.vercelSiteUrl === "string" ? data.vercelSiteUrl : undefined,
          vercelDeployUrl: typeof data.vercelDeployUrl === "string" ? data.vercelDeployUrl : undefined,
          vercelDeploymentId: typeof data.vercelDeploymentId === "string" ? data.vercelDeploymentId : undefined,
          supabaseUrl: typeof data.supabaseUrl === "string" ? data.supabaseUrl : undefined,
          supabaseProjectRef: typeof data.supabaseProjectRef === "string" ? data.supabaseProjectRef : undefined,
          envVarNames: Array.from(new Set([...(current?.envVarNames || []), ...savedEnvNames])),
        }
      })
    })
    return () => unsub()
  }, [session?.projectId, setProjectIntegration])

  useEffect(() => {
    const projectId = session?.projectId
    if (!projectId) return

    let cancelled = false
    void (async () => {
      try {
        const auth = await getOptionalAuthHeader()
        const [requiredRes, savedRes] = await Promise.all([
          fetch(`/api/env-vars/required?projectId=${encodeURIComponent(projectId)}`, { headers: auth }),
          fetch(`/api/env-vars/names?projectId=${encodeURIComponent(projectId)}`, { headers: auth }),
        ])
        const requiredJson = await requiredRes.json().catch(() => ({})) as { requiredEnvVars?: string[] }
        const savedJson = await savedRes.json().catch(() => ({})) as { envVarNames?: string[] }
        const names = Array.from(new Set([
          ...(Array.isArray(requiredJson.requiredEnvVars) ? requiredJson.requiredEnvVars : []),
          ...(Array.isArray(savedJson.envVarNames) ? savedJson.envVarNames : []),
        ].filter((name): name is string => typeof name === "string" && Boolean(name.trim()))))
        if (!cancelled) {
          setProjectIntegration((current) => ({
            ...(current || {}),
            envVarNames: names,
          }))
          setEnvValues((current) => names.reduce<Record<string, string>>((next, name) => {
            next[name] = current[name] || ""
            return next
          }, {}))
        }
      } catch {
        // Env hints are helpful, not required for the core session.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getOptionalAuthHeader, session?.projectId, setEnvValues])

  const firstPrompt        = useMemo(() => session?.prompt?.trim(), [session?.prompt])
  const browserInspection  = useMemo(() => session ? getLatestBrowserInspection(session.timeline) : null, [session])
  const tokenLimitEvent    = useMemo(() => session ? getTokenLimitEvent(session.timeline) : undefined, [session])
  const visibleCount       = session?.timeline.filter((e) => e.title !== "Session created").length ?? 0
  const projectFileCount   = projectIntegration?.files?.length ?? 0
  const generatedFileCount = session?.agentRuntime?.generatedFileCount ?? 0
  const hasProjectFiles    = projectFileCount > 0 || generatedFileCount > 0
  const isBuildTokenBlocked = Boolean(userData && remainingTokens <= 0)
  const isSessionStopped = Boolean(session?.id && stoppedSessionIds.has(session.id))
  const effectiveStatus: ComputerSessionStatus = isSessionStopped ? "idle" : (session?.status ?? "idle")
  const sessionProgress = useMemo(
    () => session
      ? deriveComputerSessionProgress({
        session,
        status: effectiveStatus,
        optimisticStart: optimisticStart || isStartingRun,
      })
      : null,
    [effectiveStatus, isStartingRun, optimisticStart, session],
  )
  const isRunning = !isSessionStopped && (optimisticStart || isStartingRun ||
    session?.status === "running" || session?.status === "planning"
  )

  const showTokenLimit = useCallback(() => {
    setRunError("You have used all credits for this cycle. Upgrade your plan to continue.")
    setTokenLimitModalOpen(true)
  }, [])

  const rememberStoppedSession = useCallback((sessionId: string) => {
    setStoppedSessionIds((current) => {
      const next = new Set(current)
      next.add(sessionId)
      writeStoppedComputerSessions(next)
      return next
    })
  }, [])

  const clearStoppedSession = useCallback((sessionId: string) => {
    setStoppedSessionIds((current) => {
      if (!current.has(sessionId)) return current
      const next = new Set(current)
      next.delete(sessionId)
      writeStoppedComputerSessions(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!session?.id) return
    if (session.status !== "complete" && session.status !== "error") return
    clearStoppedSession(session.id)
  }, [clearStoppedSession, session?.id, session?.status])

  useEffect(() => {
    if (!isEditingTitle && session?.prompt) {
      setTitleDraft(session.prompt)
    }
  }, [session?.prompt, isEditingTitle, setTitleDraft])

  useEffect(() => {
    if (!tokenLimitEvent) return
    setRunError("You have used all credits for this cycle. Upgrade your plan to continue.")
    setTokenLimitModalOpen(true)
  }, [tokenLimitEvent, setRunError, setTokenLimitModalOpen])

  const sessionTitle = useMemo(() => {
    const raw = (firstPrompt || "").trim()
    if (!raw) return "Untitled request"
    const firstLine = raw.split(/\r?\n/)[0].trim()
    const candidate = firstLine.split(/[.?!]\s+/)[0].trim().replace(/^(build|create|make|develop|design)\s+/i, "").trim()
    const titleText = candidate || firstLine
    return titleText.length > 72 ? `${titleText.slice(0, 72).trim()}...` : titleText
  }, [firstPrompt])

  useEffect(() => { if (visibleCount > 0) setOptimisticStart(false) }, [visibleCount, setOptimisticStart])
  useEffect(() => { if (browserInspection && !session?.previewUrl) setActiveTab("browser") }, [browserInspection, session?.previewUrl, setActiveTab])
  useEffect(() => {
    if (!session) return

    const nextPreviewUrl = session.previewUrl || null
    const previousPreviewUrl = previousPreviewUrlRef.current
    previousPreviewUrlRef.current = nextPreviewUrl

    if (previousPreviewUrl === undefined) return
    if (nextPreviewUrl && nextPreviewUrl !== previousPreviewUrl) {
      setActiveTab("preview")
      setMobileView("workspace")
    }
  }, [session, session?.previewUrl, setActiveTab, setMobileView])
  useEffect(() => {
    if (!session?.projectId) return
    if (normalizePlatform(session.platform) !== "mobile") return
    if (!hasProjectFiles) return
    setActiveTab("preview")
    setMobileView("workspace")
  }, [hasProjectFiles, session?.platform, session?.projectId, setActiveTab, setMobileView])
  useEffect(() => {
    if (!session?.projectId || normalizePlatform(session.platform) !== "mobile") return

    const prev = prevMobileSyncStatusRef.current
    prevMobileSyncStatusRef.current = session.status
    if (prev === "running" && (session.status === "complete" || session.status === "error")) {
      setPreviewRetryNonce((current) => current + 1)
    }
  }, [session?.platform, session?.projectId, session?.status])
  useEffect(() => {
    if (!session || normalizePlatform(session.platform) !== "mobile") return

    const codeEventCount = session.timeline.filter((event) => event.kind === "code").length
    if (codeEventCount > lastCodeEventCountRef.current) {
      lastCodeEventCountRef.current = codeEventCount
      setPreviewRetryNonce((current) => current + 1)
    }
  }, [session])
  useEffect(() => {
    const projectId = session?.projectId
    const prevStatus = prevSessionStatusRef.current
    prevSessionStatusRef.current = session?.status ?? null

    if (!projectId || !user || authLoading) return
    if (normalizePlatform(session.platform) === "mobile") return
    if (session.status === "idle" || session.status === "planning" || session.status === "running") return

    // Skip ensure-preview when the run just completed and already set a previewUrl.
    // The sandbox is fresh — no need to recreate it immediately.
    if (prevStatus === "running" && session.previewUrl) return

    const ensureKey = `${projectId}:${session.status}`
    if (previewEnsureKeyRef.current === ensureKey) return
    previewEnsureKeyRef.current = ensureKey

    let cancelled = false
    setIsEnsuringPreview(true)
    setPreviewEnsureError(null)

    void (async () => {
      try {
        const auth = await getOptionalAuthHeader()
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ensure-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ force: false }),
        })
        const json = await res.json().catch(() => ({})) as { previewUrl?: string; error?: string }
        if (!res.ok || !json.previewUrl) {
          throw new Error(json.error || "Failed to restore preview")
        }

        if (cancelled) return
        const nextPreviewUrl = String(json.previewUrl)
        if (nextPreviewUrl !== session.previewUrl) {
          await updateDoc(doc(db, "computerSessions", session.id), { previewUrl: nextPreviewUrl })
        }
        setActiveTab("preview")
        setMobileView("workspace")
      } catch (err) {
        if (cancelled) return
        previewEnsureKeyRef.current = null
        setPreviewEnsureError(normalizePreviewEnsureError(err))
      } finally {
        if (!cancelled) setIsEnsuringPreview(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, getOptionalAuthHeader, session, session?.projectId, session?.status, session?.previewUrl, setActiveTab, setMobileView, user, previewRetryNonce])

  // ── Runtime error listener — receives postMessage from sandbox iframe ─────
  useEffect(() => {
    if (!session?.previewUrl) return
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; message?: string; stack?: string }
      if (data?.type !== 'runtime-error') return
      if (!data.message) return
      setRuntimeError({ message: data.message, stack: data.stack || '' })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [session?.previewUrl])

  // ── Auto-run (unchanged) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "idle" || hasStartedRef.current) return
    if (stoppedSessionIds.has(session.id)) return
    if (!userData) return
    if (isBuildTokenBlocked) {
      showTokenLimit()
      return
    }
    hasStartedRef.current = true
    setRunError(null); setOptimisticStart(true)
    void (async () => {
      const controller = new AbortController()
      runAbortRef.current = controller
      try {
        const auth = await getOptionalAuthHeader()
        const res  = await fetch("/api/computer/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ sessionId: session.id, prompt: session.prompt }),
          signal: controller.signal,
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok && res.status !== 409) throw new Error(data.error || "Could not start run")
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        hasStartedRef.current = false; setOptimisticStart(false)
        const message = err instanceof Error ? err.message : "Could not start run"
        if (isTokenLimitError(message)) setTokenLimitModalOpen(true)
        setRunError(getRunErrorMessage(message))
      }
    })()
  }, [getOptionalAuthHeader, isBuildTokenBlocked, session, showTokenLimit, stoppedSessionIds, userData, setRunError, setOptimisticStart])

  // ── handleRun (unchanged) ─────────────────────────────────────────────────
  const handleRun = useCallback(async (value: string) => {
    const t = value.trim(); if (!t) return
    setLocalMessages((c) => [...c, { role: "user", content: t }])
    setRuntimeError(null)
    if (!session || isStartingRun) return
    clearStoppedSession(session.id)
    if (isBuildTokenBlocked) {
      showTokenLimit()
      return
    }
    setIsStartingRun(true); setRunError(null)
    const controller = new AbortController()
    runAbortRef.current = controller
    try {
      const auth = await getOptionalAuthHeader()
      const res  = await fetch("/api/computer/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ sessionId: session.id, prompt: t }),
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not start run")
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Could not start run"
      if (isTokenLimitError(message)) setTokenLimitModalOpen(true)
      setRunError(getRunErrorMessage(message))
    }
    finally { setIsStartingRun(false) }
  }, [clearStoppedSession, getOptionalAuthHeader, isBuildTokenBlocked, isStartingRun, session, showTokenLimit])

  // ── handleStop — halts an in-flight run immediately ───────────────────────
  const handleStop = useCallback(async () => {
    // Abort the pending request so the client stops waiting at once.
    runAbortRef.current?.abort()
    runAbortRef.current = null
    setOptimisticStart(false)
    setIsStartingRun(false)
    setRunError(null)
    if (!session) return
    const stoppedSessionId = session.id
    rememberStoppedSession(stoppedSessionId)
    setSession((current) => current?.id === stoppedSessionId ? { ...current, status: "idle" } : current)
    try {
      // Authoritative server-side cancel: flips currentRunId so the running
      // job bails at its next checkpoint and the session returns to idle.
      const auth = await getOptionalAuthHeader()
      await fetch("/api/computer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ sessionId: session.id }),
      })
    } catch {
      // Best-effort: the abort already stopped the client; ignore network errors.
    }
  }, [getOptionalAuthHeader, rememberStoppedSession, session, setSession])

  const handleEditStart  = (i: number, c: string) => { setEditingMsgIndex(i); setEditText(c) }
  const handleEditCancel = () => { setEditingMsgIndex(null); setEditText("") }
  const handleEditSubmit = useCallback(async (index: number) => {
    const t = editText.trim(); if (!t || !session) return
    setEditingMsgIndex(null); setEditText("")
    setRuntimeError(null)
    clearStoppedSession(session.id)

    // Determine which runs are being discarded (everything at or after the edit point).
    const { firstRunId, followUpRunIds } = getRunIdGroups(session.timeline)
    // Number of user messages that appear before the edited slot.
    const userCountBefore = index < 0
      ? 0
      : localMessages.slice(0, index).filter((m) => m.role === "user").length
    const runIdsToRemove = new Set<string>()
    if (index < 0 && firstRunId) runIdsToRemove.add(firstRunId)
    for (const rid of followUpRunIds.slice(index < 0 ? 0 : userCountBefore)) {
      runIdsToRemove.add(rid)
    }

    // Truncate local messages to the edit point.
    setLocalMessages((c) => index < 0 ? [] : [...c.slice(0, index), { role: "user", content: t }])

    // Prune discarded runs from the Firestore timeline and reset status so the
    // new run can start even if the previous one ended in "complete" or "error".
    if (runIdsToRemove.size > 0) {
      const prunedTimeline = session.timeline.filter(
        (e) => !e.runId || !runIdsToRemove.has(e.runId)
      )
      updateDoc(doc(db, "computerSessions", session.id), {
        timeline: prunedTimeline,
        status: "idle",
      }).catch(() => {})
    }

    if (isStartingRun) return
    if (isBuildTokenBlocked) { showTokenLimit(); return }
    setIsStartingRun(true); setRunError(null)
    const controller = new AbortController()
    runAbortRef.current = controller
    try {
      const auth = await getOptionalAuthHeader()
      const res  = await fetch("/api/computer/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ sessionId: session.id, prompt: t }),
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not start run")
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Could not start run"
      if (isTokenLimitError(message)) setTokenLimitModalOpen(true)
      setRunError(getRunErrorMessage(message))
    } finally {
      setIsStartingRun(false)
    }
  }, [clearStoppedSession, editText, getOptionalAuthHeader, isBuildTokenBlocked, isStartingRun, localMessages, session, showTokenLimit])

  const startNetlifyConnection = useCallback(async () => {
    if (!session?.projectId) return
    const auth = await getOptionalAuthHeader()
    const returnTo = encodeURIComponent(`/computer/${session.id}`)
    const res = await fetch(`/api/netlify/oauth/start?projectId=${encodeURIComponent(session.projectId)}&returnTo=${returnTo}`, {
      headers: auth,
    })
    const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Could not start Netlify connection")
    }
    window.location.href = data.url
  }, [getOptionalAuthHeader, session?.id, session?.projectId])

  const handleDeploy = useCallback(async (provider: DeployProvider) => {
    if (!session?.projectId || deployState.busy) return
    const existingSiteUrl = provider === "netlify"
      ? projectIntegration?.netlifySiteUrl ?? null
      : projectIntegration?.vercelSiteUrl ?? projectIntegration?.vercelDeployUrl ?? null
    const existingAdminUrl = provider === "netlify"
      ? projectIntegration?.netlifyAdminUrl ?? null
      : projectIntegration?.vercelDeploymentId
        ? `https://vercel.com/dashboard/deployments/${projectIntegration.vercelDeploymentId}`
        : null

    setDeployOpen(true)
    setDeployState({
      provider,
      busy: true,
      step: "Starting",
      logs: [],
      error: null,
      siteUrl: existingSiteUrl,
      adminUrl: existingAdminUrl,
    })

    try {
      const auth = await getOptionalAuthHeader()
      const endpoint = provider === "netlify" ? "/api/netlify/deploy" : "/api/vercel/deploy"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ projectId: session.projectId }),
      })

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Deploy request failed")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let failedWithNetlifyConnection = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        while (true) {
          const index = buffer.indexOf("\n")
          if (index === -1) break
          const line = buffer.slice(0, index).trim()
          buffer = buffer.slice(index + 1)
          if (!line) continue

          let payload: {
            type?: string
            step?: string
            message?: string
            error?: string
            siteUrl?: string
            adminUrl?: string
          }
          try {
            payload = JSON.parse(line)
          } catch {
            continue
          }

          if (payload.type === "step" && payload.step) {
            setDeployState((current) => ({ ...current, step: payload.step || current.step }))
          }

          if (payload.type === "log" && payload.message) {
            setDeployState((current) => ({ 
              ...current, 
              logs: [...current.logs, payload.message || ""] 
            }))
          }

          if (payload.type === "error") {
            failedWithNetlifyConnection = provider === "netlify" && /netlify not connected/i.test(String(payload.error || ""))
            setDeployState((current) => ({
              ...current,
              error: getDeployErrorMessage(payload.error),
              step: failedWithNetlifyConnection ? "Needs connection" : "Failed",
            }))
          }

          if (payload.type === "success") {
            setDeployState((current) => ({
              ...current,
              step: "Ready",
              error: null,
              siteUrl: payload.siteUrl || null,
              adminUrl: payload.adminUrl || null,
            }))
          }
        }
      }

      if (failedWithNetlifyConnection) {
        await startNetlifyConnection()
      }
    } catch (err) {
      setDeployState((current) => ({
        ...current,
        error: getDeployErrorMessage(err instanceof Error ? err.message : "Deploy failed"),
        step: "Failed",
      }))
    } finally {
      setDeployState((current) => ({ ...current, busy: false }))
    }
  }, [deployState.busy, getOptionalAuthHeader, projectIntegration?.netlifyAdminUrl, projectIntegration?.netlifySiteUrl, projectIntegration?.vercelDeployUrl, projectIntegration?.vercelDeploymentId, projectIntegration?.vercelSiteUrl, session?.projectId, startNetlifyConnection])

  const handleGithubSync = useCallback(async () => {
    if (!session?.projectId || integrationBusy) return
    setIntegrationBusy("github")
    setIntegrationMessage("Syncing project files to GitHub...")
    try {
      const auth = await getOptionalAuthHeader()
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ projectId: session.projectId }),
      })
      const data = await res.json().catch(() => ({})) as { repoUrl?: string; repoFullName?: string; error?: string }
      if (!res.ok) {
        const error = data.error || "GitHub sync failed"
        if (/not connected/i.test(error)) {
          const returnTo = encodeURIComponent(`/computer/${session.id}`)
          const start = await fetch(`/api/github/oauth/start?projectId=${encodeURIComponent(session.projectId)}&returnTo=${returnTo}`, {
            headers: auth,
          })
          const startJson = await start.json().catch(() => ({})) as { url?: string; error?: string }
          if (!start.ok || !startJson.url) throw new Error(startJson.error || error)
          window.location.href = startJson.url
          return
        }
        throw new Error(error)
      }
      setIntegrationMessage(`Synced to ${data.repoFullName || data.repoUrl || "GitHub"}.`)
    } catch (err) {
      setIntegrationMessage(err instanceof Error ? err.message : "GitHub sync failed")
    } finally {
      setIntegrationBusy(null)
    }
  }, [getOptionalAuthHeader, integrationBusy, session?.id, session?.projectId])

  const handleSupabaseSetup = useCallback(async () => {
    if (!session?.projectId || integrationBusy) return
    setIntegrationBusy("supabase")
    setIntegrationMessage("Preparing Supabase for this website...")
    try {
      const auth = await getOptionalAuthHeader()
      const connectionRes = await fetch("/api/supabase/check-connection", { headers: auth })
      const connection = await connectionRes.json().catch(() => ({})) as { connected?: boolean; error?: string }
      if (!connection.connected) {
        const authRes = await fetch(`/api/integrations/supabase/authorize?builderProjectId=${encodeURIComponent(session.projectId)}`, {
          headers: auth,
        })
        const authJson = await authRes.json().catch(() => ({})) as { url?: string; error?: string }
        if (!authRes.ok || !authJson.url) throw new Error(authJson.error || "Failed to start Supabase connection")
        window.open(authJson.url, "supabase-oauth", "width=560,height=760,menubar=no,toolbar=no")
        setIntegrationMessage("Complete Supabase connection, then run setup again.")
        return
      }

      const setupRes = await fetch("/api/integrations/supabase/auto-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ projectId: session.projectId, createProject: true }),
      })
      const setup = await setupRes.json().catch(() => ({})) as { projectRef?: string; error?: string }
      if (!setupRes.ok) throw new Error(setup.error || "Supabase setup failed")
      if (!setup.projectRef) {
        setIntegrationMessage("Supabase is connected. This website does not need backend provisioning yet.")
        return
      }

      setIntegrationMessage("Supabase linked. Wiring it into the generated website...")
      const provisionRes = await fetch("/api/integrations/supabase/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ projectId: session.projectId }),
      })
      const provision = await provisionRes.json().catch(() => ({})) as {
        projectRef?: string
        provisioned?: boolean
        error?: string
      }
      if (!provisionRes.ok) throw new Error(provision.error || "Supabase provisioning failed")
      setIntegrationMessage(`Supabase connected${setup.projectRef ? `: ${setup.projectRef}` : ""}.`)
    } catch (err) {
      setIntegrationMessage(err instanceof Error ? err.message : "Supabase setup failed")
    } finally {
      setIntegrationBusy(null)
    }
  }, [getOptionalAuthHeader, integrationBusy, session?.projectId])

  // Used by the in-run Supabase question card: OAuth if needed, then tell the server to proceed
  const handleSupabaseYes = useCallback(async () => {
    if (!session?.id || !session?.projectId || integrationBusy) return
    setIntegrationBusy("supabase")
    setIntegrationMessage("Checking Supabase connection...")
    try {
      const auth = await getOptionalAuthHeader()
      const connectionRes = await fetch("/api/supabase/check-connection", { headers: auth })
      const connection = await connectionRes.json().catch(() => ({})) as { connected?: boolean }
      if (!connection.connected) {
        const authRes = await fetch(`/api/integrations/supabase/authorize?builderProjectId=${encodeURIComponent(session.projectId)}`, { headers: auth })
        const authJson = await authRes.json().catch(() => ({})) as { url?: string; error?: string }
        if (!authRes.ok || !authJson.url) throw new Error(authJson.error || "Failed to start Supabase connection")
        window.open(authJson.url, "supabase-oauth", "width=560,height=760,menubar=no,toolbar=no")
        setIntegrationMessage("Complete Supabase connection — setup will continue automatically.")
        return
      }
      await updateDoc(doc(db, "computerSessions", session.id), { supabaseAnswer: "yes" })
      setIntegrationMessage("Setting up Supabase backend...")
    } catch (err) {
      setIntegrationMessage(err instanceof Error ? err.message : "Supabase setup failed")
    } finally {
      setIntegrationBusy(null)
    }
  }, [getOptionalAuthHeader, integrationBusy, session?.id, session?.projectId])

  const handleSupabaseNo = useCallback(async () => {
    if (!session?.id) return
    await updateDoc(doc(db, "computerSessions", session.id), { supabaseAnswer: "no" }).catch(() => {})
  }, [session?.id])

  const handleEnvAdd = useCallback((key: string, value: string) => {
    const name = key.trim()
    if (!name) return
    setProjectIntegration((current) => ({
      ...(current || {}),
      envVarNames: Array.from(new Set([...(current?.envVarNames || []), name])),
    }))
    setEnvValues((current) => ({ ...current, [name]: value }))
  }, [])

  const handleEnvSave = useCallback(async () => {
    if (!session?.projectId || integrationBusy) return
    setIntegrationBusy("env")
    setIntegrationMessage("Saving encrypted environment variables...")
    try {
      const auth = await getOptionalAuthHeader()
      const res = await fetch("/api/env-vars/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ projectId: session.projectId, envVars: envValues }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to save environment variables")
      setIntegrationMessage("Environment variables saved. Updating preview...")

      const files = projectIntegration?.files || []
      if (!files.length) {
        setIntegrationMessage("Environment variables saved. Preview will use them on the next run.")
        return
      }

      const sandboxRes = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ files, projectId: session.projectId }),
      })
      const text = await sandboxRes.text().catch(() => "")
      if (!sandboxRes.ok) {
        const parsed = text.split("\n").map((line) => {
          try { return JSON.parse(line) } catch { return null }
        }).find((event) => event?.error)
        throw new Error(parsed?.error || text || "Preview update failed")
      }

      let previewUrl = ""
      for (const line of text.split("\n")) {
        try {
          const event = JSON.parse(line)
          if (event?.type === "success" && typeof event.url === "string") {
            previewUrl = event.url
          }
        } catch {}
      }

      if (previewUrl) {
        await updateDoc(doc(db, "computerSessions", session.id), { previewUrl })
        setActiveTab("preview")
        setIntegrationMessage("Environment variables saved and preview updated.")
      } else {
        setIntegrationMessage("Environment variables saved. Preview is restarting.")
      }
    } catch (err) {
      setIntegrationMessage(err instanceof Error ? err.message : "Failed to save environment variables")
    } finally {
      setIntegrationBusy(null)
    }
  }, [envValues, getOptionalAuthHeader, integrationBusy, projectIntegration?.files, session?.id, session?.projectId])

  const handleClarificationAnswer = useCallback(async (answer: string) => {
    if (!session?.id) return
    await updateDoc(doc(db, "computerSessions", session.id), {
      clarificationAnswer: answer,
    }).catch(() => {})
  }, [session?.id])

  useEffect(() => {
    if (!session?.projectId) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; ok?: boolean; builderProjectId?: string; message?: string }
      if (data?.type !== "supabase-oauth") return
      if (data.builderProjectId && data.builderProjectId !== session.projectId) return
      if (!data.ok) {
        setIntegrationMessage(data.message || "Supabase connection failed.")
        return
      }
      // If a run is active with a pending Supabase question, let the server handle setup
      if (session.status === "running") {
        setIntegrationMessage("Supabase connected. Continuing setup...")
        void handleSupabaseYes()
      } else {
        setIntegrationMessage("Supabase connected. Provisioning this website...")
        void handleSupabaseSetup()
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [session?.projectId, session?.status, handleSupabaseSetup, handleSupabaseYes])

  if (loading) return <LoadingShell />
  if (error || !session) return <ErrorState message={error ?? "Session not found or access denied."} />

  const sessionPlatform = normalizePlatform(session.platform)
  const hasPreview    = sessionPlatform === "mobile"
    ? Boolean(session.projectId && hasProjectFiles)
    : Boolean(session.previewUrl)
  const hasBrowser    = Boolean(browserInspection)
  const hasResearch   = session.timeline.some((e) => (e.kind === "research" || e.kind === "browser") && e.description?.trim())
  const deploymentLinks = getProjectDeploymentLinks(projectIntegration)
  const liveSiteUrl = deploymentLinks.netlify?.siteUrl || deploymentLinks.vercel?.siteUrl
  const planLabel = userData?.planId && userData.planId !== "free" ? userData.planId : "Free"

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground sm:p-2.5 lg:p-3">

      {/* ── App shell ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card sm:rounded-[1.4rem] sm:border sm:border-border-strong/50 sm:shadow-2xl">

      <ComputerTopBar
        session={session}
        sessionTitle={sessionTitle}
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
          setTitleDraft(firstPrompt || "")
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
            await updateDoc(doc(db, "computerSessions", session.id), { prompt: trimmed })
            setIsEditingTitle(false)
          } catch {
            setTitleError("Could not save title. Please try again.")
          } finally {
            setTitleSaving(false)
          }
        }}
        onTitleError={setTitleError}
        onOpenIntegrations={() => {
          setIntegrationsOpen(true)
          setDeployOpen(false)
        }}
        onOpenDeploy={() => {
          setDeployOpen(true)
          setIntegrationsOpen(false)
        }}
      />

      {(deployOpen || integrationsOpen) && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 z-30 hidden bg-transparent sm:block"
          onClick={() => {
            setDeployOpen(false)
            setIntegrationsOpen(false)
          }}
        />
      )}

      <IntegrationsButton
        projectId={session.projectId}
        project={projectIntegration}
        open={integrationsOpen}
        busy={integrationBusy}
        message={integrationMessage}
        envValues={envValues}
        headless
        onOpenChange={(open) => {
          setIntegrationsOpen(open)
          if (open) setDeployOpen(false)
        }}
        onGithubSync={handleGithubSync}
        onSupabaseSetup={handleSupabaseSetup}
        onEnvChange={(key, value) => setEnvValues((current) => ({ ...current, [key]: value }))}
        onEnvAdd={handleEnvAdd}
        onEnvSave={handleEnvSave}
      />
      <DeployButton
        projectId={session.projectId}
        open={deployOpen}
        state={deployState}
        deploymentLinks={deploymentLinks}
        headless
        onOpenChange={(open) => {
          setDeployOpen(open)
          if (open) setIntegrationsOpen(false)
        }}
        onDeploy={handleDeploy}
      />

      {/* ── Body ── */}
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">

        {/* ── Chat panel (left) ── */}
        <div className={cn(
          "flex w-full shrink-0 flex-col overflow-hidden bg-card sm:border-r sm:border-border",
          "sm:w-[20rem] md:w-[22rem] lg:w-[24rem] xl:w-[25rem] 2xl:w-[27rem]",
          mobileView !== "feed" && "hidden sm:flex"
        )}>
          {/* Feed scroll area */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 [scrollbar-width:thin] lg:px-5">
            <AgentFeed
              prompt={firstPrompt} events={session.timeline}
              localMessages={localMessages} status={effectiveStatus}
              progress={sessionProgress}
              optimisticStart={optimisticStart}
              editingIndex={editingMsgIndex} editText={editText}
              onEditStart={handleEditStart} onEditChange={setEditText}
              onEditSubmit={handleEditSubmit} onEditCancel={handleEditCancel}
              onSupabaseSetup={handleSupabaseYes}
              onSupabaseDecline={handleSupabaseNo}
              onClarificationAnswer={handleClarificationAnswer}
              onSwitchToPreview={() => { setMobileView("workspace"); setActiveTab("preview") }}
            />
          </div>

          {/* Composer */}
          <div className="shrink-0 bg-card px-3 pt-3 pb-[5.25rem] sm:pb-3 lg:px-4">
            {isBuildTokenBlocked && (
              <div className="mb-3 rounded-xl border border-warning/25 bg-warning-soft px-3 py-2.5">
                <p className="text-sm font-medium text-warning-soft-foreground">You have used all credits for this cycle.</p>
                <p className="mt-0.5 text-xs text-warning-soft-foreground/85">
                  Upgrade your plan to continue running the computer agent.
                  {" "}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">
                    View plans
                  </Link>
                </p>
              </div>
            )}
            {runError && !isBuildTokenBlocked && (
              <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                <p className="text-[11.5px] text-destructive">{getRunErrorMessage(runError)}</p>
              </div>
            )}
            <AnimatedAIInput
              mode="chat"
              compact
              compactSize="slim"
              isLoading={isRunning}
              onStop={handleStop}
              onSubmit={handleRun}
              placeholder="Message the agent..."
              disabled={isBuildTokenBlocked}
            />
          </div>
        </div>

        {/* ── Workspace panel (right) ── */}
        <div className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-background",
          mobileView !== "workspace" && "hidden sm:flex"
        )}>
          <WorkspaceTabBar
            activeTab={activeTab}
            hasPreview={hasPreview}
            hasBrowser={hasBrowser}
            hasResearch={hasResearch}
            onTabChange={setActiveTab}
            showCompleteBadge={effectiveStatus === "complete"}
          />

          {/* Workspace content */}
          <div className="relative min-h-0 flex-1 bg-background">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }} className="h-full min-h-0">
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
                    const fixPrompt = `Fix this runtime error in the app:\n\n${runtimeError.message}${runtimeError.stack ? '\n\nStack trace:\n' + runtimeError.stack.slice(0, 800) : ''}`
                    setRuntimeError(null)
                    await handleRun(fixPrompt)
                    setFixingError(false)
                  }}
                  onDismissError={() => setRuntimeError(null)}
                  onRetryPreview={() => {
                    previewEnsureKeyRef.current = null
                    setPreviewEnsureError(null)
                    setPreviewRetryNonce((n) => n + 1)
                  }}
                  previewSyncNonce={previewRetryNonce}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>

      {/* ── Mobile view switcher ── */}
      <nav
        className="absolute inset-x-4 z-20 mx-auto max-w-sm rounded-2xl border border-border bg-card/90 px-1 py-1 shadow-lg backdrop-blur-xl sm:hidden"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setMobileView("feed")}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors",
              mobileView === "feed"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
          <button
            type="button"
            onClick={() => { setMobileView("workspace"); setActiveTab("preview") }}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors",
              mobileView === "workspace"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Monitor className="h-4 w-4" />
            Preview
          </button>
        </div>
      </nav>

      <TokenLimitDialog
        open={tokenLimitModalOpen}
        onOpenChange={setTokenLimitModalOpen}
        description="This workspace has no credits left in the current cycle. Upgrade to continue running the computer agent."
      />
      <MobileIntegrationsSheet
        open={integrationsOpen}
        project={projectIntegration}
        busy={integrationBusy}
        message={integrationMessage}
        onClose={() => setIntegrationsOpen(false)}
        onGithubSync={handleGithubSync}
        onSupabaseSetup={handleSupabaseSetup}
      />
      <MobileDeploySheet
        open={deployOpen}
        state={deployState}
        deploymentLinks={getProjectDeploymentLinks(projectIntegration)}
        onClose={() => setDeployOpen(false)}
        onDeploy={handleDeploy}
      />
    </div>
  )
}
