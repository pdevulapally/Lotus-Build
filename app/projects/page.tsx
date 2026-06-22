"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { ShaderGradientBackground } from "@/components/ui/shader-gradient-background"
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
  Share2,
  ChevronDown,
  Lock,
  Plus,
} from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { CreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
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
  "inline-flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"


const accountMenuItemClass =
  "h-10 cursor-pointer rounded-lg px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

const RECENT_BUILDS_LIMIT = 6

function projectTitle(prompt: string, max = 42): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const PROJECT_STATUS_META: Record<ProjectStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-muted-foreground/40", label: "Draft" },
  generating: { dot: "animate-pulse bg-primary", label: "Building" },
  complete: { dot: "bg-success", label: "Ready" },
  error: { dot: "bg-destructive", label: "Needs attention" },
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

  return (
    <div className="group/row relative px-1">
      <button
        type="button"
        onClick={onNavigate}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 pr-9 text-left",
          "transition-colors hover:bg-muted"
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-snug text-foreground/85 group-hover/row:text-foreground">
            {projectTitle(p.prompt, 34)}
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
        aria-label="Delete"
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2",
          "flex h-7 w-7 items-center justify-center rounded-lg",
          "text-muted-foreground/40 opacity-0 transition-all",
          "hover:bg-destructive/10 hover:text-destructive",
          "group-hover/row:opacity-100 focus:opacity-100"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search builds…"
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-background pl-8 pr-8",
          "text-[13px] text-foreground placeholder:text-muted-foreground/50",
          "outline-none transition-colors focus:border-border focus:ring-0"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/55 hover:text-foreground"
        >
          <X className="h-3 w-3" />
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
  const title = scope === "team" ? "Team build directory" : "Build directory"

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-background/65 bg-background/78 shadow-[0_24px_80px_-62px_var(--primary)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 border-b border-border/55 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Search your saved builds and reopen the one you need.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          {builds.length}
        </span>
      </div>

      <div className="px-2 pt-2">
        <SearchBar value={search} onChange={onSearchChange} />
      </div>

      <div className="max-h-[24rem] overflow-y-auto p-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {loading ? (
          <div className="space-y-2 p-2">
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
          <div className="grid gap-2 sm:grid-cols-2">
            {builds.map((build) => {
              const status = PROJECT_STATUS_META[build.status] ?? PROJECT_STATUS_META.pending
              const title = projectTitle(build.prompt, 72)

              return (
                <button
                  key={build.id}
                  type="button"
                  onClick={() => onOpenBuild(build)}
                  className="group flex min-h-[7.25rem] flex-col rounded-xl border border-border/55 bg-background/70 p-3.5 text-left transition-colors hover:border-border hover:bg-background/90 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-foreground">
                      {title}
                    </span>
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                    {(build.prompt || "").trim() || "Untitled build"}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-[11px] text-muted-foreground">
                    <span>{build.kind === "computer" ? "Computer agent" : "Website build"}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {status.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
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
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 1).toUpperCase() ?? "U"
  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspace?.id)
  const selectedWorkspaceName = currentWorkspace?.name ?? "Personal workspace"
  const selectedWorkspaceInitial = selectedWorkspaceName.charAt(0).toUpperCase()
  const recentBuilds = filtered.slice(0, RECENT_BUILDS_LIMIT)
  const hiddenBuildCount = Math.max(0, filtered.length - recentBuilds.length)
  const handleWorkspaceSelect = async (workspaceId: string) => {
    await switchWorkspace(workspaceId)
    if (isTeamsPlan) setScope("team")
    onClose?.()
    router.push("/projects")
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">

      {/* ── Logo row ── */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Link href="/" onClick={onClose} className="flex items-center gap-2">
          <LotusLogo size={28} />
          <span className="font-display text-[16px] font-semibold tracking-tight text-foreground">
            Lotus.build
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className={cn(sidebarActionClass, "h-9 w-9")}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(sidebarActionClass, "h-8 w-8")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Workspace switcher ── */}
      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3",
                "text-left transition-colors hover:bg-muted"
              )}
              aria-label="Switch workspace"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                {selectedWorkspaceInitial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">
                  {selectedWorkspaceName}
                </span>
                <span className="block text-[11px] text-muted-foreground">Workspace</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-[15.75rem] overflow-hidden rounded-lg border-border bg-card p-1.5 shadow-lg"
          >
            <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
              Workspaces
            </div>

            {/* Current workspace */}
            <DropdownMenuItem
              disabled
              className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2.5 opacity-100 focus:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                {selectedWorkspaceInitial}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {selectedWorkspaceName}
              </span>
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            </DropdownMenuItem>

            {isPaidUser ? (
              <>
                {otherWorkspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onSelect={() => void handleWorkspaceSelect(workspace.id)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 focus:bg-muted"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/80">
                      {workspace.name}
                    </span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuItem
                  onSelect={onCreateWorkspace}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 focus:bg-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[13px] font-medium text-muted-foreground">Add workspace</span>
                </DropdownMenuItem>
              </>
            ) : (
              <div className="mx-1 mt-1 flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-muted-foreground">Switch workspaces</p>
                  <Link
                    href="/pricing"
                    className="text-[11px] font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
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
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
            {(["user", "team"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
                  scope === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {id === "team" && <Users className="h-3.5 w-3.5" />}
                {id === "team" ? "Team" : "Mine"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 mb-3 h-px bg-border" />

      {/* ── Section header ── */}
      <div className="mb-2 flex items-center justify-between px-4">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {scope === "team" ? "Recent team builds" : "Recent builds"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {recentBuilds.length}{hiddenBuildCount ? `/${filtered.length}` : ""}
        </span>
      </div>

      {/* ── Task list ── */}
      <div className="flex-1 overflow-y-auto pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {projectsLoading ? (
          <div className="space-y-2 px-3 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted"
                style={{ opacity: 1 - i * 0.09 }}
              />
            ))}
          </div>
        ) : recentBuilds.length === 0 ? (
          <div className="mx-3 rounded-lg border border-border bg-muted/35 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-foreground">No recent builds</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Start with a prompt and your builds will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
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
              <div className="px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground">
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
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg border border-border bg-muted/35 px-3 py-3",
            "text-left transition-colors hover:bg-muted"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Gift className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground">Invite a friend</p>
            <p className="truncate text-[11px] text-muted-foreground">You both get 500 credits</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── User row ── */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2",
                "transition-colors hover:bg-muted"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarImage
                  src={user?.photoURL ?? undefined}
                  alt=""
                  className="rounded-lg object-cover"
                />
                <AvatarFallback className="rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                  {user?.displayName ?? user?.email?.split("@")[0] ?? "User"}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {stats.planName} plan
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-[calc(100vw-2rem)] max-w-[16rem] rounded-lg border-border bg-card p-2 shadow-lg"
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
              onClick={() => router.push("/settings")}
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-2 bg-border" />
            <DropdownMenuItem
              className="h-10 cursor-pointer rounded-lg px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
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
        className="absolute inset-0 bg-primary/35 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite a friend"
        className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-[36rem] overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-xl sm:max-h-[calc(100dvh-3rem)] sm:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="pr-10">
          <p className="mb-3 inline-flex rounded-md bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            500 credits each
          </p>
          <h2 className="text-[22px] font-semibold tracking-[-0.035em] text-foreground sm:text-[26px]">
            Invite friends, earn credits
          </h2>
          <p className="mt-2 max-w-[30rem] text-[13.5px] leading-6 text-muted-foreground sm:text-[14px]">
            Share your link. When a friend joins a paid plan, you both receive{" "}
            <span className="font-medium text-foreground">500 credits</span>.
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/55 px-4 py-3.5">
            <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground">
              {referralCount}
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Friend{referralCount === 1 ? "" : "s"} joined
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/55 px-4 py-3.5">
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
            <div className="flex min-w-0 items-center rounded-lg border border-border bg-background px-3.5 py-3">
              <span className="truncate text-[13px] text-muted-foreground">
                {link || "Sign in to generate your link"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              className={cn(
                "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-[13px] font-semibold",
                "transition-all active:scale-[0.97] disabled:opacity-50",
                copied
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={handleShare}
            disabled={!link}
            className={cn(
              "mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-lg",
              "border border-border bg-background px-4",
              "text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
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
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[13px] font-bold text-primary">
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

export default function ProjectsPage() {
  const router = useRouter()
  const { user, userData, workspaces, currentWorkspace, switchWorkspace, signOut } = useAuth()

  const isTeamsPlan = !!userData?.planId && planIdForDisplay(userData.planId) === "team"
  const isPaidUser = !!userData?.planId && userData.planId !== "free"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [search, setSearch] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

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

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, kind?: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await deleteDoc(doc(db, kind === "computer" ? "computerSessions" : "projects", projectId))
    } catch (err) {
      console.error(`Failed to delete ${kind || "project"}:`, err)
    }
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

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
    <ProtectedRoute>
      <div className="flex h-[100dvh] overflow-hidden bg-background">

        {/* ── Mobile overlay ── */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
            mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />

        {/* ── Mobile drawer ── */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(21.5rem,calc(100vw-1rem))]",
            "border-r border-border shadow-lg",
            "transition-transform duration-200 ease-in-out lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar
            {...sidebarProps}
            onClose={() => setMobileSidebarOpen(false)}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* ── Desktop sidebar ── */}
        <aside
          className={cn(
            "hidden shrink-0 transition-[width] duration-200 ease-in-out lg:block",
            desktopSidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-[280px]"
          )}
        >
          <div className="relative h-full bg-sidebar after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:translate-x-full after:bg-gradient-to-r after:from-sidebar after:to-transparent">
            <Sidebar {...sidebarProps} onToggle={() => setDesktopSidebarCollapsed(true)} />
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">

          {/* ── Mobile top bar ── */}
          <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              className={cn(sidebarActionClass, "h-9 w-9")}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <LotusLogo size={24} />
              <span className="font-display text-[15px] font-semibold text-foreground">Lotus.build</span>
            </Link>
          </header>

          {/* ── Desktop: expand sidebar button ── */}
          {desktopSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed(false)}
              aria-label="Show sidebar"
              className={cn(
                "absolute left-4 top-4 z-20 hidden lg:flex",
                "h-9 w-9 items-center justify-center rounded-lg",
                "border border-border bg-background text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground"
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          {/* Composer surface */}
          <div className="relative z-10 flex min-h-0 flex-1 pt-3 sm:pt-4">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-t-[1.125rem] shadow-[0_28px_100px_-86px_var(--primary)] sm:rounded-t-[1.25rem]">
              <div className="h-full overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
                <div className="relative isolate flex min-h-[calc(100dvh+12rem)] w-full flex-col items-center justify-start overflow-hidden rounded-t-[1.125rem] px-5 pb-24 pt-14 sm:rounded-t-[1.25rem] sm:px-8 sm:pb-28 sm:pt-16 lg:pt-20">
                  <ShaderGradientBackground
                    className="z-0 rounded-t-[inherit]"
                    opacity={0.82}
                  />

                  <div className="relative z-10 w-full max-w-[60rem]">
                    <div className="mx-auto w-full max-w-[44rem]">
                      <Suspense fallback={null}>
                        <OnboardingBanner />
                      </Suspense>

                      <div className="mb-8 flex justify-center">
                        <div className="inline-flex items-center gap-2.5 rounded-full border border-background/60 bg-background/72 px-3.5 py-1.5 text-[12px] text-muted-foreground shadow-[0_16px_50px_-38px_var(--primary)] backdrop-blur-xl">
                          <span className="font-medium text-foreground">{stats.planName} workspace</span>
                          <span className="h-3 w-px bg-border/70" />
                          <Link href="/pricing" className="font-semibold text-primary transition-colors hover:text-primary/80">
                            Upgrade
                          </Link>
                        </div>
                      </div>

                      <div className="mb-8 text-center">
                        <h1 className="text-[2rem] font-medium tracking-[-0.055em] text-white sm:text-[2.6rem]">
                          <span className="font-semibold">{greeting}</span>
                          {firstName ? `, ${firstName}` : ""}
                        </h1>
                        <p className="mx-auto mt-4 max-w-[30rem] text-[14px] leading-7 text-white">
                          Describe what you want to build. Lotus turns the brief into a focused workspace.
                        </p>
                      </div>

                      <AnimatedAIInput
                        placeholder="Describe the app, website, or flow you want to create..."
                        wrapperClassName="border-background/70 bg-background/82 shadow-[0_26px_90px_-68px_var(--primary)] backdrop-blur-xl"
                      />
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
      </div>
    </ProtectedRoute>
  )
}