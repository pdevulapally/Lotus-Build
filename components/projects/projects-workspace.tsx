"use client"

import { Suspense, useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { deleteDoc, doc } from "firebase/firestore"
import {
  Settings,
  Search,
  Trash2,
  LogOut,
  Users,
  CreditCard,
  X,
  ChevronRight,
  PanelLeft,
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

import { CreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
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
import { db } from "@/lib/firebase"
import { planIdForDisplay } from "@/lib/plans"
import { useProjectList } from "@/hooks/use-project-list"
import { useSettingsDialog } from "@/components/settings/settings-dialog"

/* ─── types ─────────────────────────────────────────────────────────────── */

type ProjectStatus = "pending" | "generating" | "complete" | "error"

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
}

function projectKindLabel(kind?: ProjectSummary["kind"]): string {
  return kind === "computer" ? "Computer agent" : "Website build"
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
          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 pr-9 text-left",
          "transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-snug text-foreground/90 group-hover/row:text-foreground">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-muted-foreground">
            {p.kind === "computer" ? "Computer agent" : "Website build"} · {status.label}
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

/* ─── SearchBar ───────────────────────────────────────────────────────────── */

function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative mx-3 mb-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" aria-hidden="true" />
      <input
        type="search"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search saved builds"
        placeholder="Search builds…"
        className={cn(
          "lotus-glass-control h-9 w-full rounded-full border pl-8 pr-8",
          "text-[13px] text-foreground placeholder:text-muted-foreground/50",
          "outline-none transition-colors focus:border-border-strong focus:ring-0"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear build search"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/55 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/* ─── FullBuildsPanel ────────────────────────────────────────────────────── */

function FullBuildsPanel({
  builds,
  loading,
  search,
  onSearchChange,
  scope,
  onOpenBuild,
}: {
  builds: ProjectSummary[]
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  scope: "user" | "team"
  onOpenBuild: (build: ProjectSummary) => void
}) {
  const headingId = useId()
  const searchTerm = search.trim()
  const resultSummary = loading
    ? "Loading saved builds"
    : searchTerm
      ? `${builds.length} saved ${builds.length === 1 ? "build" : "builds"} match "${searchTerm}"`
      : `${builds.length} saved ${builds.length === 1 ? "build" : "builds"} available`
  const title = scope === "team" ? "Team build directory" : "Build directory"

  return (
    <section
      aria-labelledby={headingId}
      className="lotus-glass-panel mt-8 overflow-hidden rounded-2xl border border-border/55"
    >
      <p className="sr-only" role="status" aria-live="polite">
        {resultSummary}
      </p>
      <div className="flex items-center justify-between gap-4 border-b border-border/55 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[13px] font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Search your saved builds and reopen the one you need.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-soft-foreground"
          aria-label={resultSummary}
        >
          {builds.length}
        </span>
      </div>

      <div className="px-2 pt-2">
        <SearchBar value={search} onChange={onSearchChange} />
      </div>

      <div
        className="max-h-[24rem] overflow-y-auto p-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
        aria-busy={loading}
      >
        {loading ? (
          <div className="space-y-2 p-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted/70"
                style={{ opacity: 1 - i * 0.16 }}
              />
            ))}
          </div>
        ) : builds.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-foreground">
              {search ? "No matching builds" : "No builds yet"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {search ? "Try a different search." : "Start with a prompt and your builds will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="list" aria-label={resultSummary}>
            {builds.map((build) => {
              const status = PROJECT_STATUS_META[build.status] ?? PROJECT_STATUS_META.pending
              const title = projectTitle(build.prompt, 72)

              return (
                <div key={build.id} role="listitem">
                  <button
                    type="button"
                    onClick={() => onOpenBuild(build)}
                    aria-label={`Open ${projectAccessibleSummary(build)}`}
                    className="lotus-glass-control group flex min-h-[7.25rem] w-full flex-col rounded-2xl border p-3.5 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-foreground">
                      {title}
                    </span>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                    {(build.prompt || "").trim() || "Untitled build"}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] text-muted-foreground">
                    <span>{build.kind === "computer" ? "Computer agent" : "Website build"}</span>
                    <span className="rounded-full bg-slate-soft px-2 py-0.5 text-[10.5px] font-medium text-slate-soft-foreground">
                      {status.label}
                    </span>
                  </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

function Sidebar({
  filtered,
  projectsLoading,
  stats,
  router,
  handleDeleteProject,
  user,
  signOut,
  onClose,
  onToggle,
  onShare,
  isTeamsPlan,
  scope,
  setScope,
  workspaces,
  currentWorkspace,
  switchWorkspace,
  isPaidUser,
  onCreateWorkspace,
}: {
  filtered: ProjectSummary[]
  projectsLoading: boolean
  stats: { planName: string }
  router: ReturnType<typeof useRouter>
  handleDeleteProject: (e: React.MouseEvent, id: string, kind?: string) => void
  user: any
  signOut: () => void
  onClose?: () => void
  onToggle?: () => void
  onShare: () => void
  isTeamsPlan: boolean
  scope: "user" | "team"
  setScope: (s: "user" | "team") => void
  workspaces: Array<{ id: string; name: string; slug?: string }>
  currentWorkspace: { id: string; name: string; slug?: string } | null
  switchWorkspace: (workspaceId: string) => Promise<void>
  isPaidUser: boolean
  onCreateWorkspace: () => void
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
    <div className="workspace-sidebar relative flex h-full flex-col overflow-visible rounded-[1.75rem] border border-border/65 text-foreground">

      {/* ── Logo row ── */}
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/" onClick={onClose} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30" aria-label="Go to Lotus home">
          <LotusLogo size={28} />
          <span className="font-display text-[16px] font-semibold tracking-tight text-foreground/90">
            Lotus.build
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={onClose ? "Close sidebar" : "Collapse sidebar"}
              className={cn(sidebarActionClass, "workspace-sidebar-toggle absolute right-4 top-4 z-30 h-8 w-8")}
            >
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
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

      {/* ── Workspace switcher ── */}
      <div className="px-3 pb-3 pt-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex h-11 w-full items-center gap-2.5 rounded-2xl border border-transparent bg-card/32 px-3",
                "text-left transition-colors hover:border-border/70 hover:bg-card/58 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
              )}
              aria-label={`Switch workspace. Current workspace: ${selectedWorkspaceName}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-soft-foreground">
                {selectedWorkspaceInitial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">
                  {selectedWorkspaceName}
                </span>
                <span className="block text-[11px] text-muted-foreground">Workspace</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="lotus-glass-strong w-[15.75rem] overflow-hidden rounded-2xl border border-border/60 p-1.5 shadow-lg"
          >
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
              Workspaces
            </div>

            {/* Current workspace */}
            <DropdownMenuItem
              disabled
              aria-label={`Current workspace: ${selectedWorkspaceName}`}
              className="flex cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2.5 opacity-100 focus:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {selectedWorkspaceInitial}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {selectedWorkspaceName}
              </span>
              <Check className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
            </DropdownMenuItem>

            {isPaidUser ? (
              <>
                {otherWorkspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => void handleWorkspaceSelect(workspace.id)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 focus:bg-muted"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/80">
                      {workspace.name}
                    </span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuItem
                  onSelect={onCreateWorkspace}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 focus:bg-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[13px] font-medium text-muted-foreground">Add workspace</span>
                </DropdownMenuItem>
              </>
            ) : (
              <div className="lotus-glass-inset mx-1 mt-1 flex items-center gap-2.5 rounded-xl border border-border/55 px-2.5 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-muted-foreground">Switch workspaces</p>
                  <Link
                    href="/pricing"
                    className="text-[11px] font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Upgrade to unlock
                  </Link>
                </div>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Team / personal scope toggle ── */}
      {isTeamsPlan && (
        <div className="px-3 pb-3">
          <div className="lotus-glass-control grid grid-cols-2 rounded-2xl border p-1" role="group" aria-labelledby={scopeToggleLabelId}>
            <span id={scopeToggleLabelId} className="sr-only">Build scope</span>
            {(["user", "team"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                aria-pressed={scope === id}
                aria-label={id === "team" ? "Show team builds" : "Show my builds"}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30",
                  scope === id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {id === "team" && <Users className="h-3.5 w-3.5" aria-hidden="true" />}
                {id === "team" ? "Team" : "Mine"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-4 mb-3 border-t border-border/55" />

      {/* ── Section header ── */}
      <div className="mb-2 flex items-center justify-between px-4">
        <span id={recentBuildsHeadingId} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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

      {/* ── Referral card ── */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={onShare}
          aria-label="Invite a friend. You both get 500 credits."
          className={cn(
            "lotus-glass-control group flex w-full items-center gap-2.5 rounded-2xl border px-3 py-3",
            "text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card">
            <Gift className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground">Invite a friend</p>
            <p className="truncate text-[11px] text-muted-foreground">You both get 500 credits</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>

      {/* ── User row ── */}
      <div className="shrink-0 border-t border-border/45 px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Open account menu for ${accountName}. ${stats.planName} plan.`}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2 py-2",
                "transition-colors hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30"
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
  const { user, userData, workspaces, currentWorkspace, switchWorkspace, signOut } = useAuth()
  const { openSettings } = useSettingsDialog()

  const isTeamsPlan = !!userData?.planId && planIdForDisplay(userData.planId) === "team"
  const isPaidUser = !!userData?.planId && userData.planId !== "free"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [search, setSearch] = useState("")
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

  const { projects, loading: projectsLoading } = useProjectList({
    scope,
    uid: user?.uid ?? null,
    workspaceId: scope === "team" ? userData?.currentWorkspaceId || null : null,
    getAuthHeader,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => !q || (p.prompt || "").toLowerCase().includes(q))
  }, [projects, search])

  const stats = useMemo(() => {
    const planName = userData?.planName || "Free"
    return { planName }
  }, [userData])

  // Live subscription details for the checkout-success dialog. All values come
  // from the user doc the Stripe webhook writes to, so the dialog updates
  // reactively the moment the plan activates — nothing is hardcoded.
  const checkoutSuccessInfo = useMemo(() => {
    const planKey = userData?.planId ? planIdForDisplay(userData.planId) : null
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
      await deleteDoc(doc(db, kind === "computer" ? "computerSessions" : "projects", projectId))
    } catch (err) {
      console.error(`Failed to delete ${kind || "project"}:`, err)
    }
  }

  const firstName = user?.displayName?.split(" ")[0] ?? ""

  const handleOpenBuild = useCallback((build: ProjectSummary) => {
    router.push(build.kind === "computer" ? `/computer/${build.id}` : `/project/${build.id}`)
  }, [router])

  const sidebarProps = {
    filtered: projects,
    projectsLoading,
    stats,
    router,
    handleDeleteProject,
    user,
    signOut,
    onShare: () => { setMobileSidebarOpen(false); setReferralOpen(true) },
    isTeamsPlan,
    scope,
    setScope,
    workspaces,
    currentWorkspace,
    switchWorkspace,
    isPaidUser,
    onCreateWorkspace: () => setCreateModalOpen(true),
  }

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
            "fixed inset-y-2 left-2 z-50 w-[min(21rem,calc(100vw-1.25rem))]",
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
            desktopSidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-[304px]"
          )}
        >
          {!desktopSidebarCollapsed && (
            <div className="relative h-full p-3 pr-0">
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
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link href="/" className="flex min-w-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/30" aria-label="Go to Lotus home">
              <LotusLogo size={24} />
              <span className="truncate font-display text-[16px] font-semibold tracking-tight text-foreground/90">
                Lotus.build
              </span>
            </Link>
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
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Composer surface */}
          <div className="relative z-10 flex min-h-0 flex-1">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden md:rounded-t-[1.125rem] lg:rounded-t-[1.25rem]">
              <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                <div className="relative isolate flex min-h-[calc(100dvh+8rem)] w-full flex-col items-center justify-start overflow-hidden bg-transparent px-5 pb-20 md:rounded-t-[1.125rem] sm:px-8 sm:pb-24 lg:rounded-t-[1.25rem]">

                  <div className="relative z-10 w-full max-w-[60rem]">
                    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[44rem] flex-col justify-center py-10 sm:min-h-[calc(100dvh-9rem)] sm:py-12 md:py-14 lg:py-16">
                      <Suspense fallback={null}>
                        <OnboardingBanner />
                      </Suspense>

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
                          className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto max-w-4xl whitespace-nowrap text-3xl font-medium leading-[1.05] text-foreground duration-700 sm:text-3xl lg:text-4xl"
                          style={{ animationDelay: "80ms" }}
                        >
                          What can I build for you{firstName ? `, ${firstName}` : ""}?
                        </h1>
                        <p
                          className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto mt-5 max-w-[34rem] text-[14px] leading-7 text-muted-foreground duration-700 sm:mt-6 sm:text-base"
                          style={{ animationDelay: "140ms" }}
                        >
                          Describe the site or app you need. Lotus turns the brief into a live workspace you can keep refining.
                        </p>
                      </div>

                      <div
                        className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative duration-700"
                        style={{ animationDelay: "200ms" }}
                      >
                        <AnimatedAIInput
                          placeholder="Build a refined site for..."
                          wrapperClassName="liquid-composer rounded-[1.75rem] border-border-strong/60 bg-card/70 [&_textarea]:min-h-[88px] [&_textarea]:text-foreground [&_textarea]:placeholder:text-foreground/55 [&_button]:rounded-full [&_button[aria-pressed=true]]:bg-accent [&_button[aria-pressed=true]]:text-accent-foreground [&_button.bg-primary]:bg-accent [&_button.bg-primary]:text-accent-foreground [&_button.bg-primary:hover]:bg-accent/90"
                          footerHintsClassName="text-foreground/60"
                        />
                      </div>
                    </div>

                    <FullBuildsPanel
                      builds={filtered}
                      loading={projectsLoading}
                      search={search}
                      onSearchChange={setSearch}
                      scope={scope}
                      onOpenBuild={handleOpenBuild}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <ReferralDialog
          open={referralOpen}
          onClose={() => setReferralOpen(false)}
          referralCode={user?.uid ?? null}
          referralCount={userData?.referralCount ?? 0}
          creditsEarned={userData?.referralCreditsEarned ?? 0}
        />

        <CreateWorkspaceModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />

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
                    Payment confirmed — your plan is active and your credits are ready to use.
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
                    Payment received
                  </DialogTitle>
                  <DialogDescription className="text-[13.5px] leading-relaxed text-muted-foreground">
                    Your plan is taking a little longer than usual to activate. You can keep building — your credits will appear automatically.
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
