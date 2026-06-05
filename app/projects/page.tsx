"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { deleteDoc, doc } from "firebase/firestore"
import {
  Settings,
  Search,
  Clock,
  Trash2,
  LogOut,
  Users,
  CreditCard,
  Terminal,
  AppWindow,
  ArrowUpRight,
  Zap,
  Plus,
  FolderOpen,
  PanelLeft,
  X,
} from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { planIdForDisplay } from "@/lib/plans"
import { useProjectList } from "@/hooks/use-project-list"

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

function toDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function sectionLabel(d: Date | null): "Today" | "Yesterday" | "Previous" {
  if (!d) return "Previous"
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (d >= today) return "Today"
  if (d >= yesterday) return "Yesterday"
  return "Previous"
}

function projectTitle(prompt: string, max = 48): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function formatRelative(value: any): string {
  const d = toDate(value)
  if (!d) return "—"
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function statusAccent(status: ProjectStatus) {
  if (status === "complete") return "bg-emerald-400"
  if (status === "generating") return "bg-blue-400 animate-pulse"
  if (status === "error") return "bg-red-400"
  return "bg-zinc-300"
}

function statusText(status: ProjectStatus) {
  if (status === "complete") return "Ready"
  if (status === "generating") return "Building"
  if (status === "error") return "Error"
  return "Queued"
}

function statusBadgeClass(status: ProjectStatus) {
  if (status === "complete") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (status === "generating") return "bg-blue-50 text-blue-700 ring-blue-200"
  if (status === "error") return "bg-red-50 text-red-600 ring-red-200"
  return "bg-zinc-100 text-zinc-500 ring-zinc-200"
}

function statusTextColor(status: ProjectStatus) {
  if (status === "complete") return "text-emerald-600"
  if (status === "generating") return "text-blue-500"
  if (status === "error") return "text-red-500"
  return "text-zinc-400"
}

// ── Sidebar history item ────────────────────────────────────────────────────
function HistoryItem({ p, onNavigate, onDelete }: {
  p: ProjectSummary
  onNavigate: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const href = p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`
  return (
    <div className="group/item relative rounded-xl border border-transparent px-1 transition-all hover:border-border hover:bg-white/70">
      <button
        type="button"
        onClick={onNavigate}
        className="flex w-full items-start gap-2.5 px-2 py-2.5 text-left"
      >
        {/* Kind + status */}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white">
          {p.kind === "computer"
            ? <Terminal className="h-3.5 w-3.5 text-zinc-500" />
            : <AppWindow className="h-3.5 w-3.5 text-zinc-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-snug text-zinc-800">
            {projectTitle(p.prompt, 30)}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusAccent(p.status))} />
            <span className={cn("text-[10.5px] font-medium", statusTextColor(p.status))}>
              {statusText(p.status)}
            </span>
            <span className="text-[10px] text-zinc-400">· {formatRelative(p.createdAt)}</span>
          </div>
        </div>
      </button>
      {/* Delete — visible on hover */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-400 group-hover/item:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Sidebar panel content (reused in desktop aside + mobile drawer) ─────────
function SidebarContent({ grouped, filtered, projectsLoading, search, stats, router, handleDeleteProject, onClose }: {
  grouped: Record<"Today" | "Yesterday" | "Previous", ProjectSummary[]>
  filtered: ProjectSummary[]
  projectsLoading: boolean
  search: string
  stats: { planName: string; tokenPct: number; tokensUsed: number; tokensLimit: number }
  router: ReturnType<typeof useRouter>
  handleDeleteProject: (e: React.MouseEvent, id: string, kind?: string) => void
  onClose?: () => void
}) {
  return (
    <>
      {/* Logo + close (mobile only) */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-7 w-7 object-contain" />
          <span className="text-[14px] font-semibold tracking-tight text-foreground">lotus.build</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New build button */}
      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => {
            onClose?.()
            setTimeout(() => {
              const el = document.querySelector<HTMLElement>("[data-animated-ai-input]")
              el?.focus()
              el?.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 150)
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          New build…
        </button>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]">
        {projectsLoading ? (
          <div className="space-y-2 px-2 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[52px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <FolderOpen className="h-5 w-5 text-zinc-400" />
            <p className="mt-2 text-xs text-zinc-400">{search ? "No results" : "No builds yet"}</p>
          </div>
        ) : (
          (["Today", "Yesterday", "Previous"] as const).map((key) => {
            if (grouped[key].length === 0) return null
            return (
              <div key={key} className="mt-3">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{key}</p>
                <div className="space-y-0.5">
                  {grouped[key].map((p) => (
                    <HistoryItem
                      key={p.id}
                      p={p}
                      onNavigate={() => {
                        onClose?.()
                        router.push(p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`)
                      }}
                      onDelete={(e) => handleDeleteProject(e, p.id, p.kind)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Credits footer */}
      <div className="border-t border-border px-3 py-3">
        <div className="rounded-xl border border-border bg-white/60 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{stats.planName} plan</span>
            <Link href="/pricing" onClick={onClose} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-700 hover:underline underline-offset-2">
              Upgrade
            </Link>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", stats.tokenPct >= 90 ? "bg-red-400" : stats.tokenPct >= 70 ? "bg-amber-400" : "bg-primary")}
              style={{ width: `${stats.tokenPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10.5px] text-zinc-400">
            {stats.tokensUsed.toLocaleString()} / {stats.tokensLimit.toLocaleString()} credits
          </p>
        </div>
      </div>
    </>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const router = useRouter()
  const { user, userData, signOut } = useAuth()

  const isTeamsPlan = !!userData?.planId && planIdForDisplay(userData.planId) === "team"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [search, setSearch] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isTeamsPlan && scope === "team") setScope("user")
  }, [isTeamsPlan, scope])

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {}
    const token = await user.getIdToken()
    return { Authorization: `Bearer ${token}` }
  }, [user])

  const { projects, loading: projectsLoading, error: projectsError } = useProjectList({
    scope,
    uid: user?.uid ?? null,
    workspaceId: scope === "team" ? userData?.currentWorkspaceId || null : null,
    getAuthHeader,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => !q || (p.prompt || "").toLowerCase().includes(q))
  }, [projects, search])

  const grouped = useMemo(() => {
    const result: Record<"Today" | "Yesterday" | "Previous", ProjectSummary[]> = {
      Today: [], Yesterday: [], Previous: [],
    }
    for (const p of filtered) result[sectionLabel(toDate(p.createdAt))].push(p)
    return result
  }, [filtered])

  const stats = useMemo(() => {
    const total = projects.length
    const complete = projects.filter((p) => p.status === "complete").length
    const tokensUsed = userData?.tokenUsage?.used ?? 0
    const tokensLimit = Math.max(Number(userData?.tokensLimit ?? 0), tokensUsed + Math.max(0, userData?.tokenUsage?.remaining ?? 0))
    const tokenPct = tokensLimit > 0 ? Math.min(100, Math.round((tokensUsed / tokensLimit) * 100)) : 0
    const planName = userData?.planName || "Free"
    return { total, complete, tokensUsed, tokensLimit, tokenPct, planName }
  }, [projects, userData])

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, kind?: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await deleteDoc(doc(db, kind === "computer" ? "computerSessions" : "projects", projectId))
    } catch (err) {
      console.error(`Failed to delete ${kind || "project"}:`, err)
    }
  }

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 1).toUpperCase() ?? "U"

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const firstName = user?.displayName?.split(" ")[0] ?? ""

  const sidebarProps = { grouped, filtered, projectsLoading, search, stats, router, handleDeleteProject }

  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">

        {/* ── Mobile sidebar drawer ── */}
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-primary/30 backdrop-blur-sm transition-opacity lg:hidden",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
        {/* Drawer panel */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-muted shadow-xl transition-transform duration-300 ease-in-out lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent {...sidebarProps} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* ── Desktop sidebar (always visible ≥ lg) ── */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-muted lg:flex">
          <SidebarContent {...sidebarProps} />
        </aside>

        {/* ── Main panel ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-sm sm:px-5">
            {/* Left: hamburger (mobile) + logo (mobile) */}
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-zinc-600 transition-colors hover:bg-muted"
                aria-label="Open history"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <Link href="/" className="flex items-center gap-1.5">
                <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-6 w-6 object-contain" />
                <span className="text-[13.5px] font-semibold text-foreground">lotus.build</span>
              </Link>
            </div>

            {/* Search (desktop) */}
            <div className="relative hidden max-w-xs flex-1 lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search builds…"
                className="h-8 w-full rounded-lg border-border bg-white pl-9 text-sm placeholder:text-zinc-400 focus:bg-white"
              />
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {isTeamsPlan && (
                <div className="inline-flex items-center rounded-lg border border-border bg-white p-0.5">
                  <button type="button" onClick={() => setScope("user")} className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all", scope === "user" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground/80")}>Mine</button>
                  <button type="button" onClick={() => setScope("team")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all", scope === "team" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground/80")}><Users className="h-3 w-3" />Team</button>
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border bg-white shadow-sm transition-all hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f1f1f]">
                    <Avatar className="h-8 w-8 rounded-full">
                      <AvatarImage src={user?.photoURL ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-60 border-border bg-white shadow-lg">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-3 py-1">
                      <Avatar className="h-8 w-8 rounded-full border border-border">
                        <AvatarImage src={user?.photoURL ?? undefined} alt="" />
                        <AvatarFallback className="rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-foreground">{user?.displayName ?? "User"}</span>
                        <span className="truncate text-xs text-zinc-500">{user?.email ?? ""}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-100" />
                  <DropdownMenuItem className="cursor-pointer gap-2 text-zinc-700 focus:bg-zinc-50" onClick={() => router.push("/pricing")}>
                    <CreditCard className="h-4 w-4" />Billing &amp; Plans
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2 text-zinc-700 focus:bg-zinc-50" onClick={() => router.push("/settings")}>
                    <Settings className="h-4 w-4" />Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-zinc-100" />
                  <DropdownMenuItem className="cursor-pointer gap-2 text-red-500 focus:bg-red-50 focus:text-red-500" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Hero ── */}
            <section className="relative flex flex-col items-center overflow-hidden px-4 pb-10 pt-12 sm:pb-12 sm:pt-16">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(180,165,140,0.15),transparent_70%)]" />
              <div className="relative z-10 w-full max-w-2xl text-center">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </p>
                <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                  What do you want to build?
                </h1>
                <p className="mx-auto mt-2.5 max-w-sm text-sm text-zinc-500">
                  Describe your idea — lotus turns it into a working app in seconds.
                </p>
                <div className="mt-7">
                  <AnimatedAIInput />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {["Landing page", "SaaS dashboard", "Portfolio site", "Booking form", "Pricing page"].map((label) => (
                    <button key={label} type="button" className="rounded-full border border-border bg-white/80 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-white hover:text-foreground active:scale-95">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Mobile search ── */}
            <div className="px-4 pb-4 lg:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search builds…" className="h-9 w-full rounded-xl border-border bg-white pl-9 text-sm placeholder:text-zinc-400" />
              </div>
            </div>

            {/* ── Workspace ── */}
            <section className="border-t border-border px-4 py-7 sm:px-6">
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">Your workspace</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {projectsLoading ? "Loading…" : `${stats.total} build${stats.total !== 1 ? "s" : ""} · ${stats.complete} ready`}
                  </p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-foreground">{stats.tokenPct}%</p>
                    <p className="text-[10px] text-zinc-400">credits used</p>
                  </div>
                  <div className="h-8 w-px bg-muted" />
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-foreground">{stats.complete}</p>
                    <p className="text-[10px] text-zinc-400">live</p>
                  </div>
                </div>
              </div>

              {projectsError && (
                <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  Failed to load builds. {projectsError}
                </div>
              )}

              {projectsLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[116px] animate-pulse rounded-2xl border border-border bg-white/60" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/50 px-6 py-14 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white">
                    <FolderOpen className="h-5 w-5 text-zinc-300" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-600">{search ? "No builds match your search" : "Nothing here yet"}</p>
                  <p className="mt-1 text-xs text-zinc-400">Use the input above to create your first build.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(["Today", "Yesterday", "Previous"] as const).map((key) => {
                    if (grouped[key].length === 0) return null
                    return (
                      <div key={key}>
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{key}</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {grouped[key].map((p) => (
                            <div key={p.id} className="group/card relative flex flex-col rounded-2xl border border-border bg-white transition-all duration-150 hover:border-zinc-300 hover:shadow-sm">
                              <div className={cn("h-[3px] w-full rounded-t-2xl", statusAccent(p.status))} />
                              <button
                                type="button"
                                onClick={() => router.push(p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`)}
                                className="flex flex-1 flex-col px-4 pb-4 pt-3.5 text-left"
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                                    {p.kind === "computer" ? <Terminal className="h-3.5 w-3.5 text-zinc-500" /> : <AppWindow className="h-3.5 w-3.5 text-zinc-500" />}
                                  </div>
                                  <p className="line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-zinc-800">
                                    {projectTitle(p.prompt)}
                                  </p>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1", statusBadgeClass(p.status))}>
                                    {statusText(p.status)}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                                    <Clock className="h-3 w-3" />
                                    {formatRelative(p.updatedAt ?? p.createdAt)}
                                  </span>
                                </div>
                              </button>
                              {/* Actions: always visible on mobile, hover on desktop */}
                              <div className="absolute right-2.5 top-3.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/card:opacity-100">
                                <button type="button" onClick={() => router.push(p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-zinc-400 shadow-sm ring-1 ring-[#e4e2db] hover:text-zinc-700" aria-label="Open">
                                  <ArrowUpRight className="h-3 w-3" />
                                </button>
                                <button type="button" onClick={(e) => handleDeleteProject(e, p.id, p.kind)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-zinc-300 shadow-sm ring-1 ring-[#e4e2db] hover:bg-red-50 hover:text-red-400" aria-label="Delete">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Footer ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Zap className="h-3 w-3" />
                <span>{stats.tokensUsed.toLocaleString()} / {stats.tokensLimit.toLocaleString()} credits used</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <Link href="/pricing" className="transition-colors hover:text-zinc-700">Upgrade</Link>
                <Link href="/settings" className="transition-colors hover:text-zinc-700">Settings</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
