"use client"

import { BrandWordmark } from "@/components/ui/brand-wordmark"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { ProjectSearchDialog } from "@/components/projects/project-search-dialog"
import { Suspense, useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { currentBackend } from "@/lib/backend/browser"
import {
  Settings,
  Trash2,
  LogOut,
  Users,
  CreditCard,
  X,
  Gift,
  Copy,
  Check,
  CheckCircle2,
  Share2,
  ChevronDown,
  Loader2,
  Lock,
  Plus,
} from "lucide-react"


import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { cn } from "@/lib/utils"

import { useProjectList } from "@/hooks/use-project-list"
import { useSettingsDialog } from "@/components/settings/settings-dialog"

/* ─── types ─────────────────────────────────────────────────────────────── */

type ProjectStatus = "pending" | "generating" | "complete" | "error" | "draft" | "deleting"

type ProjectSummary = {
  id: string
  prompt: string
  model?: string
  status: ProjectStatus
  visibility?: "public" | "private" | "link-only"
  createdAt?: any
  updatedAt?: any
  sandboxUrl?: string
  workspaceId?: string
  workspaceName?: string
  kind?: "project" | "computer"
}

/* ─── helpers ────────────────────────────────────────────────────────────── */

const sidebarActionClass =
  "inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"


const accountMenuItemClass =
  "h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

const RECENT_BUILDS_LIMIT = 6
const PROJECTS_MAIN_ID = "projects-main"
const PROJECTS_HEADING_ID = "projects-main-heading"
const PROJECTS_MOBILE_SIDEBAR_ID = "projects-mobile-sidebar"
const PROJECTS_DESKTOP_SIDEBAR_ID = "projects-desktop-sidebar"

function projectTitle(prompt: string, max = 42): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const PROJECT_STATUS_META: Record<ProjectStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-muted-foreground/40", label: "Draft" },
  generating: { dot: "animate-pulse bg-foreground", label: "Building" },
  complete: { dot: "bg-success", label: "Ready" },
  error: { dot: "bg-destructive", label: "Needs attention" },
  draft: { dot: "bg-muted-foreground/40", label: "Draft" },
  deleting: { dot: "bg-muted-foreground/40", label: "Deleting" },
}

function projectKindLabel(kind?: ProjectSummary["kind"]): string {
  return kind === "computer" ? "Computer agent" : "Software project"
}

function projectAccessibleSummary(project: ProjectSummary, max = 72): string {
  const status = PROJECT_STATUS_META[project.status] ?? PROJECT_STATUS_META.pending
  return `${projectTitle(project.prompt, max)}. ${projectKindLabel(project.kind)}. ${status.label}.`
}

/* ─── TaskRow ─────────────────────────────────────────────────────────────── */

