"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { doc, onSnapshot, updateDoc } from "firebase/firestore"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronsDown,
  ChevronsUp,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Github,
  Globe2,
  KeyRound,
  Laptop,
  LayoutPanelLeft,
  Loader2,
  MessageSquare,
  Monitor,
  Pencil,
  Rocket,
  Search,
  ShieldAlert,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Button } from "@/components/ui/button"
import { TokenLimitDialog } from "@/components/project/token-limit-dialog"
import { BashTool } from "@/components/project/bash-tool"
import { EditTool } from "@/components/project/edit-tool"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { DeployTerminal } from "@/components/project/deploy-terminal"
import { QuestionTool, type QuestionConfig, type QuestionAnswer } from "@/components/computer/question-tool"

// ─── Types (unchanged) ────────────────────────────────────────────────────────

type ComputerSessionStatus = "idle" | "planning" | "running" | "error" | "complete"

type ComputerTimelineEvent = {
  id?: string
  title: string
  status: "pending" | "running" | "complete" | "error" | "skipped"
  kind?: "understanding" | "research" | "browser" | "planning" | "code" | "sandbox" | "fix" | "security" | "user" | "question"
  createdAt: string
  description?: string
  runId?: string
  index: number
  metadata?: Record<string, string | number | boolean | null>
}

type ComputerSessionResponse = {
  id: string
  prompt?: string
  status: ComputerSessionStatus
  timeline: ComputerTimelineEvent[]
  previewUrl?: string | null
  projectId?: string
}

type WorkspaceTab = "preview" | "browser" | "research"
type MobileView  = "feed" | "workspace"

type BrowserInspection = {
  url: string
  liveUrl: string
  sessionId?: string
  baseUrl?: string
  provider?: string
  title: string
  expiresAt?: string
  isExpired: boolean
}

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

type LocalMessage = {
  role: "user" | "system"
  content: string
  runId?: string
}

// ─── Constants (unchanged) ────────────────────────────────────────────────────

const STATUS_STYLES: Record<ComputerSessionStatus, string> = {
  idle:     "border-border bg-muted text-muted-foreground",
  planning: "border-info/20 bg-info-soft text-info-soft-foreground",
  running:  "border-warning/25 bg-warning-soft text-warning-soft-foreground",
  error:    "border-destructive/20 bg-destructive/10 text-destructive",
  complete: "border-success/25 bg-success-soft text-success-soft-foreground",
}

const STATUS_LABELS: Record<ComputerSessionStatus, string> = {
  idle:     "Ready",
  planning: "Thinking",
  running:  "Thinking",
  error:    "Error",
  complete: "Done",
}

const STATUS_DOT: Record<ComputerSessionStatus, string> = {
  idle:     "bg-border-strong",
  planning: "bg-info",
  running:  "bg-warning",
  error:    "bg-destructive",
  complete: "bg-success",
}

type KindConfig = {
  icon: React.ElementType
  bg: string
  border: string
  iconColor: string
  label: string
}

const KIND_CONFIG: Record<string, KindConfig> = {
  understanding: { icon: Brain,     bg: "bg-accent-soft",  border: "border-accent/20", iconColor: "text-accent", label: "Understanding" },
  research:      { icon: Search,    bg: "bg-info-soft",    border: "border-info/20",   iconColor: "text-info",   label: "Research"      },
  browser:       { icon: Globe2,    bg: "bg-info-soft",    border: "border-info/20",   iconColor: "text-info",   label: "Browser"       },
  planning:      { icon: Activity,  bg: "bg-warning-soft", border: "border-warning/25",iconColor: "text-warning",label: "Planning"      },
  code:          { icon: Code2,     bg: "bg-success-soft", border: "border-success/25",iconColor: "text-success",label: "Coding"        },
  sandbox:       { icon: Terminal,  bg: "bg-muted",        border: "border-border",    iconColor: "text-muted-foreground", label: "Sandbox" },
  fix:           { icon: Wrench,    bg: "bg-warning-soft", border: "border-warning/25",iconColor: "text-warning", label: "Fixing"        },
  security:      { icon: ShieldAlert,bg: "bg-destructive/10", border: "border-destructive/20", iconColor: "text-destructive", label: "Security" },
  user:          { icon: MessageSquare,bg:"bg-muted",      border: "border-border",    iconColor: "text-muted-foreground", label: "User"    },
}

function getKindCfg(kind?: string): KindConfig {
  return KIND_CONFIG[kind ?? ""] ?? { icon: Zap, bg: "bg-muted", border: "border-border", iconColor: "text-muted-foreground", label: "" }
}

const EVENT_TITLES: Record<string, string> = {
  "Run started":          "Starting run",
  "Understanding request":"Reading request",
  "Understanding insight":"Understanding insight",
  "Planning execution":   "Planning approach",
  "Planning failed":      "Planning hit a snag",
  "Decision":             "Deciding next step",
  "Web plan":             "Planning web context",
  "Web skipped":          "Web context skipped",
  "Researching web":      "Researching",
  "Research complete":    "Research complete",
  "Research insight":     "Research insight",
  "Research failed":      "Research failed",
  "Research skipped":     "Research skipped",
  "Browser decision":     "Choosing whether to inspect",
  "Browser live":         "browser live",
  "Browser fallback":     "Collecting page context",
  "Page inspected":       "Page inspected",
  "Browser insight":      "Browser insight",
  "Browser failed":       "Browser failed",
  "Browser skipped":      "Browser skipped",
  "Scrape context collected": "Page context collected",
  "Fallback scrape collected": "Fallback context collected",
  "Scrape failed":        "Page context failed",
  "Generation decision":  "Preparing build",
  "Build approach":       "Build approach",
  "Code generated":       "Application generated",
  "Generation failed":    "Generation failed",
  "Fix applied":          "Fix applied",
  "Fix failed":           "Fix failed",
  "Starting sandbox":     "Starting preview",
  "Preview ready":        "Preview ready",
  "Sandbox run successful":"Preview running",
  "Sandbox error":        "Preview error",
  "Runtime fix applied":  "Runtime fix applied",
  "Runtime fix failed":   "Runtime fix failed",
  "Run failed":           "Run failed",
}

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

