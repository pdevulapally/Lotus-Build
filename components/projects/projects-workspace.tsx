"use client"

import { BrandWordmark } from "@/components/ui/brand-wordmark"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { SideNav } from "@astryxdesign/core/SideNav"
import { ProjectNavigationRow } from "@/components/projects/project-navigation-row"
import { ProjectSearchDialog } from "@/components/projects/project-search-dialog"
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { currentBackend } from "@/lib/backend/browser"
import { projectSessionPath } from "@/lib/backend/project-session-path"
import { clearCheckoutAttempt } from "@/lib/backend/checkout-attempt"
import {
  Settings,
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
  FolderOpen,
  SquarePen,
  ArrowUpRight,
} from "lucide-react"


import { Button } from "@/components/ui/button"
import { RevealGroup, RevealItem } from "@/components/ui/reveal"
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

import { useProjectList, type ProjectListItem as ProjectSummary } from "@/hooks/use-project-list"
import { heroCategories, type Brief } from "@/components/landing/landing-content"
import { ArrowRightIcon } from "@/components/ui/lotus-icons"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import styles from "./projects-workspace.module.css"

/* ─── helpers ────────────────────────────────────────────────────────────── */

const sidebarActionClass =
  "inline-flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"


const accountMenuItemClass =
  "h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

const RECENT_BUILDS_LIMIT = 6
const PROJECTS_MAIN_ID = "projects-main"
const PROJECTS_HEADING_ID = "projects-main-heading"
const PROJECTS_MOBILE_SIDEBAR_ID = "projects-mobile-sidebar"
const PROJECTS_DESKTOP_SIDEBAR_ID = "projects-desktop-sidebar"

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

