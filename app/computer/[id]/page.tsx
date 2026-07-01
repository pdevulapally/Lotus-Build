"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Globe,
  GitBranch,
  KeyRound,
  Loader2,
  MessageSquare,
  Monitor,
  Rocket,
  Search,
  X,
} from "lucide-react"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { TokenLimitDialog } from "@/components/project/token-limit-dialog"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { DeployTerminal } from "@/components/project/deploy-terminal"
import { AgentFeed } from "@/components/computer/agent-feed"
import { ComputerTopBar, type ComputerTheme } from "@/components/computer/computer-top-bar"
import { VersionHistoryPanel } from "@/components/computer/version-history-panel"
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

type GitHubSyncResponse = {
  ok?: boolean
  repoUrl?: string
  repoFullName?: string
  syncedAt?: string
  code?: string
  error?: string
  message?: string
  action?: string
}

type IntegrationCardItem = {
  key: string
  icon: React.ReactNode
  iconBg: string
  name: string
  category: string
  description?: string
  href?: string
  hrefLabel?: string
  connected: boolean
  actionLabel: string
  actionBusy: boolean
  onClick: () => void
}

type IntegrationSection = "integrations" | "env"

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
const COMPUTER_THEME_KEY = "lotus.computerTheme"

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
            ? "bg-foreground text-background shadow-sm"
            : "bg-foreground text-background shadow-sm hover:bg-foreground/85 sm:hover:shadow-md"
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
          "lotus-glass-strong z-30 hidden w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl border p-4 sm:block",
          headless ? "fixed right-6 top-16" : "absolute right-0 top-11",
        )}>

          {/* ── Success state ─────────────────────────────────────── */}
          {!state.busy && visibleStateSiteUrl && !state.error && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <p className="text-[13px] font-semibold text-foreground">Your website is live!</p>
              </div>
              <a
                href={visibleStateSiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-success py-3 text-[13px] font-bold text-success-foreground transition-all hover:bg-success/90 active:scale-[0.98]"
              >
                <Globe className="h-4 w-4" />
                <span>Visit your website</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
              {state.adminUrl && (
                <a href={state.adminUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                  <span>View on {state.provider ? getDeployProviderLabel(state.provider) : "dashboard"}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <DeployTerminal logs={state.logs} currentStep={state.step} />
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">Also publish to another platform</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["netlify", "vercel"] as DeployProvider[]).map((provider) => (
                    <button key={provider} type="button" onClick={() => onDeploy(provider)}
                      disabled={state.busy}
                      className="lotus-glass-control rounded-full border px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground disabled:opacity-40">
                      {getDeployProviderLabel(provider)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Deploying state ───────────────────────────────────── */}
          {state.busy && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    Publishing to {state.provider ? getDeployProviderLabel(state.provider) : "your host"}…
                  </p>
                  {state.step && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{state.step}</p>
                  )}
                </div>
              </div>
              <DeployTerminal logs={state.logs} currentStep={state.step} />
            </div>
          )}

          {/* ── Error state ───────────────────────────────────────── */}
          {!state.busy && state.error && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">Couldn't publish your website</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{state.error}</p>
                </div>
              </div>
              <DeployTerminal logs={state.logs} currentStep={state.step} />
            </div>
          )}

          {/* ── Provider selection (default) ──────────────────────── */}
          {!state.busy && !state.step && !state.error && (
            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Get your website online</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  Pick a platform and your site goes live in seconds — no technical setup needed.
                </p>
              </div>

              {hasStoredDeployments && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your live sites</p>
                  {(["netlify", "vercel"] as DeployProvider[]).map((provider) => {
                    const link = deploymentLinks?.[provider]
                    if (!link?.siteUrl) return null
                    return (
                      <a key={provider} href={link.siteUrl} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-full border border-success/30 bg-success/5 px-3 py-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-success/10">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3 text-success" />
                          <span>{getDeployProviderLabel(provider)} site</span>
                        </div>
                        <div className="flex items-center gap-1 text-success">
                          <span className="text-[10px] font-medium">Live</span>
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </a>
                    )
                  })}
                  <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Publish to a new platform</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onDeploy("netlify")} disabled={state.busy}
              className="lotus-glass-control group relative rounded-[1.65rem] border px-3 py-3 text-left transition-all hover:border-border-strong hover:bg-muted disabled:opacity-40">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[12px] font-semibold text-foreground">Netlify</p>
                    <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">Free</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">No credit card needed. Best for most websites.</p>
                </button>
                <button type="button" onClick={() => onDeploy("vercel")} disabled={state.busy}
                  className="lotus-glass-control rounded-[1.65rem] border px-3 py-3 text-left transition-all hover:border-border-strong hover:bg-muted disabled:opacity-40">
                  <p className="text-[12px] font-semibold text-foreground">Vercel</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Fast and reliable. Great for React & Next.js apps.</p>
                </button>
              </div>
            </div>
          )}

          {/* ── Retry button (error state) ────────────────────────── */}
          {!state.busy && state.error && state.provider && (
            <button type="button" onClick={() => onDeploy(state.provider!)}
              className="lotus-glass-control mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted">
              <Rocket className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function IntegrationCard({
  icon,
  iconBg,
  name,
  category,
  description,
  href,
  hrefLabel,
  actionLabel,
  actionBusy,
  connected,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  iconBg?: string
  name: string
  category: string
  description?: string
  href?: string
  hrefLabel?: string
  actionLabel: string
  actionBusy?: boolean
  connected?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <article className="group flex min-h-[104px] flex-col justify-between gap-4 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/45 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
          iconBg ?? "bg-foreground/8 dark:bg-foreground/10",
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-[14px] font-semibold text-foreground">{name}</p>
            <span className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              connected
                ? "bg-success-soft text-success-soft-foreground"
                : "bg-slate-soft text-slate-soft-foreground",
            )}>
              {connected ? "Enabled" : "Available"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">{category}</p>
          {description && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/85">{description}</p>}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-foreground underline underline-offset-2"
            >
              <span className="truncate">{hrefLabel || href}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "h-9 shrink-0 rounded-lg px-4 text-[12px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 sm:min-w-[112px]",
          connected
            ? "border border-border bg-card text-foreground hover:bg-muted"
            : "bg-foreground text-background hover:bg-foreground/85",
        )}
      >
        {actionBusy ? (
          <span className="flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {actionLabel}
          </span>
        ) : actionLabel}
      </button>
    </article>
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
  const [activeSection, setActiveSection] = useState<IntegrationSection>("integrations")
  const [connectorSearch, setConnectorSearch] = useState("")
  const [activeConnectorFilter, setActiveConnectorFilter] = useState("all")
  const envNames = project?.envVarNames || []
  const hasGitHub = Boolean(project?.githubRepoUrl || project?.githubRepoFullName)
  const hasSupabase = Boolean(project?.supabaseUrl || project?.supabaseProjectRef)
  const syncedAt = formatSyncedAt(project?.githubSyncedAt)

  const connectorItems: IntegrationCardItem[] = [
    {
      key: "github",
      icon: <GitBranch className="h-5 w-5 text-background" />,
      iconBg: "bg-foreground",
      name: "GitHub",
      category: "Version control",
      description: hasGitHub
        ? project?.githubRepoFullName || "Repository connected"
        : "Publish generated code to a GitHub repository.",
      href: project?.githubRepoUrl,
      hrefLabel: project?.githubRepoUrl,
      connected: hasGitHub,
      actionLabel: busy === "github" ? (hasGitHub ? "Syncing..." : "Publishing...") : (hasGitHub ? "Sync" : "Publish"),
      actionBusy: busy === "github",
      onClick: onGithubSync,
    },
    {
      key: "supabase",
      icon: <Database className="h-5 w-5 text-success-foreground" />,
      iconBg: "bg-success",
      name: "Supabase",
      category: "Database",
      description: hasSupabase
        ? project?.supabaseProjectRef || project?.supabaseUrl || "Database connected"
        : "Add auth and persistent storage to this project.",
      href: project?.supabaseUrl,
      hrefLabel: project?.supabaseProjectRef || project?.supabaseUrl,
      connected: hasSupabase,
      actionLabel: busy === "supabase" ? (hasSupabase ? "Running..." : "Setting up...") : (hasSupabase ? "Re-run setup" : "Set up"),
      actionBusy: busy === "supabase",
      onClick: onSupabaseSetup,
    },
  ]

  const enabledConnectorCount = connectorItems.filter((item) => item.connected).length
  const categoryFilters = Array.from(
    connectorItems.reduce((counts, item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1)
      return counts
    }, new Map<string, number>())
  ).map(([id, count]) => ({ id, label: id, count }))
  const connectorFilters = [
    { id: "enabled", label: "Enabled", count: enabledConnectorCount },
    { id: "all", label: "All", count: connectorItems.length },
    ...categoryFilters,
  ]
  const normalizedConnectorSearch = connectorSearch.trim().toLowerCase()
  const connectorFilterMatchers: Record<string, (item: IntegrationCardItem) => boolean> = {
    all: () => true,
    enabled: (item) => item.connected,
  }
  const filteredConnectorItems = connectorItems.filter((item) => {
    const matchesFilter = (connectorFilterMatchers[activeConnectorFilter] || ((entry) => entry.category === activeConnectorFilter))(item)
    const matchesSearch = !normalizedConnectorSearch || [
      item.name,
      item.category,
      item.description,
      item.href,
      item.hrefLabel,
    ].some((value) => value?.toLowerCase().includes(normalizedConnectorSearch))
    return matchesFilter && matchesSearch
  })
  const activeFilterLabel = connectorFilters.find((filter) => filter.id === activeConnectorFilter)?.label || "All"
  const sectionMeta: Record<IntegrationSection, { label: string; detail: string; Icon: React.ComponentType<{ className?: string }> }> = {
    integrations: {
      label: "Connectors",
      detail: `${enabledConnectorCount} enabled of ${connectorItems.length}`,
      Icon: GitBranch,
    },
    env: {
      label: "Secrets",
      detail: `${envNames.length} saved for this project`,
      Icon: KeyRound,
    },
  }
  const SectionIcon = sectionMeta[activeSection].Icon

  if (!projectId) return null

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
              ? "border-border bg-muted text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
          )}
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Integrations</span>
          <ChevronDown className={cn("hidden h-3.5 w-3.5 opacity-50 transition-transform duration-200 sm:block", open && "rotate-180")} />
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />

          <div className="fixed inset-x-3 bottom-3 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[980px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:flex-row">
            <aside className="shrink-0 border-b border-border bg-card sm:flex sm:w-[248px] sm:flex-col sm:border-b-0 sm:border-r">
              <div className="border-b border-border p-3">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground focus-within:border-border-strong focus-within:bg-card">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    value={connectorSearch}
                    onFocus={() => setActiveSection("integrations")}
                    onChange={(event) => {
                      setConnectorSearch(event.target.value)
                      setActiveSection("integrations")
                    }}
                    placeholder="Search"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </div>

              <div className="flex border-b border-border sm:hidden">
                {([
                  { id: "integrations" as const, label: "Connectors" },
                  { id: "env" as const, label: "Secrets" },
                ]).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex-1 border-b-2 py-3 text-[13px] font-medium transition-colors",
                      activeSection === item.id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto p-3 [scrollbar-width:thin] sm:flex">
                <div className="space-y-1">
                  {connectorFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setActiveSection("integrations")
                        setActiveConnectorFilter(filter.id)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                        activeSection === "integrations" && activeConnectorFilter === filter.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <span className="font-medium">{filter.label}</span>
                      <span className="text-[12px] tabular-nums text-muted-foreground">{filter.count}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveSection("env")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                      activeSection === "env"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <KeyRound className="h-3.5 w-3.5" />
                      Secrets
                    </span>
                    <span className="text-[12px] tabular-nums text-muted-foreground">{envNames.length}</span>
                  </button>
                </div>
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <SectionIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {sectionMeta[activeSection].label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {sectionMeta[activeSection].detail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close connectors"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] sm:p-6">
                {message && (
                  <p className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">{message}</p>
                )}

                {activeSection === "integrations" && (
                  <div className="space-y-6">
                    <div className="border-b border-border pb-6 text-center sm:text-left">
                      <div className="mb-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                        {connectorItems.map((item) => (
                          <span key={item.key} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            <span className={cn("h-2 w-2 rounded-full", item.connected ? "bg-success" : "bg-border-strong")} />
                            {item.name}
                          </span>
                        ))}
                      </div>
                      <h2 className="text-[24px] font-semibold tracking-normal text-foreground sm:text-[28px]">Connect what this project uses</h2>
                      <p className="mx-auto mt-2 max-w-[560px] text-[14px] leading-6 text-muted-foreground sm:mx-0">
                        Publish code, add data, and keep project secrets close to the build.
                      </p>
                    </div>

                    <div className="space-y-3 sm:hidden">
                      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                        {connectorFilters.map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setActiveConnectorFilter(filter.id)}
                            className={cn(
                              "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                              activeConnectorFilter === filter.id
                                ? "border-border-strong bg-card text-foreground"
                                : "border-border bg-card text-muted-foreground",
                            )}
                          >
                            {filter.label} {filter.count}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                          <h3 className="text-[18px] font-semibold text-foreground">App connectors</h3>
                          <p className="mt-1 text-[13px] text-muted-foreground">{activeFilterLabel} connectors from the current project setup.</p>
                        </div>
                        <span className="hidden text-[12px] tabular-nums text-muted-foreground sm:inline">{filteredConnectorItems.length} shown</span>
                      </div>

                      {filteredConnectorItems.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {filteredConnectorItems.map((item) => (
                            <IntegrationCard
                              key={item.key}
                              icon={item.icon}
                              iconBg={item.iconBg}
                              name={item.name}
                              category={item.category}
                              description={item.description}
                              href={item.href}
                              hrefLabel={item.hrefLabel}
                              actionLabel={item.actionLabel}
                              actionBusy={item.actionBusy}
                              connected={item.connected}
                              onClick={item.onClick}
                              disabled={busy !== null}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border bg-card p-5 text-center">
                          <p className="text-[14px] font-medium text-foreground">No connectors match this search</p>
                          <p className="mt-1 text-[13px] text-muted-foreground">Clear the search or choose another category.</p>
                        </div>
                      )}

                      {syncedAt && hasGitHub && (
                        <p className="mt-3 text-[11px] text-muted-foreground">Last synced to GitHub {syncedAt}</p>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === "env" && (
                  <div className="mx-auto max-w-[680px]">
                    <div className="mb-5 border-b border-border pb-5">
                      <h2 className="text-[22px] font-semibold text-foreground">Project secrets</h2>
                      <p className="mt-2 text-[14px] leading-6 text-muted-foreground">Save keys used by the preview runtime for this project.</p>
                    </div>
                    <div className="space-y-3">
                      {envNames.map((name) => (
                        <label key={name} className="block">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{name}</span>
                          <input
                            value={envValues[name] || ""}
                            onChange={(event) => onEnvChange(name, event.target.value)}
                            placeholder="Value"
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-border-strong"
                          />
                        </label>
                      ))}

                      <div className="pt-2">
                        <p className="mb-2 text-[13px] font-semibold text-foreground">Add secret</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={newEnvKey}
                            onChange={(event) => setNewEnvKey(event.target.value)}
                            placeholder="KEY"
                            className="h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-border-strong"
                          />
                          <input
                            value={newEnvValue}
                            onChange={(event) => setNewEnvValue(event.target.value)}
                            placeholder="Value"
                            className="h-10 min-w-0 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-border-strong"
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
                            className="h-10 rounded-lg border border-border bg-card px-4 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {(envNames.length > 0 || Object.keys(envValues).length > 0) && (
                        <button
                          type="button"
                          onClick={onEnvSave}
                          disabled={busy !== null}
                          className="mt-2 h-10 w-full rounded-lg bg-foreground px-3 text-[13px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-50"
                        >
                          {busy === "env" ? "Saving..." : "Save and update preview"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
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
  const hasStoredDeployments = Boolean(deploymentLinks?.netlify?.siteUrl || deploymentLinks?.vercel?.siteUrl)

  return (
    <div className="lotus-glass-strong fixed inset-x-3 bottom-[5.6rem] z-50 max-h-[min(72dvh,36rem)] overflow-y-auto rounded-[1.45rem] border border-border/60 p-4 [scrollbar-width:thin] sm:hidden">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Get your website online</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">Your site goes live in seconds.</p>
        </div>
        <button type="button" onClick={onClose}
          className="lotus-glass-control flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span className="text-base leading-none">×</span>
        </button>
      </div>

      {/* Success state */}
      {!state.busy && visibleStateSiteUrl && !state.error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <p className="text-[13px] font-semibold text-foreground">Your website is live!</p>
          </div>
          <a href={visibleStateSiteUrl} target="_blank" rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-success py-3.5 text-[13px] font-bold text-success-foreground transition-colors hover:bg-success/90">
            <Globe className="h-4 w-4" />
            Visit your website
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
          <DeployTerminal logs={state.logs} currentStep={state.step} />
        </div>
      )}

      {/* Deploying state */}
      {state.busy && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-foreground" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                Publishing to {state.provider ? getDeployProviderLabel(state.provider) : "your host"}…
              </p>
              {state.step && <p className="mt-0.5 text-[12px] text-muted-foreground">{state.step}</p>}
            </div>
          </div>
          <DeployTerminal logs={state.logs} currentStep={state.step} />
        </div>
      )}

      {/* Error state */}
      {!state.busy && state.error && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Couldn't publish your website</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{state.error}</p>
            </div>
          </div>
          <DeployTerminal logs={state.logs} currentStep={state.step} />
          {state.provider && (
            <button type="button" onClick={() => onDeploy(state.provider!)}
              className="lotus-glass-control flex w-full items-center justify-center gap-2 rounded-full border py-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted">
              <Rocket className="h-4 w-4" />
              Try again
            </button>
          )}
        </div>
      )}

      {/* Provider selection (default) */}
      {!state.busy && !state.step && !state.error && (
        <div className="space-y-3">
          {hasStoredDeployments && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your live sites</p>
              {(["netlify", "vercel"] as DeployProvider[]).map((provider) => {
                const link = deploymentLinks?.[provider]
                if (!link?.siteUrl) return null
                return (
                  <a key={provider} href={link.siteUrl} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-full border border-success/30 bg-success/5 px-4 py-3 text-[12px] font-semibold text-foreground transition-colors hover:bg-success/10">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-success" />
                      <span>{getDeployProviderLabel(provider)} site</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-success">
                      <span className="text-[10px] font-medium">Live</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </a>
                )
              })}
              <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deploy to a new platform</p>
            </div>
          )}
          <div className="space-y-2">
            <button type="button" onClick={() => onDeploy("netlify")} disabled={state.busy}
              className="lotus-glass-control flex w-full items-center justify-between rounded-[1.75rem] border px-4 py-3.5 text-left transition-all hover:border-border-strong hover:bg-muted disabled:opacity-40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">Netlify</span>
                  <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success">Free</span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">No credit card. Best for most websites.</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            <button type="button" onClick={() => onDeploy("vercel")} disabled={state.busy}
              className="lotus-glass-control flex w-full items-center justify-between rounded-[1.75rem] border px-4 py-3.5 text-left transition-all hover:border-border-strong hover:bg-muted disabled:opacity-40">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Vercel</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Fast and reliable. Great for React apps.</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
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
  const [desktopChatCollapsed, setDesktopChatCollapsed] = useState(false)
  const [localMessages,     setLocalMessages]     = useState<LocalMessage[]>([])
  const [isStartingRun,     setIsStartingRun]     = useState(false)
  const [runError,          setRunError]          = useState<string | null>(null)
  const [optimisticStart,   setOptimisticStart]   = useState(false)
  const [activeTab,         setActiveTab]         = useState<WorkspaceTab>("preview")
  const [editingMsgIndex,   setEditingMsgIndex]   = useState<number | null>(null)
  const [editText,          setEditText]          = useState("")
  const [deployOpen,        setDeployOpen]        = useState(false)
  const [historyOpen,       setHistoryOpen]       = useState(false)
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
  const [previewNavSrc, setPreviewNavSrc] = useState<string | null>(null)
  const [previewReloadNonce, setPreviewReloadNonce] = useState(0)
  const [runtimeError,      setRuntimeError]      = useState<{ message: string; stack: string } | null>(null)
  const [fixingError,       setFixingError]       = useState(false)
  const [stoppedSessionIds, setStoppedSessionIds] = useState<Set<string>>(() => new Set(readStoppedComputerSessions()))
  const [computerTheme,     setComputerTheme]     = useState<ComputerTheme>("dark")
  const hasStartedRef = useRef(false)
  const runAbortRef = useRef<AbortController | null>(null)
  const previousPreviewUrlRef = useRef<string | null | undefined>(undefined)
  const previewEnsureKeyRef = useRef<string | null>(null)
  const prevSessionStatusRef = useRef<ComputerSessionStatus | null>(null)
  const prevMobileSyncStatusRef = useRef<ComputerSessionStatus | null>(null)
  const lastCodeEventCountRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return

    const savedTheme = window.localStorage.getItem(COMPUTER_THEME_KEY)
    if (savedTheme === "light" || savedTheme === "dark") {
      setComputerTheme(savedTheme)
      return
    }

    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false
    setComputerTheme(prefersLight ? "light" : "dark")
  }, [])

  const handleThemeToggle = useCallback(() => {
    setComputerTheme((current) => {
      const next = current === "dark" ? "light" : "dark"
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COMPUTER_THEME_KEY, next)
      }
      return next
    })
  }, [])

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
          prompt:      typeof d.prompt      === "string" ? d.prompt      : undefined,
          status:      normalizeStatus(d.status),
          sessionMode: typeof d.sessionMode === "string" ? d.sessionMode : undefined,
          timeline:    normalizeTimeline(d.timeline),
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

  // ── Agent context usage (estimated) ──────────────────────────────────────
  const agentContextUsage = useMemo(() => {
    const MAX_CONTEXT = 200_000   // Claude Sonnet 4.6 context window
    const MAX_OUTPUT  = 16_000    // max_tokens in agentic-generation.ts
    const SYS_OVERHEAD = 1_800   // system prompt token estimate

    const turns = session?.conversationTurns ?? []
    // Mirror server-side: exclude agent_decision, last 12 turns
    const userFacing = turns
      .filter((t) => t.source !== "agent_decision")
      .slice(-12)

    const conversationTokens = userFacing.reduce(
      (acc, t) => acc + Math.ceil(t.content.length / 4), 0
    )

    const inputTokens  = conversationTokens + SYS_OVERHEAD
    const outputTokens = Math.min(MAX_OUTPUT, generatedFileCount * 350)
    const totalTokens  = inputTokens + outputTokens

    return {
      maxTokens: MAX_CONTEXT,
      usedTokens: totalTokens,
      usage: {
        inputTokens,
        outputTokens,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        totalTokens,
      },
    }
  }, [session?.conversationTurns, generatedFileCount])

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
  useEffect(() => { setPreviewNavSrc(null) }, [session?.previewUrl])
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
      if (event.origin !== new URL(session.previewUrl!).origin) return
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

  // ── handleApprovePlan — approves a plan and triggers code generation ──────
  const handleApprovePlan = useCallback(async () => {
    if (!session || isRunning) return
    // Best-effort flag write; the authoritative approval is the run request
    // below. The `sessions` collection is not client-writable under Firestore
    // rules, so a rejection here must not block the build.
    try {
      await updateDoc(doc(db, "sessions", session.id), { planApproved: true })
    } catch {
      // ignore — approval is carried by the run request
    }
    await handleRun("Approved. Build from the plan.")
  }, [session, isRunning, handleRun])

  const showPlanApproval = useMemo(() => {
    if (!session || isRunning) return false
    if (session.sessionMode !== "plan") return false
    const events = session.timeline
    const hasPlan = events.some(
      (e) => e.kind === "planning" && e.status === "complete" && e.title === "Planning execution"
    )
    const hasGenerated = events.some(
      (e) => e.status === "complete" && e.kind === "code" && e.title?.startsWith("Generating ")
    )
    return hasPlan && !hasGenerated
  }, [session, isRunning])

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

    // Prune discarded runs from versions and restore files to the branch point.
    if (runIdsToRemove.size > 0 && session.projectId) {
      try {
        const auth = await getOptionalAuthHeader()
        await fetch(`/api/projects/${encodeURIComponent(session.projectId)}/versions/branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ removeRunIds: Array.from(runIdsToRemove) }),
        })
      } catch {
        // Best effort — timeline prune still proceeds.
      }
    }

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

  const handleHistoryRestored = useCallback(async () => {
    const projectId = session?.projectId
    if (!projectId || !session) return

    previewEnsureKeyRef.current = null
    setPreviewEnsureError(null)
    setPreviewRetryNonce((current) => current + 1)
    setActiveTab("preview")
    setMobileView("workspace")

    try {
      const auth = await getOptionalAuthHeader()
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ensure-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ force: true }),
      })
      const json = await res.json().catch(() => ({})) as { previewUrl?: string; error?: string }
      if (!res.ok || !json.previewUrl) {
        throw new Error(json.error || "Failed to refresh preview")
      }
      await updateDoc(doc(db, "computerSessions", session.id), {
        previewUrl: String(json.previewUrl),
      })
    } catch (err) {
      setPreviewEnsureError(err instanceof Error ? err.message : "Could not refresh preview after restore.")
    }
  }, [getOptionalAuthHeader, session])

  const handleRestoreCheckpoint = useCallback(async (targetRunId: string) => {
    if (!session?.projectId || !session?.id) return
    if (session.status === "running" || session.status === "planning") return

    const { firstRunId, followUpRunIds } = getRunIdGroups(session.timeline)
    const allRunIds = [firstRunId, ...followUpRunIds].filter((id): id is string => Boolean(id))
    const targetIndex = allRunIds.indexOf(targetRunId)
    if (targetIndex === -1) throw new Error("Checkpoint not found in timeline")

    const runIdsToRemove = new Set(allRunIds.slice(targetIndex + 1))

    const prunedTimeline = session.timeline.filter(
      (e) => !e.runId || !runIdsToRemove.has(e.runId)
    )
    const prunedConversationTurns = (session.conversationTurns ?? []).filter(
      (turn) => !turn.runId || !runIdsToRemove.has(turn.runId)
    )

    // Prune local messages immediately for instant UI feedback
    setLocalMessages((msgs) => msgs.slice(0, targetIndex))

    // Prune session state in Firestore
    await updateDoc(doc(db, "computerSessions", session.id), {
      timeline: prunedTimeline,
      conversationTurns: prunedConversationTurns,
      status: "idle",
    })

    // Restore project files via server (requires admin SDK)
    const auth = await getOptionalAuthHeader()
    const res = await fetch("/api/computer/restore-checkpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ sessionId: session.id, targetRunId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error || "Could not restore checkpoint")
    }

    // Refresh preview to reflect restored files
    previewEnsureKeyRef.current = null
    setPreviewRetryNonce((n) => n + 1)
    setActiveTab("preview")
    setMobileView("workspace")
  }, [getOptionalAuthHeader, session, setLocalMessages, setActiveTab, setMobileView])

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
      const data = await res.json().catch(() => ({})) as GitHubSyncResponse
      if (!res.ok || data.ok !== true) {
        const code = data.code || data.error || ""
        const message = data.message || data.error || "GitHub sync failed"
        if (code === "github_not_connected" || code === "github_reconnect_required" || /not connected/i.test(message)) {
          const returnTo = encodeURIComponent(`/computer/${session.id}`)
          const start = await fetch(`/api/github/oauth/start?projectId=${encodeURIComponent(session.projectId)}&returnTo=${returnTo}`, {
            headers: auth,
          })
          const startJson = await start.json().catch(() => ({})) as { url?: string; error?: string }
          if (!start.ok || !startJson.url) throw new Error(startJson.error || message)
          window.location.href = startJson.url
          return
        }
        throw new Error(message)
      }
      if (!data.repoUrl || !data.repoFullName) {
        throw new Error("GitHub did not return a repository for this project.")
      }
      setProjectIntegration((current) => ({
        ...(current || {}),
        githubRepoUrl: data.repoUrl,
        githubRepoFullName: data.repoFullName,
        githubSyncedAt: data.syncedAt || new Date().toISOString(),
      }))
      setIntegrationMessage(`Synced to ${data.repoFullName}.`)
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
    try {
      const auth = await getOptionalAuthHeader()
      const res = await fetch("/api/computer/supabase-decline", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ sessionId: session.id }),
      })
      if (!res.ok) throw new Error("decline endpoint failed")
    } catch {
      // fallback: direct client write if the endpoint is unavailable
      await updateDoc(doc(db, "computerSessions", session.id), { supabaseAnswer: "no" }).catch(() => {})
    }
  }, [session?.id, getOptionalAuthHeader])

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
      if (event.origin !== window.location.origin) return
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
    <div
      className={cn(
        "relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground",
        computerTheme === "dark" && "dark bg-[oklch(0.18_0_0)]",
      )}
    >
      {/* ── App shell ── */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">

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
          setHistoryOpen(false)
        }}
        onOpenDeploy={() => {
          setDeployOpen(true)
          setIntegrationsOpen(false)
          setHistoryOpen(false)
        }}
        onOpenHistory={() => {
          setHistoryOpen(true)
          setDeployOpen(false)
          setIntegrationsOpen(false)
        }}
        chatPanelCollapsed={desktopChatCollapsed}
        onToggleChatPanel={() => setDesktopChatCollapsed((c) => !c)}
        activeTab={activeTab}
        hasPreview={hasPreview}
        hasBrowser={hasBrowser}
        hasResearch={hasResearch}
        hasCode={projectFileCount > 0}
        onTabChange={setActiveTab}
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
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">

        {/* ── Chat panel ── */}
        <div className={cn(
          "flex w-full shrink-0 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_76%,transparent)] backdrop-blur-2xl transition-[width] duration-200 ease-in-out",
          desktopChatCollapsed
            ? "sm:w-0 sm:overflow-hidden"
            : "sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px] 2xl:w-[400px]",
          mobileView !== "feed" && "hidden sm:flex"
        )}>
          {/* Feed scroll area */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* flex + flex-col on the scroller so the inner flex-1 spacer works */}
            <div className="chat-scrollbar flex h-full flex-col overflow-y-auto px-4 lg:px-5">
              {/* Top spacer: pushes content to bottom when feed is short (chat-app behavior) */}
              <div className="flex-1 pt-4" />
              <div className="pb-4">
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
                  onApprovePlan={showPlanApproval ? handleApprovePlan : undefined}
                  onRestoreCheckpoint={handleRestoreCheckpoint}
                />
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 px-3 pt-2 [padding-bottom:max(4.5rem,calc(env(safe-area-inset-bottom)+3.25rem))] sm:pb-3 lg:px-4">
            {isBuildTokenBlocked && (
              <div className="lotus-glass-panel mb-3 rounded-xl border border-border/55 px-3 py-2.5 shadow-sm">
                <p className="text-sm font-medium text-foreground">You have used all credits for this cycle.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upgrade your plan to continue running the computer agent.{" "}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">View plans</Link>
                </p>
              </div>
            )}
            {runError && !isBuildTokenBlocked && (
              <div className="lotus-glass-panel mb-3 rounded-xl border border-destructive/20 px-3 py-2.5 shadow-sm">
                <p className="text-[11.5px] text-destructive">{getRunErrorMessage(runError)}</p>
              </div>
            )}
            <AnimatedAIInput
              mode="chat" compact compactSize="slim"
              isLoading={isRunning} onStop={handleStop} onSubmit={handleRun}
              placeholder="Message the agent..."
              disabled={isBuildTokenBlocked}
              wrapperClassName="lotus-glass-control border-border/60"
            />
          </div>
        </div>

        {/* ── Workspace panel ── */}
        <div className={cn(
          "lotus-glass-strong m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 shadow-[0_28px_90px_-64px_rgba(0,0,0,0.9)]",
          mobileView !== "workspace" && "hidden sm:flex"
        )}>
          {/* Workspace content — fills panel edge to edge */}
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_88%,transparent)]">
              <WorkspaceTabBar
                activeTab={activeTab}
                previewUrl={session.previewUrl}
                onRefreshPreview={() => setPreviewReloadNonce((n) => n + 1)}
                onNavigatePreview={(url) => setPreviewNavSrc(url)}
              />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
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
                  onRetryPreview={() => {
                    previewEnsureKeyRef.current = null
                    setPreviewEnsureError(null)
                    setPreviewRetryNonce((n) => n + 1)
                  }}
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
        </div>

      </div>
      </div>

      {/* ── Mobile view switcher ── */}
      <nav
        aria-label="Switch between chat and preview"
        className="lotus-glass-strong absolute inset-x-3 z-20 mx-auto max-w-xs rounded-full border border-border/50 px-1 py-1 shadow-[0_22px_70px_-42px_rgba(0,0,0,0.9)] sm:hidden"
        style={{ bottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
      >
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            aria-current={mobileView === "feed" ? "page" : undefined}
            onClick={() => setMobileView("feed")}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mobileView === "feed"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Chat
          </button>
          <button
            type="button"
            aria-current={mobileView === "workspace" ? "page" : undefined}
            onClick={() => { setMobileView("workspace"); setActiveTab("preview") }}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mobileView === "workspace"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </button>
        </div>
      </nav>

      <TokenLimitDialog
        open={tokenLimitModalOpen}
        onOpenChange={setTokenLimitModalOpen}
        description="This workspace has no credits left in the current cycle. Upgrade to continue running the computer agent."
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