function shortenId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}...${id.slice(-4)}`
}

function normalizeStatus(status: unknown): ComputerSessionStatus {
  return status === "idle" || status === "planning" || status === "running" ||
    status === "error" || status === "complete" ? status : "idle"
}

function normalizeTimeline(timeline: unknown): ComputerTimelineEvent[] {
  if (!Array.isArray(timeline)) return []
  return timeline
    .map((e, i) => ({ ...(e as ComputerTimelineEvent), index: typeof (e as { index?: unknown }).index === "number" ? (e as { index: number }).index : i }))
    .sort((a, b) => a.index - b.index)
}

function getEventTitle(event: ComputerTimelineEvent) {
  return EVENT_TITLES[event.title] || event.title
}

function isBrowserLiveViewExpired(event: ComputerTimelineEvent) {
  const explicitExpiry = typeof event.metadata?.browserExpiresAt === "string" ? event.metadata.browserExpiresAt : ""
  const expiryTime = explicitExpiry ? Date.parse(explicitExpiry) : NaN
  if (Number.isFinite(expiryTime)) return Date.now() >= expiryTime

  const createdTime = Date.parse(event.createdAt)
  if (!Number.isFinite(createdTime)) return false
  return Date.now() - createdTime > 5 * 60 * 1000
}

function getLatestBrowserInspection(events: ComputerTimelineEvent[]): BrowserInspection | null {
  const browserEvents = [...events].sort((a, b) => a.index - b.index).reverse()
  const found = browserEvents.find((e) =>
    e.kind === "browser" &&
    e.title !== "Browser live" &&
    typeof e.metadata?.targetUrl === "string" &&
    (e.metadata.targetUrl as string).startsWith("http")
  )
  if (!found?.metadata) return null
  const url = typeof found.metadata.targetUrl === "string" ? found.metadata.targetUrl : ""
  if (!url) return null
  const liveUrl =
    typeof found.metadata.browserLiveUrl === "string" && found.metadata.browserLiveUrl.startsWith("http")
      ? found.metadata.browserLiveUrl
      : ""
  return {
    url,
    liveUrl,
    sessionId: typeof found.metadata.browserSessionId === "string" ? found.metadata.browserSessionId : undefined,
    baseUrl:   typeof found.metadata.browserBaseUrl   === "string" ? found.metadata.browserBaseUrl   : undefined,
    provider:  typeof found.metadata.browserProvider  === "string" ? found.metadata.browserProvider  : undefined,
    expiresAt: typeof found.metadata.browserExpiresAt === "string" ? found.metadata.browserExpiresAt : undefined,
    isExpired: liveUrl ? isBrowserLiveViewExpired(found) : false,
    title:     typeof found.metadata.pageTitle === "string" && found.metadata.pageTitle.trim() ? found.metadata.pageTitle : url,
  }
}

function getBrowserProviderLabel(provider?: string) {
  return "Browser"
}

function isTokenLimitError(message?: string | null) {
  return /insufficient tokens|out of credits|token limit|no credits/i.test(message || "")
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

function formatClarificationAnswer(question: QuestionConfig, answer?: QuestionAnswer) {
  if (!answer || answer.kind === "skip") return "Skipped"
  if (answer.kind === "text") return answer.text?.trim() || "Answered"

  const optionLabels = new Map((question.options ?? []).map((option) => [option.id, option.label]))
  const selected = (answer.selectedIds ?? [])
    .map((id) => optionLabels.get(id) ?? id)
    .filter(Boolean)
  const parts = [...selected]
  if (answer.text?.trim()) parts.push(answer.text.trim())

  return parts.join(", ") || "Answered"
}

function formatClarificationAnswerSet(
  questions: QuestionConfig[],
  answersByQuestion?: Record<number, QuestionAnswer>,
  fallbackAnswer?: QuestionAnswer
) {
  if (fallbackAnswer?.kind === "skip") return "skip"

  const answerEntries = questions
    .map((question, index) => ({
      question,
      answer: answersByQuestion?.[index + 1] ?? (questions.length === 1 ? fallbackAnswer : undefined),
    }))
    .filter((entry) => entry.answer)

  if (answerEntries.length === 0) return "skip"

  return answerEntries
    .map(({ question, answer }) => `Question: ${question.title}\nAnswer: ${formatClarificationAnswer(question, answer)}`)
    .join("\n\n")
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

// Returns the first-run id and an ordered list of follow-up run ids derived from the timeline.
// Used both by AgentFeed (display) and handleEditSubmit (pruning).
function getRunIdGroups(events: ComputerTimelineEvent[]): { firstRunId: string | null; followUpRunIds: string[] } {
  const visible = events.filter((e) => e.title !== "Session created")
  const firstRunId = visible.find((e) => e.runId)?.runId ?? null
  const seen = new Set<string>()
  const followUpRunIds: string[] = []
  for (const event of visible) {
    if (!event.runId || event.runId === firstRunId) continue
    if (!seen.has(event.runId)) {
      seen.add(event.runId)
      followUpRunIds.push(event.runId)
    }
  }
  return { firstRunId, followUpRunIds }
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function PulseDot({ color, active }: { color: string; active?: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      {active && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />}
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", color)} />
    </span>
  )
}

function StatusBadge({ status }: { status: ComputerSessionStatus }) {
  const isActive = status === "planning" || status === "running"
  return (
    <div className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2",
      "text-[10px] font-semibold tracking-[0.04em] shadow-sm sm:h-6 sm:px-2 sm:py-0 sm:uppercase sm:tracking-[0.12em] sm:shadow-none",
      STATUS_STYLES[status]
    )}>
      <PulseDot color={STATUS_DOT[status]} active={isActive} />
      {STATUS_LABELS[status]}
    </div>
  )
}

// ─── Step strip ───────────────────────────────────────────────────────────────

function DeployButton({
  projectId,
  open,
  state,
  deploymentLinks,
  onOpenChange,
  onDeploy,
}: {
  projectId?: string
  open: boolean
  state: DeployState
  deploymentLinks?: Partial<Record<DeployProvider, DeploymentLink>>
  onOpenChange: (open: boolean) => void
  onDeploy: (provider: DeployProvider) => void
}) {
  if (!projectId) return null
  const visibleStateSiteUrl = state.siteUrl || (state.provider ? deploymentLinks?.[state.provider]?.siteUrl ?? null : null)
  const hasStoredDeployments = Boolean(deploymentLinks?.netlify?.siteUrl || deploymentLinks?.vercel?.siteUrl)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        disabled={state.busy}
        aria-label="Deploy project"
        aria-expanded={open}
        className={cn(
          "group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-xl bg-accent pl-2.5 pr-2 text-[13px] font-semibold text-accent-foreground transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70 sm:pl-3 sm:pr-2.5",
          "shadow-[0_8px_20px_-10px_var(--accent)] hover:shadow-[0_12px_28px_-10px_var(--accent)]"
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-primary-foreground/0 transition-colors duration-200 group-hover:bg-primary-foreground/10" />
        <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-primary-foreground/15">
          {state.busy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Rocket className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
        </span>
        <span className="relative hidden sm:inline">Deploy</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 hidden w-[480px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 shadow-[0_18px_60px_-24px_var(--primary)] sm:block">
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
                className="rounded-xl border border-border bg-card px-3 py-2 text-left text-[12px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{getDeployProviderLabel(provider)} live site</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                )
              })}
            </div>
          )}

          {(state.step || state.error || visibleStateSiteUrl) && (
            <div className="mt-2 rounded-xl border border-border bg-card p-2.5">
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
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-[11px] font-bold text-success-foreground shadow-sm transition-all hover:bg-success/90 active:scale-[0.98]"
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
}) {
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvValue, setNewEnvValue] = useState("")
  if (!projectId) return null

  const envNames = project?.envVarNames || []
  const hasGitHub = Boolean(project?.githubRepoUrl || project?.githubRepoFullName)
  const hasSupabase = Boolean(project?.supabaseUrl || project?.supabaseProjectRef)
  const syncedAt = formatSyncedAt(project?.githubSyncedAt)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Project integrations"
        aria-expanded={open}
        className={cn(
          "group inline-flex h-9 items-center gap-2 rounded-xl pl-2 pr-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.97] sm:pr-2.5",
          open
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-200",
          open ? "bg-card text-foreground shadow-sm" : "bg-muted text-muted-foreground group-hover:bg-card group-hover:text-foreground group-hover:shadow-sm"
        )}>
          <KeyRound className="h-3.5 w-3.5" />
        </span>
        <span className="hidden sm:inline">Integrations</span>
        <ChevronDown className={cn("hidden h-3.5 w-3.5 opacity-50 transition-transform duration-200 sm:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 hidden w-[360px] rounded-2xl border border-border bg-card p-3 shadow-[0_18px_60px_-24px_var(--primary)] sm:block">
          <div className="mb-3">
            <p className="text-[12px] font-semibold text-foreground">Project integrations</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Connect services directly to this generated website.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="rounded-xl border border-border bg-card p-3">
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
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground disabled:opacity-60"
                >
                  {busy === "github" ? "Syncing..." : hasGitHub ? "Sync" : "Publish"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
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
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground disabled:opacity-60"
                >
                  {busy === "supabase" ? "Setting up..." : hasSupabase ? "Re-run" : "Set up"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
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
                    className="rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onEnvSave}
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground disabled:opacity-60"
                >
                  {busy === "env" ? "Saving..." : "Save and update preview"}
                </button>
              </div>
            </div>
          </div>

          {message ? (
            <p className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
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
    <div className="fixed inset-x-3 bottom-[5.6rem] z-50 max-h-[min(72dvh,32rem)] overflow-y-auto rounded-[1.45rem] border border-border bg-card p-3 shadow-[0_24px_80px_-28px_var(--primary)] [scrollbar-width:thin] sm:hidden">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Deploy website</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Publish this generated project.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground">
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
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3 text-left text-[13px] font-semibold text-foreground shadow-sm disabled:opacity-60"
          >
            <span>{getDeployProviderLabel(provider)}</span>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      {visibleStateSiteUrl && (
        <a href={visibleStateSiteUrl} target="_blank" rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-success py-3 text-[12px] font-bold text-success-foreground">
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
    <div className="fixed inset-x-3 bottom-[5.6rem] z-50 max-h-[min(72dvh,32rem)] overflow-y-auto rounded-[1.45rem] border border-border bg-card p-3 shadow-[0_24px_80px_-28px_var(--primary)] [scrollbar-width:thin] sm:hidden">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Integrations</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Connect services to this website.</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground">
          <span className="text-base leading-none">×</span>
        </button>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onGithubSync}
          disabled={busy !== null}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-sm disabled:opacity-60"
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
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-sm disabled:opacity-60"
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

// ─── Plan description renderer ────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-zinc-700">{part.slice(2, -2)}</strong>
      : part
  )
}

function PlanDescription({ text }: { text: string }) {
  return (
    <div className="space-y-0.5 text-[12.5px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-1.5" />
        if (t.match(/^#\s+/)) return null
        const h2 = t.match(/^##\s+(.+)/)
        if (h2) return <p key={i} className="pt-2 pb-0.5 text-[12px] font-semibold text-zinc-800">{renderInline(h2[1])}</p>
        const h3 = t.match(/^###\s+(.+)/)
        if (h3) return <p key={i} className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{h3[1]}</p>
        const li = t.match(/^[-*]\s+(.+)/)
        if (li) return (
          <div key={i} className="flex items-start gap-2 text-zinc-500">
            <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-zinc-300" />
            <span>{renderInline(li[1])}</span>
          </div>
        )
        return <p key={i} className="text-zinc-500">{renderInline(t)}</p>
      })}
    </div>
  )
}

// ─── Feed item ────────────────────────────────────────────────────────────────

function SupabaseQuestionCard({ onSetup, onDecline }: { onSetup: () => void; onDecline?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const [setting, setSetting] = useState(false)

  if (dismissed) return null

  const handleSetup = async () => {
    setSetting(true)
    try {
      await onSetup()
    } finally {
      setSetting(false)
    }
  }

  const handleDecline = () => {
    setDismissed(true)
    onDecline?.()
  }

  return (
    <div className="my-3 overflow-hidden rounded-[10px] border border-border bg-muted shadow-sm">
      <div className="flex h-8 items-center justify-between pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Database className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate text-xs text-zinc-500">Backend detected</span>
        </div>
      </div>
      <div className="border-t border-border bg-white px-3 py-3">
        <p className="text-sm font-medium text-foreground">This app needs a database</p>
        <p className="mt-1 text-xs text-zinc-500">
          Connect Supabase to add auth, persistent storage, and a live backend — automatically wired into your code.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetup}
            disabled={setting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {setting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            {setting ? "Setting up..." : "Set up Supabase"}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={setting}
            className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

function getPlanFileName(event: ComputerTimelineEvent) {
  const rawId = event.id?.trim()
  if (!rawId) return "plan-working.md"
  return `plan-${rawId.slice(0, 8)}.md`
}

function PlanTool({ event }: { event: ComputerTimelineEvent }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const summary = event.description?.trim() || ""
  const hasSummary = summary.length > 0

  return (
    <div className="my-3 overflow-hidden rounded-[10px] border border-border bg-muted shadow-sm">
      <div className="flex h-8 items-center justify-between pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate text-xs text-zinc-500">{getPlanFileName(event)}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-label={isExpanded ? "Collapse plan" : "Expand plan"}
          className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-zinc-500 transition-colors hover:bg-white hover:text-foreground"
        >
          {isExpanded ? <ChevronsUp className="h-3.5 w-3.5" /> : <ChevronsDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="border-t border-border bg-white pt-2">
        <div className="px-3 text-sm font-medium text-foreground">Plan drafted</div>

        {hasSummary ? (
          <div className="relative mt-1">
            <div className={cn("px-3 pb-2 text-zinc-500", !isExpanded && "max-h-[94px] overflow-hidden")}>
              <PlanDescription text={summary} />
            </div>
            {!isExpanded && (
              <div className="absolute inset-x-0 bottom-0 h-16 px-3 pb-2">
                <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-b from-transparent to-white" />
                <div className="relative flex h-full items-end">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="-mx-1.5 h-5 rounded-[4px] px-1.5 text-xs text-zinc-500 transition-colors hover:text-foreground"
                  >
                    Read detailed plan
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 pb-2 text-xs text-zinc-500">No plan summary provided.</div>
        )}

        {(isExpanded || !hasSummary) && (
          <div className="mt-2 flex items-center justify-between border-t border-border bg-muted py-2 pl-3.5 pr-2">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="-mx-1.5 h-5 rounded-[4px] px-1.5 text-xs text-zinc-500 transition-colors hover:text-foreground"
            >
              {isExpanded ? "Hide detailed plan" : "Read detailed plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const PROSE_EVENTS = ["Understanding insight", "Research insight", "Browser insight", "Build approach"]

function getGeneratingFilePath(event: ComputerTimelineEvent) {
  if (typeof event.metadata?.filePath === "string") return event.metadata.filePath
  return event.title.startsWith("Generating ") ? event.title.slice("Generating ".length).trim() : undefined
}

function getEditToolVariant(event: ComputerTimelineEvent): "edit" | "write" {
  return event.metadata?.editVariant === "edit" ? "edit" : "write"
}

function getFileContentMetadata(event: ComputerTimelineEvent) {
  return {
    oldContent: typeof event.metadata?.oldContent === "string" ? event.metadata.oldContent : undefined,
    newContent: typeof event.metadata?.newContent === "string" ? event.metadata.newContent : undefined,
  }
}

function getCommandMetadata(event: ComputerTimelineEvent) {
  const command = typeof event.metadata?.command === "string" ? event.metadata.command : ""
  if (!command.trim()) return null
  const output = typeof event.metadata?.commandOutput === "string" ? event.metadata.commandOutput : undefined
  return { command, output }
}

function FeedItem({ event, isLatest, onSupabaseSetup, onSupabaseDecline, onClarificationAnswer }: { event: ComputerTimelineEvent; isLatest: boolean; onSupabaseSetup?: () => void; onSupabaseDecline?: () => void; onClarificationAnswer?: (answer: string) => void }) {
  const isComplete = event.status === "complete"
  const isError    = event.status === "error"
  const isRunning  = event.status === "running"
  const isSkipped  = event.status === "skipped"
  const title      = getEventTitle(event)
  const description = isTokenLimitError(event.description)
    ? "You have used all credits for this cycle."
    : event.description

  // Supabase question card
  if (event.metadata?.questionType === "supabase") {
    return <SupabaseQuestionCard onSetup={onSupabaseSetup ?? (() => {})} onDecline={onSupabaseDecline} />
  }

  // Dynamic clarification questions
  if (event.metadata?.questionType === "clarification" && typeof event.metadata?.questions === "string") {
    let questions: QuestionConfig[] = []
    try { questions = JSON.parse(event.metadata.questions as string) } catch {}
    if (questions.length > 0) {
      return (
        <QuestionTool
          questions={questions}
          allowSkip
          submitLabel="Send"
          nextLabel="Next"
          skipLabel="Skip"
          className="my-3"
          onSubmitAnswer={(answer: QuestionAnswer, answersByQuestion?: Record<number, QuestionAnswer>) => {
            if (!onClarificationAnswer) return
            onClarificationAnswer(formatClarificationAnswerSet(questions, answersByQuestion, answer))
          }}
        />
      )
    }
  }

  // AI conversational reply — rendered as plain prose, no bubble, no icon
  if (event.title === "Response" && event.description) {
    return (
      <div className="py-3 pr-2">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.7] text-zinc-800 [overflow-wrap:anywhere]">
          {event.description}
        </p>
      </div>
    )
  }

  // Plan card — rendered only once when planning completes
  if (event.title === "Planning execution" && isComplete && event.description) {
    return <PlanTool event={event} />
  }

  const commandMetadata = getCommandMetadata(event)
  if (commandMetadata) {
    return (
      <BashTool
        state={isRunning ? "running" : "idle"}
        command={commandMetadata.command}
        output={commandMetadata.output || description}
        className="my-2"
      />
    )
  }

  if (event.title === "Generating code") {
    if (!isRunning) return null
    return <EditTool state="waiting" variant="write" className="my-2" />
  }

  const generatedFilePath = getGeneratingFilePath(event)
  if (generatedFilePath && event.kind === "code") {
    const fileContent = getFileContentMetadata(event)
    return (
      <EditTool
        state={isRunning ? "pending" : "completed"}
        variant={getEditToolVariant(event)}
        filePath={generatedFilePath}
        oldContent={fileContent.oldContent}
        newContent={fileContent.newContent}
        className="my-2"
      />
    )
  }

  const isProse = PROSE_EVENTS.includes(event.title) && event.description

  if (isProse) {
    return (
      <Collapsible defaultOpen className="my-2 group/collapsible">
        <CollapsibleTrigger className="flex w-full items-start gap-1.5 outline-none text-left">
          <div className="mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
            <ChevronRight className="h-2.5 w-2.5 text-zinc-400 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </div>
          {isRunning ? (
            <TextShimmer className="text-[11px] font-semibold uppercase tracking-[0.14em] bg-gradient-to-r from-zinc-400 via-zinc-950 to-zinc-400">
              {title}
            </TextShimmer>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {title}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 ml-1.5 border-l-2 border-border pl-3">
          <p className="text-[13.5px] leading-relaxed text-zinc-600">
            {event.description}
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="flex items-start gap-2.5 py-1.5 w-full overflow-hidden">
      <div className="flex h-5 w-4 shrink-0 items-center justify-center">
        {isRunning ? (
          <div className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-900 opacity-20" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
        ) : isError ? (
          <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
        ) : (
          <div className={cn("h-1.5 w-1.5 rounded-full", isSkipped ? "bg-zinc-200" : "bg-zinc-300")} />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {isRunning ? (
          <TextShimmer className="bg-gradient-to-r from-zinc-400 via-zinc-950 to-zinc-400 text-[14px] font-medium">
            {title}
          </TextShimmer>
        ) : (
          <span className={cn("text-[14px] leading-relaxed", isError ? "text-red-600" : "text-zinc-800")}>
            {title}
          </span>
        )}
        {description && (
          <span className={cn("min-w-0 truncate text-[11.5px]", isError ? "text-red-400" : "text-zinc-300")}>
            {description.split("\n")[0]}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Editable user bubble ─────────────────────────────────────────────────────

function UserMessageBubble({
  content, index, isEditing, editText,
  onEditStart, onEditChange, onEditSubmit, onEditCancel,
}: {
  content: string; index: number; isEditing: boolean; editText: string
  onEditStart: (i: number, c: string) => void
  onEditChange: (t: string) => void
  onEditSubmit: (i: number) => void
  onEditCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard?.writeText(content).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      const len = ref.current.value.length
      ref.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="flex justify-end pb-4">
        <div className="w-full max-w-[min(84%,42rem)]">
          <div className="overflow-hidden rounded-[14px] bg-primary shadow-[0_1px_2px_var(--primary)]">
          <textarea
            ref={ref} value={editText} onChange={(e) => onEditChange(e.target.value)}
            rows={Math.max(2, editText.split("\n").length)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit(index) }
              if (e.key === "Escape") onEditCancel()
            }}
            className="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button type="button" onClick={onEditCancel} className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800">Cancel</button>
            <button type="button" onClick={() => onEditSubmit(index)} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-accent/90">Submit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex w-full justify-end pb-4">
      <div className="flex w-fit max-w-[min(84%,42rem)] min-w-0 flex-col items-end">
        <div className="max-w-full rounded-[14px] bg-primary px-3.5 py-2.5 text-right shadow-[0_1px_2px_var(--primary)]">
          <p className="whitespace-pre-wrap break-words text-left text-[13px] leading-relaxed text-zinc-100 [overflow-wrap:anywhere]">{content}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-1 pr-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy message"
            title="Copy"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onEditStart(index, content)}
            aria-label="Edit and restore from this message"
            title="Edit and restore"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Agent feed ───────────────────────────────────────────────────────────────

function AgentFeed({
  prompt, events, localMessages, status, optimisticStart,
  editingIndex, editText, onEditStart, onEditChange, onEditSubmit, onEditCancel,
  onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, onSwitchToPreview,
}: {
  prompt?: string; events: ComputerTimelineEvent[]
  localMessages: LocalMessage[]
  status: ComputerSessionStatus; optimisticStart?: boolean
  editingIndex: number | null; editText: string
  onEditStart: (i: number, c: string) => void
  onEditChange: (t: string) => void
  onEditSubmit: (i: number) => void
  onEditCancel: () => void
  onSupabaseSetup?: () => void
  onSupabaseDecline?: () => void
  onClarificationAnswer?: (answer: string) => void
  onSwitchToPreview?: () => void
}) {
  const endRef    = useRef<HTMLDivElement | null>(null)
  const isRunning = status === "running" || status === "planning"
  const visible   = events.filter((e) => e.title !== "Session created")
  const { firstRunId, followUpRunIds } = getRunIdGroups(events)
  const initialEvents = firstRunId ? visible.filter((event) => event.runId === firstRunId) : visible
  const runEventsById = new Map<string, ComputerTimelineEvent[]>()
  for (const event of visible) {
    if (!event.runId || event.runId === firstRunId) continue
    const runEvents = runEventsById.get(event.runId) ?? []
    runEvents.push(event)
    runEventsById.set(event.runId, runEvents)
  }
  const localUserCount = localMessages.filter((msg) => msg.role === "user").length
  const unpairedRunIds = followUpRunIds.slice(localUserCount)
  const isStarting = optimisticStart && visible.length === 0
  const isEmpty   = !prompt && visible.length === 0 && localMessages.length === 0 && !isStarting

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [visible.length, localMessages.length, isStarting])

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-center">
        <div>
          <p className="text-[13px] font-medium text-zinc-600">Ready to build</p>
          <p className="mt-1 text-[11.5px] text-zinc-400">Send a message to start the agent.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 pb-2">
      {/* Prompt bubble */}
      {prompt && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="pb-4">
          <UserMessageBubble
            content={prompt} index={-1} isEditing={editingIndex === -1}
            editText={editingIndex === -1 ? editText : ""}
            onEditStart={onEditStart} onEditChange={onEditChange}
            onEditSubmit={onEditSubmit} onEditCancel={onEditCancel}
          />
        </motion.div>
      )}

      {/* Optimistic start shimmer */}
      <AnimatePresence initial={false}>
        {isStarting && (
          <motion.div key="optimistic" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="py-1">
            <TextShimmer className="bg-gradient-to-r from-zinc-500 via-zinc-950 to-zinc-500 font-mono text-[13px] font-semibold">
              Starting agent...
            </TextShimmer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline events — pure stream, no group dividers */}
      <AnimatePresence initial={false}>
        {initialEvents.map((event, i) => {
          const isLatest = i === initialEvents.length - 1 && isRunning
          return (
            <motion.div key={event.id ?? `${event.title}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
              <FeedItem event={event} isLatest={isLatest} onSupabaseSetup={onSupabaseSetup} onSupabaseDecline={onSupabaseDecline} onClarificationAnswer={onClarificationAnswer} />
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Local follow-up messages */}
      <AnimatePresence initial={false}>
        {localMessages.map((msg, i) =>
          msg.role === "user" ? (
            <Fragment key={`user-fragment-${i}`}>
              <motion.div key={`user-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="pt-2">
                <UserMessageBubble
                content={msg.content} index={i} isEditing={editingIndex === i}
                editText={editingIndex === i ? editText : ""}
                onEditStart={onEditStart} onEditChange={onEditChange}
                  onEditSubmit={onEditSubmit} onEditCancel={onEditCancel}
                />
              </motion.div>
            {(runEventsById.get(msg.runId ?? followUpRunIds[localMessages.slice(0, i).filter((item) => item.role === "user").length]) ?? []).map((event, eventIndex, runEvents) => {
              const isLatest = eventIndex === runEvents.length - 1 && isRunning
              return (
                <motion.div key={event.id ?? `${msg.runId}-${event.title}-${eventIndex}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
                  <FeedItem event={event} isLatest={isLatest} onSupabaseSetup={onSupabaseSetup} onSupabaseDecline={onSupabaseDecline} onClarificationAnswer={onClarificationAnswer} />
                </motion.div>
              )
            })}
            </Fragment>
          ) : (
            <motion.div key={`sys-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="flex justify-center py-1">
              <span className="text-[11px] text-zinc-400">{msg.content}</span>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {unpairedRunIds.map((runId) =>
        (runEventsById.get(runId) ?? []).map((event, eventIndex, runEvents) => {
          const isLatest = eventIndex === runEvents.length - 1 && isRunning
          return (
            <motion.div key={event.id ?? `${runId}-${event.title}-${eventIndex}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
              <FeedItem event={event} isLatest={isLatest} onSupabaseSetup={onSupabaseSetup} onSupabaseDecline={onSupabaseDecline} onClarificationAnswer={onClarificationAnswer} />
            </motion.div>
          )
        })
      )}

      {/* Running shimmer */}
      <AnimatePresence>
        {isRunning && (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="py-3">
            <TextShimmer className="bg-gradient-to-r from-zinc-500 via-zinc-950 to-zinc-500 text-[14px] font-medium">
              {STATUS_LABELS[status]}
            </TextShimmer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion message */}
      {status === "complete" && visible.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }} className="pt-4">
          {events.some((e) => e.title === "Preview ready") ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3">
              <p className="text-[13px] font-medium text-emerald-800">Preview is ready.</p>
              {onSwitchToPreview && (
                <button
                  type="button"
                  onClick={onSwitchToPreview}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 sm:hidden"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Open Preview
                </button>
              )}
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-zinc-800">Run complete.</p>
          )}
        </motion.div>
      )}

      <div ref={endRef} />
    </div>
  )
}