function Sidebar({
  filtered,
  projectListError,
  onNewProject,
  projectsLoading,
  stats,
  router,
  onProjectsChanged,
  user,
  signOut,
  onClose,
  onToggle,
  isTeamsPlan,
  scope,
  setScope,
  projectsExpanded,
  setProjectsExpanded,
  workspaces,
  currentWorkspace,
  switchWorkspace,
  isPaidUser,
  collapsed = false,
}: {
  filtered: ProjectSummary[]
  projectListError: string | null
  onNewProject: () => void
  projectsLoading: boolean
  stats: { planName: string }
  router: ReturnType<typeof useRouter>
  onProjectsChanged: () => void
  user: any
  signOut: () => void
  onClose?: () => void
  onToggle?: () => void
  isTeamsPlan: boolean
  scope: "user" | "team"
  setScope: (s: "user" | "team") => void
  projectsExpanded: boolean
  setProjectsExpanded: (value: boolean | ((previous: boolean) => boolean)) => void
  workspaces: Array<{ id: string; name: string; slug?: string }>
  currentWorkspace: { id: string; name: string; slug?: string } | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  isPaidUser: boolean
  collapsed?: boolean
}) {
  const { openSettings } = useSettingsDialog()
  const [openingProject, setOpeningProject] = useState(false)
  const [openProjectError, setOpenProjectError] = useState<string | null>(null)
  const handleOpenProject = async (project: { id: string; kind?: string }) => {
    if (openingProject) return
    setOpeningProject(true)
    setOpenProjectError(null)
    try {
      const path = await projectSessionPath(currentBackend(), project)
      onClose?.()
      router.push(path)
    } catch (error) {
      setOpenProjectError(error instanceof Error ? error.message : "Could not open this project's computer session. Try again.")
    } finally {
      setOpeningProject(false)
    }
  }
  const recentBuildsHeadingId = useId()
  const recentBuildsListId = useId()
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
    <SideNav
      className={styles.sidebar}
      header={<>
      <header className={cn("flex min-h-16 shrink-0 items-center justify-between gap-1 px-3 py-2", collapsed && "flex-col px-2")}>
        {!collapsed && <Link href="/" onClick={onClose} className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Go to Lotus home"><BrandWordmark size="compact" /></Link>}
        <nav aria-label="Sidebar controls" className={cn("flex items-center gap-0.5", collapsed && "flex-col-reverse")}>
          <ProjectSearchDialog projects={filtered} loading={projectsLoading} error={projectListError} onOpenProject={handleOpenProject} />
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={onClose ? "Close sidebar" : collapsed ? "Show sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              aria-controls={onClose ? PROJECTS_MOBILE_SIDEBAR_ID : PROJECTS_DESKTOP_SIDEBAR_ID}
              className={cn(sidebarActionClass, "workspace-sidebar-toggle h-11 w-11 shrink-0 rounded-lg")}
            >
              <SidebarToggleIcon className="h-5 w-5" />
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className={cn(sidebarActionClass, "absolute right-3 top-3 z-30 h-11 w-11 bg-background")}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </nav>
      </header>

      <nav aria-label="Workspace" className="px-2 pb-5">
        <button type="button" title={collapsed ? "New project" : undefined} onClick={() => { onClose?.(); onNewProject() }} className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg bg-muted/60 px-3 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0")}>
          <SquarePen className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <span className={cn(collapsed && "sr-only")}>New project</span>
        </button>
      </nav>
      </>}
      footer={
      <footer className="px-2 pb-3 pt-2">
        <button type="button" onClick={() => { onClose?.(); openSettings() }} title={collapsed ? "Settings" : undefined} className={cn(sidebarActionClass, "mb-1 flex min-h-11 w-full justify-start gap-3 rounded-lg px-3 text-[13px] text-foreground", collapsed && "justify-center px-0")}>
          <Settings className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          <span className={cn(collapsed && "sr-only")}>Settings</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Open account menu for ${accountName}. ${stats.planName} plan.`}
              title={collapsed ? accountName : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left",
                "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="h-7 w-7 shrink-0 rounded-full">
                <AvatarImage src={user?.photoURL ?? undefined} alt="" className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full bg-accent-soft text-[10px] font-semibold text-accent-soft-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{accountName}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-[calc(100vw-2rem)] max-w-[16rem] rounded-2xl border border-border bg-popover p-2 shadow-lg">
            <p className="px-3 py-2 text-xs text-muted-foreground">{stats.planName} plan</p>
            <DropdownMenuItem className={accountMenuItemClass} onClick={() => router.push("/pricing")}>
              <CreditCard className="mr-2 h-3.5 w-3.5" />
              Billing &amp; Plans
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 bg-border/50" />
            <DropdownMenuItem className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => signOut()}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>}
    >
      <button
        id={recentBuildsHeadingId}
        type="button"
        title={collapsed ? "Show projects" : undefined}
        aria-label={collapsed ? "Show projects" : undefined}
        aria-expanded={!collapsed && projectsExpanded}
        aria-controls={recentBuildsListId}
        onClick={() => {
          if (collapsed) { setProjectsExpanded(true); onToggle?.() }
          else setProjectsExpanded((expanded) => !expanded)
        }}
        className={cn("group mb-1 mx-2 flex min-h-11 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0")}
      >
        {collapsed ? <FolderOpen className="size-4" strokeWidth={1.7} aria-hidden="true" /> : <>
          <span className="flex-1">{scope === "team" ? "Team projects" : "Projects"}</span>
          <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", !projectsExpanded && "-rotate-90")} aria-hidden="true" />
        </>}
      </button>

      {openingProject && <p role="status" className={cn("px-4 pb-2 text-xs text-muted-foreground", collapsed && "sr-only")}>Opening computer workspace…</p>}
      {openProjectError && <p role="alert" className={cn("px-4 pb-2 text-xs text-destructive", collapsed && "sr-only")}>{openProjectError}</p>}

      {/* ── Task list ── */}
      <div
        id={recentBuildsListId}
        hidden={collapsed || !projectsExpanded}
        className="pb-2"
        aria-labelledby={recentBuildsHeadingId}
        aria-busy={projectsLoading}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {projectsLoading
            ? `Loading ${recentBuildsLabel.toLowerCase()}`
            : `${recentBuilds.length} ${recentBuildsLabel.toLowerCase()} shown`}
        </p>
        {projectsLoading ? (
          <div className="space-y-5 px-5 py-3" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className={cn("h-3 rounded bg-muted", i % 2 ? "w-3/4" : "w-full")} />
                <div className="h-2 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : projectListError ? (
          <div role="alert" className="px-5 py-4">
            <p className="text-[13px] font-medium text-foreground">Projects couldn’t be loaded</p>
            <p className="mt-1.5 text-xs leading-relaxed text-destructive">{projectListError}</p>
          </div>
        ) : recentBuilds.length === 0 ? (
          <div className="px-5 py-5">
            <FolderOpen className="mb-3 size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[13px] font-medium text-foreground">No recent builds</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Your projects will appear here when you start building.
            </p>
          </div>
        ) : (
          <RevealGroup className="space-y-0.5 px-2" role="list" aria-label={recentBuildsLabel} animateOnMount>
            {recentBuilds.map((p) => (
              <RevealItem key={p.id} role="presentation">
                <ProjectNavigationRow
                  project={p}
                  onNavigate={() => { void handleOpenProject(p) }}
                  onChanged={onProjectsChanged}
                />
              </RevealItem>
            ))}
            {hiddenBuildCount > 0 ? (
              <div className="px-3 pb-1 pt-3 text-[11px] text-muted-foreground">
                {hiddenBuildCount} more available in search
              </div>
            ) : null}
          </RevealGroup>
        )}
      </div>

    </SideNav>
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

const projectStatusLabel: Record<ProjectSummary["status"], string> = {
  pending: "Draft", draft: "Draft", generating: "Building", complete: "Ready", error: "Needs attention", deleting: "Deleting",
}

function relativeTime(iso?: string): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const minutes = Math.round((Date.now() - then) / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function RecentProjects({ projects, loading, onOpen, onShowAll }: { projects: ProjectSummary[]; loading: boolean; onOpen: (project: ProjectSummary) => void; onShowAll: () => void }) {
  const recent = projects.slice(0, 6)
  if (!loading && recent.length === 0) return null
  return (
    <section aria-labelledby="recent-projects-heading" className="mt-14 w-full sm:mt-16">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="recent-projects-heading" className="text-[15px] font-bold tracking-[-0.01em] text-foreground">Recent projects</h2>
        {projects.length > recent.length && <button type="button" onClick={onShowAll} className="text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">All projects</button>}
      </div>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-[108px] animate-pulse rounded-2xl bg-muted/70" />)}
        </div>
      ) : (
        <RevealGroup as="ul" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" step={0.05} animateOnMount>
          {recent.map((project) => {
            const title = project.prompt.trim() || "Untitled build"
            const when = relativeTime(project.updatedAt ?? project.createdAt)
            return (
              <RevealItem as="li" key={project.id}>
                <button type="button" onClick={() => onOpen(project)} className="group flex h-full min-h-[108px] w-full flex-col justify-between gap-4 rounded-2xl bg-card p-4 text-left ring-1 ring-border/70 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-20px_rgb(0_0_0/0.35)] hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
                  <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">{title}</span>
                  <span className="flex items-center justify-between gap-3 text-[12px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", project.status === "generating" ? "animate-pulse bg-success" : project.status === "error" ? "bg-destructive" : "bg-muted-foreground/60")} />{projectStatusLabel[project.status]}{when && <span className="font-medium">· {when}</span>}</span>
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
                  </span>
                </button>
              </RevealItem>
            )
          })}
        </RevealGroup>
      )}
    </section>
  )
}

function WorkspacePlanControl({ planName, isPaidUser, compact = false }: { planName: string; isPaidUser: boolean; compact?: boolean }) {
  return <nav aria-label="Your plan" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card p-1">
    <span className={cn("whitespace-nowrap px-3 text-xs font-semibold text-muted-foreground", compact && "hidden min-[400px]:inline")}>{planName} plan</span>
    <Link
      href="/pricing"
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      {isPaidUser ? "View plans" : "Upgrade"}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  </nav>
}

function OnboardingBanner() {
  const searchParams = useSearchParams()
  const { currentWorkspace } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || searchParams.get("onboarding") !== "true") return null

  return (
    <div className="mb-8 flex items-start gap-3 border-b border-border pb-5">
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ProjectsWorkspace() {
  const router = useRouter()
  const { user, userData, account, workspaces, currentWorkspace, switchWorkspace, signOut, accountError, refreshAccount } = useAuth()
  const { openSettings } = useSettingsDialog()

  const isTeamsPlan = !!userData?.planId && userData.planId === "team"
  const isPaidUser = !!userData?.planId && userData.planId !== "free"
  const [briefRequest, setBriefRequest] = useState<{ prompt?: string; mode?: Brief["mode"]; id: number }>({ id: 0 })
  const [openError, setOpenError] = useState<string | null>(null)
  const openRequest = useRef<AbortController | null>(null)
  useEffect(() => () => openRequest.current?.abort(), [])
  const chooseBrief = (brief: Brief) => {
    setBriefRequest((value) => ({ prompt: brief.prompt, mode: brief.mode, id: value.id + 1 }))
    requestAnimationFrame(() => document.getElementById("workspace-brief")?.focus())
  }
  const openRecentProject = async (project: ProjectSummary) => {
    openRequest.current?.abort()
    const controller = new AbortController()
    openRequest.current = controller
    setOpenError(null)
    try {
      const path = await projectSessionPath(currentBackend(), project, controller.signal)
      if (!controller.signal.aborted) router.push(path)
    } catch (reason) {
      if (!controller.signal.aborted) setOpenError(reason instanceof Error ? reason.message : "Couldn’t open this project. Please try again.")
    }
  }
  const [scope, setScope] = useState<"user" | "team">("user")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [projectsExpanded, setProjectsExpanded] = useState(true)
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
      params.delete("checkout")
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    } catch {}
  }, [])
  useEffect(() => {
    if (!checkoutSuccessOpen || !user || !account?.subscriptionStatus) return
    try { clearCheckoutAttempt(window.sessionStorage, user.uid) } catch {}
  }, [checkoutSuccessOpen, user, account?.subscriptionStatus])

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

  const sidebarProps = {
    filtered: projects,
    projectListError: projectsError,
    onNewProject: () => requestAnimationFrame(() => document.getElementById('workspace-brief')?.focus()),
    projectsLoading,
    stats,
    router,
    onProjectsChanged: refreshProjects,
    user,
    signOut,
    isTeamsPlan,
    scope,
    setScope,
    projectsExpanded,
    setProjectsExpanded,
    workspaces,
    currentWorkspace,
    switchWorkspace,
    isPaidUser,
  }

  if (user && !userData) return <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
    <div role="alert" className="w-full max-w-md">
      <p className="site-eyebrow mb-4">Workspace</p>
      <h1 className="text-3xl font-semibold tracking-tight">Let’s reconnect your account</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{accountError || 'Account data is unavailable.'}</p>
      <Button type="button" className="mt-6" onClick={() => { void refreshAccount().catch(() => {}) }}>Retry account connection</Button>
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
            "fixed inset-y-0 left-0 z-50 w-[min(19rem,calc(100vw-2rem))]",
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
            "hidden shrink-0 transition-[width] duration-200 ease-in-out motion-reduce:transition-none lg:block",
            desktopSidebarCollapsed ? "lg:w-16" : "lg:w-64"
          )}
        >
          <Sidebar {...sidebarProps} collapsed={desktopSidebarCollapsed} onToggle={() => setDesktopSidebarCollapsed((collapsed) => !collapsed)} />
        </aside>

        {/* ── Main content ── */}
        <main
          id={PROJECTS_MAIN_ID}
          aria-labelledby={PROJECTS_HEADING_ID}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background"
        >
          <header className="hidden h-20 shrink-0 items-center justify-end gap-4 px-8 lg:flex">
            <WorkspacePlanControl planName={stats.planName} isPaidUser={isPaidUser} />
          </header>

          {/* ── Mobile top bar ── */}
          <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-controls={PROJECTS_MOBILE_SIDEBAR_ID}
              aria-expanded={mobileSidebarOpen}
              className={cn(sidebarActionClass, "h-11 w-11")}
            >
              <SidebarToggleIcon className="h-5 w-5" />
            </button>
            <Link href="/" className="flex min-w-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30" aria-label="Go to Lotus home"><BrandWordmark size="nav" /></Link>
            <div className="ml-auto"><WorkspacePlanControl planName={stats.planName} isPaidUser={isPaidUser} compact /></div>
          </header>

          {/* Composer surface */}
          <div className="relative z-10 flex min-h-0 flex-1">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden md:rounded-t-[1.125rem] lg:rounded-t-[1.25rem]">
              <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                <div className="relative isolate flex min-h-full w-full flex-col items-center justify-start overflow-hidden bg-transparent px-5 pb-20 md:rounded-t-[1.125rem] sm:px-8 sm:pb-24 lg:rounded-t-[1.25rem]">

                  <div className="relative z-10 w-full max-w-[60rem]">
                    <div className="mx-auto flex w-full max-w-[760px] flex-col pb-16 pt-8 sm:pt-12 lg:pt-[9vh]">
                      <Suspense fallback={null}>
                        <OnboardingBanner />
                      </Suspense>
                      {(accountError || projectsError || openError) && <div role="alert" className="mb-8 rounded-xl bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">
                        <p>{accountError || projectsError || openError}</p>
                        {(accountError || projectsError) && <button type="button" className="mt-1 min-h-11 rounded-lg font-semibold underline underline-offset-4" onClick={() => {
                          void refreshAccount().then(refreshProjects).catch(() => {})
                        }}>Retry connection</button>}
                      </div>}

                      <RevealGroup className="mb-7 text-center sm:mb-8" animateOnMount>
                        <RevealItem as="h1" id={PROJECTS_HEADING_ID} className="mx-auto text-[clamp(30px,5vw,48px)] font-bold leading-[1.02] tracking-[-0.05em] text-foreground">
                          What should we build today?
                        </RevealItem>
                        <RevealItem as="p" className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-muted-foreground">Describe a website, app or tool. LotusBuild asks the right questions, then builds it while you watch.</RevealItem>
                      </RevealGroup>

                      <div className="relative">
                        <AnimatedAIInput
                          inputId="workspace-brief"
                          appearance="assistant"
                          suggestedPrompt={briefRequest.id === 0 ? undefined : briefRequest.prompt}
                          promptRequestId={briefRequest.id}
                          suggestedMode={briefRequest.mode}
                          onManageProjects={() => {
                            setProjectsExpanded(true)
                            if (window.matchMedia("(min-width: 1024px)").matches) setDesktopSidebarCollapsed(false)
                            else setMobileSidebarOpen(true)
                          }}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Start from a type of project">
                        {heroCategories.map((category) => (
                          <button key={category.key} type="button" onClick={() => chooseBrief(category)} className="inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-muted-foreground ring-1 ring-border/80 transition-colors hover:bg-foreground hover:text-background hover:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
                            <category.icon width={14} height={14} />{category.label}
                          </button>
                        ))}
                      </div>

                      <RecentProjects projects={projects} loading={projectsLoading} onOpen={(project) => { void openRecentProject(project) }} onShowAll={() => {
                        setProjectsExpanded(true)
                        if (window.matchMedia("(min-width: 1024px)").matches) setDesktopSidebarCollapsed(false)
                        else setMobileSidebarOpen(true)
                      }} />
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
          <DialogContent className="relative max-w-md rounded-2xl border-border bg-card p-6 sm:p-8">
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
                    className="h-11 w-full rounded-xl border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                    onClick={() => { handleCheckoutSuccessChange(false); openSettings() }}
                  >
                    Manage plan
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
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
                    We’re checking your account for a plan update. A checkout return alone does not confirm payment.
                  </DialogDescription>
                </DialogHeader>
              </>
            ) : (
              <>
                <DialogHeader className="items-center space-y-3 text-center sm:text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <CreditCard className="h-7 w-7 text-muted-foreground" strokeWidth={1.75} />
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
                    className="h-11 w-full rounded-xl border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                    onClick={() => { handleCheckoutSuccessChange(false); openSettings() }}
                  >
                    View settings
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
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