function TaskRow({
  p,
  onNavigate,
  onDelete,
}: {
  p: ProjectSummary
  onNavigate: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const status = PROJECT_STATUS_META[p.status] ?? PROJECT_STATUS_META.pending
  const title = projectTitle(p.prompt, 34)

  return (
    <div className="group/row relative px-1" role="listitem">
      <button
        type="button"
        onClick={onNavigate}
        aria-label={`Open ${projectAccessibleSummary(p, 34)}`}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 pr-9 text-left",
          "transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-normal leading-snug text-foreground/90 group-hover/row:text-foreground">
            {title}
          </span>
          <span className="sr-only">
            {p.kind === "computer" ? "Computer agent" : "Software project"} · {status.label}
          </span>
        </span>
      </button>

      {/* delete — reveals on row hover */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${title}`}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2",
          "flex h-7 w-7 items-center justify-center rounded-lg",
          "text-muted-foreground/40 opacity-0 transition-all",
          "hover:bg-destructive/10 hover:text-destructive",
          "group-hover/row:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/25"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

function Sidebar({
  filtered,
  projectListError,
  onNewProject,
  projectsLoading,
  stats,
  router,
  handleDeleteProject,
  user,
  signOut,
  onClose,
  onToggle,
  isTeamsPlan,
  scope,
  setScope,
  workspaces,
  currentWorkspace,
  switchWorkspace,
  isPaidUser,
}: {
  filtered: ProjectSummary[]
  projectListError: string | null
  onNewProject: () => void
  projectsLoading: boolean
  stats: { planName: string }
  router: ReturnType<typeof useRouter>
  handleDeleteProject: (e: React.MouseEvent, id: string, kind?: string) => void
  user: any
  signOut: () => void
  onClose?: () => void
  onToggle?: () => void
  isTeamsPlan: boolean
  scope: "user" | "team"
  setScope: (s: "user" | "team") => void
  workspaces: Array<{ id: string; name: string; slug?: string }>
  currentWorkspace: { id: string; name: string; slug?: string } | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  isPaidUser: boolean
}) {
  const { openSettings } = useSettingsDialog()
  const recentBuildsHeadingId = useId()
  const scopeToggleLabelId = useId()
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 1).toUpperCase() ?? "U"
  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspace?.id)
  const selectedWorkspaceName = currentWorkspace?.name ?? "Personal workspace"
  const selectedWorkspaceInitial = selectedWorkspaceName.charAt(0).toUpperCase()
  const recentBuilds = filtered.slice(0, RECENT_BUILDS_LIMIT)
  const hiddenBuildCount = Math.max(0, filtered.length - recentBuilds.length)
  const recentBuildsLabel = scope === "team" ? "Recent team builds" : "Recent builds"
  const accountName = user?.displayName ?? user?.email?.split("@")[0] ?? "User"
  const handleWorkspaceSelect = async (workspaceId: string) => {
    await switchWorkspace(workspaceId)
    if (isTeamsPlan) setScope("team")
    onClose?.()
    router.push("/")
  }

  return (
    <div className="workspace-sidebar relative flex h-full flex-col overflow-visible rounded-xl border border-sidebar-border/65 text-sidebar-foreground">

      {/* ── Logo row ── */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-1 px-3">
        <Link href="/" onClick={onClose} className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30" aria-label="Go to Lotus home"><BrandWordmark size="compact" /></Link>
        <div className="flex items-center gap-0.5">
          <ProjectSearchDialog projects={filtered} loading={projectsLoading} error={projectListError} onOpenProject={(project) => { onClose?.(); router.push(project.kind === 'computer' ? `/computer/${project.id}` : `/project/${project.id}`) }} />
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={onClose ? "Close sidebar" : "Collapse sidebar"}
              className={cn(sidebarActionClass, "workspace-sidebar-toggle h-11 w-11 shrink-0 rounded-lg")}
            >
              <SidebarToggleIcon className="h-5 w-5" />
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className={cn(sidebarActionClass, "lotus-glass-control absolute -right-3 top-3 z-30 h-9 w-9 border border-border/70")}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-7 space-y-2 px-3 pt-2">
        <button type="button" onClick={() => { onClose?.(); onNewProject() }} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] bg-primary px-3.5 text-left text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar">
          New project
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
      </div>

      {/* ── Section header ── */}
      <div className="mb-2 flex items-center justify-between px-4">
        <span id={recentBuildsHeadingId} className="text-xs font-medium text-muted-foreground">
          {recentBuildsLabel}
        </span>
        <span className="text-[11px] text-muted-foreground/75">
          {recentBuilds.length}{hiddenBuildCount ? `/${filtered.length}` : ""}
        </span>
      </div>

      {/* ── Task list ── */}
      <div
        className="flex-1 overflow-y-auto pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
        aria-labelledby={recentBuildsHeadingId}
        aria-busy={projectsLoading}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {projectsLoading
            ? `Loading ${recentBuildsLabel.toLowerCase()}`
            : `${recentBuilds.length} ${recentBuildsLabel.toLowerCase()} shown`}
        </p>
        {projectsLoading ? (
          <div className="space-y-2 px-3 pt-1" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted"
                style={{ opacity: 1 - i * 0.09 }}
              />
            ))}
          </div>
        ) : recentBuilds.length === 0 ? (
          <div className="lotus-glass-inset mx-3 rounded-2xl border border-border/55 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-foreground">No recent builds</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Start with a prompt and your builds will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2" role="list" aria-label={recentBuildsLabel}>
            {recentBuilds.map((p) => (
              <TaskRow
                key={p.id}
                p={p}
                onNavigate={() => {
                  onClose?.()
                  router.push(p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`)
                }}
                onDelete={(e) => handleDeleteProject(e, p.id, p.kind)}
              />
            ))}
            {hiddenBuildCount > 0 ? (
              <div className="px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground/80">
                {hiddenBuildCount} more in all builds below
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── User row ── */}
      <div className="shrink-0 px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Open account menu for ${accountName}. ${stats.planName} plan.`}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2",
                "transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-full">
                <AvatarImage
                  src={user?.photoURL ?? undefined}
                  alt=""
                  className="rounded-full object-cover"
                />
                <AvatarFallback className="rounded-full bg-accent-soft text-[10px] font-semibold text-accent-soft-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                  {accountName}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {stats.planName} plan
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={6}
            className="lotus-glass-strong w-[calc(100vw-2rem)] max-w-[16rem] rounded-2xl border border-border/60 p-2 shadow-lg"
          >
            <DropdownMenuItem
              className={accountMenuItemClass}
              onClick={() => router.push("/pricing")}
            >
              <CreditCard className="mr-2 h-3.5 w-3.5" />
              Billing &amp; Plans
            </DropdownMenuItem>
            <DropdownMenuItem
              className={accountMenuItemClass}
              onClick={() => openSettings()}
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 bg-border/50" />
            <DropdownMenuItem
              className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/* ─── ReferralDialog ──────────────────────────────────────────────────────── */

function ReferralDialog({
  open,
  onClose,
  referralCode,
  referralCount,
  creditsEarned,
}: {
  open: boolean
  onClose: () => void
  referralCode: string | null
  referralCount: number
  creditsEarned: number
}) {
  const dialogTitleId = useId()
  const dialogDescriptionId = useId()
  const copyStatusId = useId()
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const link = useMemo(() => {
    if (!referralCode) return ""
    const origin = typeof window !== "undefined" ? window.location.origin : "https://lotus.build"
    return `${origin}/pricing?ref=${encodeURIComponent(referralCode)}`
  }, [referralCode])

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => { if (!open) setCopied(false) }, [open])

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy your referral link:", link)
    }
  }

  const handleShare = async () => {
    if (!link) return
    try {
      await navigator.share({
        title: "lotus.build",
        text: "Build production-ready sites with AI. Join me on lotus.build and we both get 500 credits.",
        url: link,
      })
    } catch {}
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center px-3 pb-3 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-foreground/35 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        className="lotus-glass-strong relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-[36rem] overflow-y-auto rounded-2xl border border-border/60 p-4 shadow-xl sm:max-h-[calc(100dvh-3rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close invite dialog"
          className="lotus-glass-control absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border/55 text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div className="pr-10">
          <p className="mb-3 inline-flex rounded-full bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            500 credits each
          </p>
          <h2 id={dialogTitleId} className="text-[22px] font-semibold tracking-[-0.035em] text-foreground sm:text-[26px]">
            Invite friends, earn credits
          </h2>
          <p id={dialogDescriptionId} className="mt-2 max-w-[30rem] text-[13.5px] leading-6 text-muted-foreground sm:text-[14px]">
            Share your link. When a friend joins a paid plan, you both receive{" "}
            <span className="font-medium text-foreground">500 credits</span>.
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="lotus-glass-inset rounded-2xl border border-border/55 px-4 py-3.5">
            <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground">
              {referralCount}
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Friend{referralCount === 1 ? "" : "s"} joined
            </p>
          </div>
          <div className="lotus-glass-inset rounded-2xl border border-border/55 px-4 py-3.5">
            <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground">
              {creditsEarned.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground">Credits earned</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
            Your link
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="lotus-glass-control flex min-w-0 items-center rounded-2xl border px-3.5 py-3">
              <span className="truncate text-[13px] text-muted-foreground">
                {link || "Sign in to generate your link"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              aria-label="Copy referral link"
              aria-describedby={copyStatusId}
              className={cn(
                "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-semibold",
                "transition-all active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30",
                copied
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p id={copyStatusId} className="sr-only" role="status" aria-live="polite">
            {copied ? "Referral link copied." : "Referral link ready to copy."}
          </p>
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={handleShare}
            disabled={!link}
            className={cn(
              "lotus-glass-control mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-full",
              "border px-4",
              "text-[13px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted/60 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
            )}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Share link
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

function OnboardingBanner() {
  const searchParams = useSearchParams()
  const { currentWorkspace } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || searchParams.get("onboarding") !== "true") return null

  return (
    <div className="lotus-glass-panel mb-6 flex items-start gap-3 rounded-2xl border border-border/55 px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
        {(currentWorkspace?.name ?? "W").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground">
          Welcome to {currentWorkspace?.name ?? "your new workspace"}
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Your workspace is ready. Start a build below and it will be scoped to this workspace.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ProjectsWorkspace() {
  const router = useRouter()
  const { user, userData, workspaces, currentWorkspace, switchWorkspace, signOut, accountError, refreshAccount } = useAuth()
  const { openSettings } = useSettingsDialog()

  const isTeamsPlan = !!userData?.planId && userData.planId === "team"
  const isPaidUser = !!userData?.planId && userData.planId !== "free"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [checkoutSuccessOpen, setCheckoutSuccessOpen] = useState(false)
  const [confirmTimedOut, setConfirmTimedOut] = useState(false)

  // Stripe redirects here with ?checkout=success after payment. Open the
  // confirmation dialog, strip the param so refresh doesn't re-trigger it, and
  // clear the retry payload the pricing page stored for the cancelled path.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("checkout") !== "success") return
      setCheckoutSuccessOpen(true)
      try { window.sessionStorage.removeItem("lotus_checkout_attempt") } catch {}
      params.delete("checkout")
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    } catch {}
  }, [])

  // The user usually lands back before the Stripe webhook has written the new
  // plan to their user doc. The auth context's onSnapshot listener flips
  // userData to the paid plan in real time; if that hasn't happened after 30s,
  // degrade to an honest "payment received, activating shortly" state.
  useEffect(() => {
    if (!checkoutSuccessOpen || isPaidUser) return
    const timer = setTimeout(() => setConfirmTimedOut(true), 30_000)
    return () => clearTimeout(timer)
  }, [checkoutSuccessOpen, isPaidUser])

  useEffect(() => {
    if (!isTeamsPlan && scope === "team") setScope("user")
  }, [isTeamsPlan, scope])

  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileSidebarOpen])

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {}
    const token = await user.getIdToken()
    return { Authorization: `Bearer ${token}` }
  }, [user])

  const { projects, loading: projectsLoading, error: projectsError, refresh: refreshProjects } = useProjectList({
    scope,
    uid: user?.uid ?? null,
    workspaceId: scope === "team" ? userData?.currentWorkspaceId || null : null,
    getAuthHeader,
  })

  const stats = useMemo(() => {
    const planName = userData?.planName || "Free"
    return { planName }
  }, [userData])

  // Live subscription details for the checkout-success dialog. All values come
  // from the user doc the Stripe webhook writes to, so the dialog updates
  // reactively the moment the plan activates — nothing is hardcoded.
  const checkoutSuccessInfo = useMemo(() => {
    const planKey = userData?.planId ? userData.planId : null
    const planName = userData?.planName
      || (planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : "")
    const credits = Math.max(
      Number(userData?.tokensLimit ?? 0),
      Number(userData?.tokenUsage?.used ?? 0) + Number(userData?.tokenUsage?.remaining ?? 0),
    )
    const periodEnd = userData?.tokenUsage?.periodEnd
    const renewsOn = periodEnd ? new Date(periodEnd).toLocaleDateString() : ""
    return { planName, credits, renewsOn }
  }, [userData])

  const handleCheckoutSuccessChange = (open: boolean) => {
    setCheckoutSuccessOpen(open)
    if (!open) setConfirmTimedOut(false)
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, kind?: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await currentBackend().deleteProject(projectId)
      refreshProjects()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete project.')
    }
  }

  const firstName = user?.displayName?.split(" ")[0] ?? ""

  const sidebarProps = {
    filtered: projects,
    projectListError: projectsError,
    onNewProject: () => requestAnimationFrame(() => document.getElementById('workspace-brief')?.focus()),
    projectsLoading,
    stats,
    router,
    handleDeleteProject,
    user,
    signOut,
    isTeamsPlan,
    scope,
    setScope,
    workspaces,
    currentWorkspace,
    switchWorkspace,
    isPaidUser,
  }

  if (user && !userData) return <main className="min-h-screen bg-background p-8 text-foreground">
    <div role="alert"><p>{accountError || 'Account data is unavailable.'}</p>
      <button type="button" className="mt-3 underline" onClick={() => { void refreshAccount().catch(() => {}) }}>Retry account connection</button>
    </div>
  </main>

  return (
      <div className="workspace-root flex h-[100dvh] overflow-hidden bg-background">
        <a
          href={`#${PROJECTS_MAIN_ID}`}
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:border focus:border-border-strong focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-border-strong/30"
        >
          Skip to main content
        </a>

        {/* ── Mobile overlay ── */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-foreground/20 transition-opacity duration-200 lg:hidden",
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />

        {/* ── Mobile drawer ── */}
        <div
          id={PROJECTS_MOBILE_SIDEBAR_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Project navigation"
          aria-hidden={!mobileSidebarOpen}
          className={cn(
            "fixed inset-y-1.5 left-1.5 z-50 w-[min(18rem,calc(100vw-1.5rem))]",
            "transition-transform duration-200 ease-in-out lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {mobileSidebarOpen && (
            <Sidebar
              {...sidebarProps}
              onClose={() => setMobileSidebarOpen(false)}
              onToggle={() => setMobileSidebarOpen(false)}
            />
          )}
        </div>

        {/* ── Desktop sidebar ── */}
        <aside
          id={PROJECTS_DESKTOP_SIDEBAR_ID}
          aria-label="Project navigation"
          className={cn(
            "hidden shrink-0 transition-[width] duration-200 ease-in-out lg:block",
            desktopSidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-[260px]"
          )}
        >
          {!desktopSidebarCollapsed && (
            <div className="relative h-full p-1.5 pr-0">
              <Sidebar {...sidebarProps} onToggle={() => setDesktopSidebarCollapsed(true)} />
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main
          id={PROJECTS_MAIN_ID}
          aria-labelledby={PROJECTS_HEADING_ID}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent"
        >

          {/* ── Mobile top bar ── */}
          <header className="lotus-glass relative z-10 flex h-14 shrink-0 items-center gap-3 px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-controls={PROJECTS_MOBILE_SIDEBAR_ID}
              aria-expanded={mobileSidebarOpen}
              className={cn(sidebarActionClass, "h-9 w-9")}
            >
              <SidebarToggleIcon className="h-5 w-5" />
            </button>
            <Link href="/" className="flex min-w-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30" aria-label="Go to Lotus home"><BrandWordmark /></Link>
          </header>

          {/* ── Desktop: expand sidebar button ── */}
          {desktopSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed(false)}
              aria-label="Show sidebar"
              aria-controls={PROJECTS_DESKTOP_SIDEBAR_ID}
              aria-expanded={!desktopSidebarCollapsed}
              className={cn(
                "absolute left-4 top-4 z-20 hidden lg:flex",
                "h-9 w-9 items-center justify-center rounded-lg text-muted-foreground",
                "transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground"
              )}
            >
              <SidebarToggleIcon className="h-5 w-5" />
            </button>
          )}

          {/* Composer surface */}
          <div className="relative z-10 flex min-h-0 flex-1">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden md:rounded-t-[1.125rem] lg:rounded-t-[1.25rem]">
              <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                <div className="relative isolate flex min-h-full w-full flex-col items-center justify-start overflow-hidden bg-transparent px-5 pb-20 md:rounded-t-[1.125rem] sm:px-8 sm:pb-24 lg:rounded-t-[1.25rem]">

                  <div className="relative z-10 w-full max-w-[60rem]">
                    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[44rem] flex-col justify-center py-10 sm:min-h-[calc(100dvh-9rem)] sm:py-12 md:py-14 lg:py-16">
                      <Suspense fallback={null}>
                        <OnboardingBanner />
                      </Suspense>
                      {(accountError || projectsError) && <div role="alert" className="mb-4 text-sm text-destructive">
                        <p>{accountError || projectsError}</p>
                        <button type="button" className="mt-1 underline" onClick={() => {
                          void refreshAccount().then(refreshProjects).catch(() => {})
                        }}>Retry connection</button>
                      </div>}

                      <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mb-7 flex justify-center duration-700">
                        <div className="lotus-glass-control inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm">
                          <span className="font-medium text-foreground">{stats.planName} workspace</span>
                          <span className="h-3.5 w-px bg-border" />
                          <Link href="/pricing" className="font-semibold text-accent-soft-foreground transition-colors hover:text-accent">
                            Upgrade
                          </Link>
                        </div>
                      </div>

                      <div className="mb-8 text-center md:mb-10">
                        <h1
                          id={PROJECTS_HEADING_ID}
                          className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto max-w-4xl text-2xl font-medium leading-[1.15] text-foreground duration-700 sm:whitespace-nowrap sm:text-3xl sm:leading-[1.05] lg:text-4xl"
                          style={{ animationDelay: "80ms" }}
                        >
                          What can I build for you{firstName ? `, ${firstName}` : ""}?
                        </h1>
                      </div>

                      <div
                        className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative duration-700"
                        style={{ animationDelay: "200ms" }}
                      >
                        <AnimatedAIInput
                          inputId="workspace-brief"
                          placeholder="Describe what you want to build…"
                          wrapperClassName="rounded-3xl border-border bg-card shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15 [&_textarea]:min-h-[96px] [&_textarea]:px-1 [&_textarea]:pt-1 [&_textarea]:text-base [&_textarea]:placeholder:text-muted-foreground [&>div:last-child]:px-3 [&>div:last-child]:pb-3 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:rounded-full"
                          footerHintsClassName="text-muted-foreground"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <></>

        <></>

        {/* ── Checkout success dialog ── */}
        <Dialog open={checkoutSuccessOpen} onOpenChange={handleCheckoutSuccessChange}>
          <DialogContent className="max-w-md rounded-2xl border-border bg-card p-8 sm:p-10">
            {isPaidUser ? (
              <>
                <DialogHeader className="items-center space-y-3 text-center sm:text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15">
                    <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.75} />
                  </div>
                  <DialogTitle className="text-[20px] font-semibold tracking-tight text-foreground">
                    {checkoutSuccessInfo.planName
                      ? `You're on ${checkoutSuccessInfo.planName}`
                      : "Your subscription is active"}
                  </DialogTitle>
                  <DialogDescription className="text-[13.5px] leading-relaxed text-muted-foreground">
                    Your account currently reports this plan. A checkout return alone does not confirm payment.
                  </DialogDescription>
                </DialogHeader>
                {checkoutSuccessInfo.credits > 0 && (
                  <div className="mt-1 rounded-xl bg-muted/50 px-4 py-3 text-center">
                    <p className="text-[12.5px] text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {checkoutSuccessInfo.credits.toLocaleString()}
                      </span>{" "}
                      credits / month
                      {checkoutSuccessInfo.renewsOn && <> · renews {checkoutSuccessInfo.renewsOn}</>}
                    </p>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                    onClick={() => { handleCheckoutSuccessChange(false); openSettings() }}
                  >
                    Manage plan
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-foreground text-[13px] font-medium text-background transition-all hover:bg-foreground/85 active:scale-[0.99]"
                    onClick={() => handleCheckoutSuccessChange(false)}
                  >
                    Start building
                  </Button>
                </div>
              </>
            ) : !confirmTimedOut ? (
              <>
                <DialogHeader className="items-center space-y-3 text-center sm:text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Loader2 className="h-7 w-7 animate-spin text-foreground" strokeWidth={1.75} />
                  </div>
                  <DialogTitle className="text-[20px] font-semibold tracking-tight text-foreground">
                    Confirming your subscription…
                  </DialogTitle>
                  <DialogDescription className="text-[13.5px] leading-relaxed text-muted-foreground">
                    Your payment went through — we're activating your plan now. This usually takes a few seconds.
                  </DialogDescription>
                </DialogHeader>
              </>
            ) : (
              <>
                <DialogHeader className="items-center space-y-3 text-center sm:text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15">
                    <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.75} />
                  </div>
                  <DialogTitle className="text-[20px] font-semibold tracking-tight text-foreground">
                    Checking your plan
                  </DialogTitle>
                  <DialogDescription className="text-[13.5px] leading-relaxed text-muted-foreground">
                    A plan change has not been confirmed. Refresh your account status or check the billing portal.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                    onClick={() => { handleCheckoutSuccessChange(false); openSettings() }}
                  >
                    View settings
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-foreground text-[13px] font-medium text-background transition-all hover:bg-foreground/85 active:scale-[0.99]"
                    onClick={() => handleCheckoutSuccessChange(false)}
                  >
                    Start building
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
  )
}