// ─── Research panel ───────────────────────────────────────────────────────────

function ResearchPanel({ events }: { events: ComputerTimelineEvent[] }) {
  const evidence = events.filter(
    (e) => (e.kind === "research" || e.kind === "browser") && Boolean(e.description?.trim())
  )
  if (evidence.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-zinc-300">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <p className="text-[13px] font-medium text-zinc-600">No research yet</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-400">Research notes and inspected pages appear here.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 space-y-3 overflow-y-auto p-4 [scrollbar-width:thin] sm:p-5">
      <AnimatePresence initial={false}>
        {evidence.map((event, i) => (
          <motion.div key={event.id ?? `${event.title}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}
            className="rounded-2xl border border-border bg-white px-3.5 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold text-zinc-800">{getEventTitle(event)}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">{event.kind}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-zinc-500">{event.description}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Runtime error card ───────────────────────────────────────────────────────

function RuntimeErrorCard({
  error,
  fixing,
  onFix,
  onDismiss,
}: {
  error: { message: string; stack: string }
  fixing: boolean
  onFix: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="absolute bottom-4 right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-destructive/20 bg-card shadow-[0_12px_40px_-12px_var(--destructive),0_4px_16px_-4px_var(--primary)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-100">
            <ShieldAlert className="h-3 w-3 text-red-500" />
          </span>
          <span className="text-[12px] font-semibold text-red-700">Runtime Error</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-5 w-5 items-center justify-center rounded-md text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
        >
          <span className="text-[14px] leading-none">×</span>
        </button>
      </div>
      {/* Error message */}
      <div className="px-3.5 py-3">
        <p className="line-clamp-2 text-[12px] leading-relaxed text-zinc-700">{error.message}</p>
        {/* Stack trace toggle */}
        {error.stack && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-zinc-400 transition-colors hover:text-zinc-700"
            >
              {expanded ? 'Hide stack trace' : 'Show stack trace'}
            </button>
            {expanded && (
              <pre className="mt-1.5 max-h-[120px] overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-[10px] leading-relaxed text-zinc-500 [scrollbar-width:thin]">
                {error.stack}
              </pre>
            )}
          </div>
        )}
      </div>
      {/* Action row */}
      <div className="flex items-center gap-2 border-t border-border bg-card px-3.5 py-2.5">
        <button
          type="button"
          onClick={onFix}
          disabled={fixing}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fixing
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fixing...</>
            : <><Wrench className="h-3.5 w-3.5" /> Fix with AI</>}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ─── Workspace panel ──────────────────────────────────────────────────────────

function WorkspaceHeaderLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-zinc-400 transition-colors hover:text-zinc-700">
      <span className="truncate">{href}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  )
}

function LaptopSwitcher({ label, title, url, icon, onClick }: {
  label: string; title: string; url: string; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="absolute bottom-4 right-4 z-10 w-[180px] rounded-2xl border border-border bg-muted p-2 text-left shadow-[0_12px_40px_-18px_var(--primary)] transition hover:-translate-y-0.5">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-1">
        <div className="aspect-[16/10] overflow-hidden rounded-lg border border-white/10 bg-white">
          <div className="flex h-full flex-col">
            <div className="h-4 border-b border-zinc-200 bg-zinc-100" />
            <div className="flex flex-1 items-center justify-center bg-card text-zinc-300">
              <Laptop className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-start gap-2 px-0.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
          <p className="truncate text-[12px] font-semibold text-zinc-800">{title}</p>
          <p className="truncate text-[10.5px] text-zinc-400">{url}</p>
        </div>
      </div>
    </button>
  )
}

function WorkspaceContent({
  session, activeTab, browserInspection, isEnsuringPreview, previewEnsureError, onSwitchView,
  runtimeError, fixingError, onFixError, onDismissError, onRetryPreview,
}: {
  session: ComputerSessionResponse; activeTab: WorkspaceTab
  browserInspection: BrowserInspection | null
  isEnsuringPreview: boolean
  previewEnsureError: string | null
  onSwitchView: (v: WorkspaceTab) => void
  runtimeError: { message: string; stack: string } | null
  fixingError: boolean
  onFixError: () => void
  onDismissError: () => void
  onRetryPreview: () => void
}) {
  if (activeTab === "research") {
    return <ResearchPanel events={session.timeline} />
  }

  if (activeTab === "browser" && browserInspection) {
    return (
      <motion.div key="browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col p-3 sm:p-3 lg:p-4">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {getBrowserProviderLabel(browserInspection.provider)}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-zinc-800">{browserInspection.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WorkspaceHeaderLink href={browserInspection.url} />
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar shadow-sm">
          {browserInspection.liveUrl && !browserInspection.isExpired ? (
            <iframe src={browserInspection.liveUrl} className="h-full w-full bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer" title="Remote browser" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-zinc-400">
                {browserInspection.isExpired ? "Live view has expired." : "Live view unavailable."}
              </p>
              <a href={browserInspection.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300">
                Open {browserInspection.url} in a new tab
              </a>
            </div>
          )}
          {session.previewUrl && (
            <LaptopSwitcher label="Preview" title="Generated app" url={session.previewUrl}
              icon={<Monitor className="h-3.5 w-3.5" />} onClick={() => onSwitchView("preview")} />
          )}
        </div>
      </motion.div>
    )
  }

  if (activeTab === "preview" && session.previewUrl) {
    return (
      <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col p-3 sm:p-3 lg:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Live Preview</p>
          <div className="flex items-center gap-2">
            <WorkspaceHeaderLink href={session.previewUrl} />
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <iframe src={session.previewUrl} className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-forms" title="Live preview" />
          {isEnsuringPreview && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-4">
              <div className="rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-medium text-zinc-500 shadow-sm backdrop-blur-sm">
                Refreshing preview…
              </div>
            </div>
          )}
          {previewEnsureError && !isEnsuringPreview && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center p-4">
              <div className="flex max-w-[360px] items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 text-[12px] text-muted-foreground shadow-sm backdrop-blur-sm">
                <span className="min-w-0 flex-1">{previewEnsureError}</span>
                <button
                  type="button"
                  onClick={onRetryPreview}
                  className="shrink-0 rounded-lg border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {browserInspection && !browserInspection.isExpired && (
            <LaptopSwitcher label="Browser" title={browserInspection.title} url={browserInspection.url}
              icon={<Globe2 className="h-3.5 w-3.5" />} onClick={() => onSwitchView("browser")} />
          )}
          {runtimeError && (
            <RuntimeErrorCard
              error={runtimeError}
              fixing={fixingError}
              onFix={onFixError}
              onDismiss={onDismissError}
            />
          )}
        </div>
      </motion.div>
    )
  }

  // Empty state
  return (
    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
      className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-white text-zinc-300 shadow-sm">
          <Monitor className="h-5 w-5" />
        </div>
        {(isEnsuringPreview || previewEnsureError) && (
          <p className="mb-1 text-[12px] font-medium text-zinc-500">
            {previewEnsureError || "Restoring preview..."}
          </p>
        )}
        <p className="text-[13px] font-semibold text-zinc-700">
          {session.status === "running" ? "Preparing workspace…" : "Workspace will appear here."}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
          {session.status === "running"
            ? "The preview will appear once the sandbox reports a ready URL."
            : "Preview, browser, and research appear here once the agent runtime is connected."}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Loading + error ──────────────────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="relative z-10 shrink-0 px-3 pt-3 pb-2.5 sm:px-4">
        <div className="flex h-12 items-center gap-3 rounded-[1.4rem] border border-border bg-card/90 px-4 backdrop-blur-md">
          <div className="h-5 w-5 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-3 w-36 animate-pulse rounded bg-zinc-200" />
          <div className="ml-auto h-6 w-24 animate-pulse rounded-full bg-zinc-200" />
        </div>
      </header>
      <div className="flex flex-1 gap-2 overflow-hidden px-2 pb-2 sm:px-2 sm:pb-2 lg:gap-3 lg:px-3 lg:pb-3">
        <div className="hidden w-[clamp(20rem,34vw,23.75rem)] shrink-0 animate-pulse rounded-[1.25rem] border border-border bg-card/95 sm:block lg:rounded-[1.4rem] xl:w-[clamp(24rem,30vw,26.25rem)]" />
        <div className="flex-1 animate-pulse rounded-[1.25rem] border border-border bg-card/95 lg:rounded-[1.4rem]" />
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-card/95 p-8 text-center shadow-[0_4px_24px_-8px_var(--primary)]">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-white text-zinc-400 shadow-sm">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="text-[15px] font-semibold text-foreground">Session not found</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{message}</p>
        <Button asChild className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-[12px] font-semibold text-white hover:bg-accent/90">
          <Link href="/"><ArrowLeft className="h-3.5 w-3.5" />Back home</Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, dot }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; dot?: boolean
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}>
      {icon}
      {label}
      {dot && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-warning" />}
    </button>
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
  const hasStartedRef = useRef(false)
  const runAbortRef = useRef<AbortController | null>(null)
  const previousPreviewUrlRef = useRef<string | null | undefined>(undefined)
  const previewEnsureKeyRef = useRef<string | null>(null)
  const prevSessionStatusRef = useRef<ComputerSessionStatus | null>(null)

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
        setSession({
          id: snap.id,
          prompt:    typeof d.prompt    === "string" ? d.prompt    : undefined,
          status:    normalizeStatus(d.status),
          timeline:  normalizeTimeline(d.timeline),
          previewUrl: typeof d.previewUrl === "string" ? d.previewUrl : null,
          projectId:  typeof d.projectId  === "string" ? d.projectId  : undefined,
        })
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
  const isBuildTokenBlocked = Boolean(userData && remainingTokens <= 0)
  const isRunning = optimisticStart || isStartingRun ||
    session?.status === "running" || session?.status === "planning"

  const showTokenLimit = useCallback(() => {
    setRunError("You have used all credits for this cycle. Upgrade your plan to continue.")
    setTokenLimitModalOpen(true)
  }, [])

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
    const projectId = session?.projectId
    const prevStatus = prevSessionStatusRef.current
    prevSessionStatusRef.current = session?.status ?? null

    if (!projectId || !user || authLoading) return
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
  }, [getOptionalAuthHeader, isBuildTokenBlocked, session, showTokenLimit, userData, setRunError, setOptimisticStart])

  // ── handleRun (unchanged) ─────────────────────────────────────────────────
  const handleRun = useCallback(async (value: string) => {
    const t = value.trim(); if (!t) return
    setLocalMessages((c) => [...c, { role: "user", content: t }])
    setRuntimeError(null)
    if (!session || isStartingRun) return
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
  }, [getOptionalAuthHeader, isBuildTokenBlocked, isStartingRun, session, showTokenLimit])

  // ── handleStop — halts an in-flight run immediately ───────────────────────
  const handleStop = useCallback(async () => {
    // Abort the pending request so the client stops waiting at once.
    runAbortRef.current?.abort()
    runAbortRef.current = null
    setOptimisticStart(false)
    setIsStartingRun(false)
    setRunError(null)
    if (!session) return
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
  }, [getOptionalAuthHeader, session])

  const handleEditStart  = (i: number, c: string) => { setEditingMsgIndex(i); setEditText(c) }
  const handleEditCancel = () => { setEditingMsgIndex(null); setEditText("") }
  const handleEditSubmit = useCallback(async (index: number) => {
    const t = editText.trim(); if (!t || !session) return
    setEditingMsgIndex(null); setEditText("")
    setRuntimeError(null)

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
  }, [editText, getOptionalAuthHeader, isBuildTokenBlocked, isStartingRun, localMessages, session, showTokenLimit])

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

  const isActive     = session.status === "running" || session.status === "planning"
  const hasPreview    = Boolean(session.previewUrl)
  const hasBrowser    = Boolean(browserInspection)
  const hasResearch   = session.timeline.some((e) => (e.kind === "research" || e.kind === "browser") && e.description?.trim())

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground sm:bg-primary sm:p-2.5 lg:p-3">

      {/* ── App shell ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card sm:rounded-[1.4rem] sm:border sm:border-border-strong/50 sm:shadow-2xl">

      {/* ── Top bar ── */}
      <header className="relative z-30 shrink-0 border-b border-border bg-card">
        <div className="flex h-12 w-full items-center gap-2 px-3 sm:h-14 sm:gap-3 sm:px-4 lg:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Link href="/" aria-label="Back"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground sm:inline-flex">
              <Laptop className="h-3.5 w-3.5" />
              <span className="sr-only">Computer session</span>
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {isEditingTitle ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  className="min-w-0 flex-1 max-w-[26rem] rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Enter a session title"
                  aria-label="Edit session title"
                  autoFocus
                />
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setIsEditingTitle(false); setTitleError(null); setTitleDraft(firstPrompt || "") }}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={titleSaving || !titleDraft.trim()} onClick={async () => {
                    if (!session) return
                    const trimmed = titleDraft.trim()
                    if (!trimmed) return
                    setTitleSaving(true)
                    setTitleError(null)
                    try {
                      await updateDoc(doc(db, "computerSessions", session.id), { prompt: trimmed })
                      setIsEditingTitle(false)
                    } catch (err) {
                      setTitleError("Could not save title. Please try again.")
                    } finally {
                      setTitleSaving(false)
                    }
                  }}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group flex min-w-0 items-center gap-1.5">
                <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground lg:text-[15px]">
                  {sessionTitle}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Edit session title"
                  title="Edit title"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            {!isEditingTitle && (
              <div className="hidden shrink-0 sm:block">
                <StatusBadge status={session.status} />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <IntegrationsButton
              projectId={session.projectId}
              project={projectIntegration}
              open={integrationsOpen}
              busy={integrationBusy}
              message={integrationMessage}
              envValues={envValues}
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
              deploymentLinks={getProjectDeploymentLinks(projectIntegration)}
              onOpenChange={(open) => {
                setDeployOpen(open)
                if (open) setIntegrationsOpen(false)
              }}
              onDeploy={handleDeploy}
            />
          </div>
        </div>

        {/* Status progress line */}
        {isActive && (
          <div className="absolute inset-x-0 -bottom-px z-10 h-0.5 overflow-hidden bg-warning/15">
            <motion.div
              className="h-full w-1/3 rounded-full bg-warning"
              animate={{ x: ["-120%", "420%"] }}
              transition={{ duration: 1.3, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        )}
        {session.status === "complete" && (
          <div className="absolute inset-x-0 -bottom-px z-10 h-0.5 bg-success" />
        )}
        {session.status === "error" && (
          <div className="absolute inset-x-0 -bottom-px z-10 h-0.5 bg-destructive" />
        )}

        {titleError && (
          <p className="px-3 pt-1.5 text-xs text-destructive sm:px-4 lg:px-6">{titleError}</p>
        )}
      </header>

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
              localMessages={localMessages} status={session.status}
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
            <AnimatedAIInput mode="chat" compact compactSize="slim" isLoading={isRunning} onStop={handleStop}
              onSubmit={handleRun} placeholder="Message the agent..." submitLabel="Run" disabled={isBuildTokenBlocked} />
          </div>
        </div>

        {/* ── Workspace panel (right) ── */}
        <div className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden bg-background",
          mobileView !== "workspace" && "hidden sm:flex"
        )}>
          {/* Workspace tab bar */}
          <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 sm:flex lg:px-4">
            <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none]">
              <TabBtn active={activeTab === "preview"} onClick={() => setActiveTab("preview")}
                icon={<Monitor className="h-3.5 w-3.5" />} label="Preview"
                dot={hasPreview && isActive} />
              <TabBtn active={activeTab === "browser"} onClick={() => setActiveTab("browser")}
                icon={<Globe2 className="h-3.5 w-3.5" />} label="Browser"
                dot={hasBrowser && isActive} />
              <TabBtn active={activeTab === "research"} onClick={() => setActiveTab("research")}
                icon={<BookOpen className="h-3.5 w-3.5" />} label="Research"
                dot={hasResearch && activeTab !== "research"} />
            </div>
            {/* Completion badge */}
            {session.status === "complete" && (
              <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success-soft-foreground">
                <Check className="h-2.5 w-2.5 stroke-[3]" />Done
              </span>
            )}
          </div>

          {/* Workspace content */}
          <div className="relative min-h-0 flex-1 bg-background">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }} className="h-full min-h-0">
                <WorkspaceContent
                  session={session} activeTab={activeTab}
                  browserInspection={browserInspection}
                  isEnsuringPreview={isEnsuringPreview}
                  previewEnsureError={previewEnsureError}
                  onSwitchView={setActiveTab}
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
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>

      {/* ── Mobile view switcher ── */}
      <nav
        className="absolute inset-x-3 z-20 mx-auto max-w-md rounded-[1.7rem] border border-border/65 bg-card/80 px-1.5 py-1.5 shadow-[0_22px_70px_-28px_var(--primary),0_1px_0_var(--primary-foreground)_inset,0_0_0_1px_var(--primary-foreground)_inset] backdrop-blur-2xl sm:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setMobileView("feed")}
            className={cn(
              "relative flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] text-[10.5px] font-semibold transition-all duration-200",
              mobileView === "feed"
                ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-15px_var(--primary),0_1px_0_var(--primary-foreground)_inset]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <MessageSquare className={cn("h-4 w-4 transition-transform duration-200", mobileView === "feed" && "-translate-y-0.5")} />
            Chat
            {mobileView === "feed" && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary-foreground/70" />}
          </button>
          <button
            type="button"
            onClick={() => { setMobileView("workspace"); setActiveTab("preview") }}
            className={cn(
              "relative flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] text-[10.5px] font-semibold transition-all duration-200",
              mobileView === "workspace" && activeTab === "preview"
                ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-15px_var(--primary),0_1px_0_var(--primary-foreground)_inset]"
                : hasPreview
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Monitor className={cn("h-4 w-4 transition-transform duration-200", mobileView === "workspace" && activeTab === "preview" && "-translate-y-0.5")} />
            Preview
            {mobileView === "workspace" && activeTab === "preview" && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary-foreground/70" />}
            {isActive && (
              <span className="absolute right-3 top-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
              </span>
            )}
            {!isActive && hasPreview && mobileView !== "workspace" && (
              <span className="absolute right-3 top-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setMobileView("workspace"); setActiveTab("browser") }}
            className={cn(
              "relative flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] text-[10.5px] font-semibold transition-all duration-200",
              mobileView === "workspace" && activeTab === "browser"
                ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-15px_var(--primary),0_1px_0_var(--primary-foreground)_inset]"
                : hasBrowser
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Globe2 className={cn("h-4 w-4 transition-transform duration-200", mobileView === "workspace" && activeTab === "browser" && "-translate-y-0.5")} />
            Browser
            {mobileView === "workspace" && activeTab === "browser" && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary-foreground/70" />}
            {hasBrowser && !(mobileView === "workspace" && activeTab === "browser") && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-info" />}
          </button>
          <button
            type="button"
            onClick={() => { setMobileView("workspace"); setActiveTab("research") }}
            className={cn(
              "relative flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] text-[10.5px] font-semibold transition-all duration-200",
              mobileView === "workspace" && activeTab === "research"
                ? "bg-primary text-primary-foreground shadow-[0_12px_26px_-15px_var(--primary),0_1px_0_var(--primary-foreground)_inset]"
                : hasResearch
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <BookOpen className={cn("h-4 w-4 transition-transform duration-200", mobileView === "workspace" && activeTab === "research" && "-translate-y-0.5")} />
            Research
            {mobileView === "workspace" && activeTab === "research" && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary-foreground/70" />}
            {hasResearch && !(mobileView === "workspace" && activeTab === "research") && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-warning" />}
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
