"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Pencil,
  PanelLeft,
  Gift,
  Copy,
  Check,
  Share2,
  Sparkles,
  ChevronDown,
} from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
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
  "h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted focus:text-foreground"

function projectTitle(prompt: string, max = 42): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const PROJECT_STATUS_META: Record<ProjectStatus, { dot: string; label: string }> = {
  pending: { dot: "bg-slate-soft-foreground/45", label: "Draft" },
  generating: { dot: "animate-pulse bg-accent", label: "Building" },
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
          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 pr-9 text-left",
          "transition-colors hover:bg-muted"
        )}
      >
        {/* status pip */}
        <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)} />
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search builds…"
        className={cn(
          "h-9 w-full rounded-xl border border-border/50 bg-background pl-8 pr-8",
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

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

function Sidebar({
  filtered,
  projectsLoading,
  search,
  onSearchChange,
  stats,
  router,
  handleDeleteProject,
  user,
  signOut,
  onClose,
  onToggle,
  onNewBuild,
  onShare,
  isTeamsPlan,
  scope,
  setScope,
}: {
  filtered: ProjectSummary[]
  projectsLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  stats: { planName: string }
  router: ReturnType<typeof useRouter>
  handleDeleteProject: (e: React.MouseEvent, id: string, kind?: string) => void
  user: any
  signOut: () => void
  onClose?: () => void
  onToggle?: () => void
  onNewBuild: () => void
  onShare: () => void
  isTeamsPlan: boolean
  scope: "user" | "team"
  setScope: (s: "user" | "team") => void
}) {
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 1).toUpperCase() ?? "U"

  return (
    <div className="flex h-full flex-col bg-sidebar">

      {/* ── Logo row ── */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Link href="/" onClick={onClose} className="flex items-center gap-2">
          <img
            src="/Images/lotus-official-logo.png"
            alt="lotus.build"
            className="h-7 w-7 object-contain"
          />
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
              className={cn(sidebarActionClass, "h-8 w-8")}
            >
              <PanelLeft className="h-3.5 w-3.5" />
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

      {/* ── New build button ── */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => { onClose?.(); onNewBuild() }}
          className={cn(
            "flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-background px-3",
            "text-[13px] font-semibold text-foreground",
            "transition-colors hover:bg-muted",
            "active:scale-[0.985]"
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-soft-foreground">
            <Pencil className="h-3 w-3" />
          </span>
          <span>New build</span>
        </button>
      </div>

      {/* ── Team / personal scope toggle ── */}
      {isTeamsPlan && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
            {(["user", "team"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  scope === id
                    ? "bg-card text-foreground shadow-sm"
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
          {scope === "team" ? "Team builds" : "Your builds"}
        </span>
        <span className="text-[11px] text-muted-foreground">{filtered.length}</span>
      </div>

      {/* ── Search ── */}
      <SearchBar value={search} onChange={onSearchChange} />

      {/* ── Task list ── */}
      <div className="flex-1 overflow-y-auto pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
        {projectsLoading ? (
          <div className="space-y-2 px-3 pt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-muted"
                style={{ opacity: 1 - i * 0.09 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-3 rounded-2xl border border-border bg-muted/35 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-foreground">
              {search ? "No matching builds" : "No builds yet"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {search ? "Try a different search." : "Start with a prompt and your builds will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {filtered.map((p) => (
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
          </div>
        )}
      </div>

      {/* ── Referral card ── */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={onShare}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-2xl border border-border bg-muted/35 px-3 py-3",
            "text-left transition-colors hover:bg-muted"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
            <Gift className="h-3.5 w-3.5 text-accent-soft-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground">Invite a friend</p>
            <p className="truncate text-[11px] text-muted-foreground">You both get 500 credits</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── User row ── */}
      <div className="shrink-0 border-t border-border/50 px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-2xl px-2 py-2",
                "transition-colors hover:bg-muted"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                <AvatarImage
                  src={user?.photoURL ?? undefined}
                  alt=""
                  className="rounded-lg object-cover"
                />
                <AvatarFallback className="rounded-lg bg-accent-soft text-[10px] font-semibold text-accent-soft-foreground">
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
            className="w-[calc(100vw-2rem)] max-w-[16rem] rounded-2xl border-border bg-card p-2 shadow-[0_24px_80px_-44px_var(--primary)]"
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite a friend"
        className="relative z-10 w-full max-w-[400px] rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
          <Gift className="h-4.5 w-4.5 text-accent-soft-foreground" />
        </div>

        <h2 className="mt-3.5 text-[16px] font-semibold tracking-tight text-foreground">
          Invite friends, earn credits
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          When a friend subscribes to a paid plan, you both get{" "}
          <span className="font-medium text-foreground">500 credits</span> added to your monthly allowance.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/60 bg-muted/50 px-3 py-3">
            <p className="text-[22px] font-semibold leading-none text-foreground">{referralCount}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Friend{referralCount === 1 ? "" : "s"} joined
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/50 px-3 py-3">
            <p className="flex items-center gap-1 text-[22px] font-semibold leading-none text-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              {creditsEarned.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Credits earned</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Your link
          </p>
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
              <span className="truncate text-[12px] text-foreground/70">
                {link || "Sign in to generate your link"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              className={cn(
                "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold",
                "transition-all active:scale-[0.97] disabled:opacity-50",
                copied
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-foreground text-background hover:bg-foreground/90"
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
              "mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl",
              "border border-border/60 bg-transparent px-4 py-2.5",
              "text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
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

export default function ProjectsPage() {
  const router = useRouter()
  const { user, userData, signOut } = useAuth()

  const isTeamsPlan = !!userData?.planId && planIdForDisplay(userData.planId) === "team"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [search, setSearch] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)

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

  const handleNewBuild = () => {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>("[data-animated-ai-input]")
      el?.focus()
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 150)
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const firstName = user?.displayName?.split(" ")[0] ?? ""

  const sidebarProps = {
    filtered,
    projectsLoading,
    search,
    onSearchChange: setSearch,
    stats,
    router,
    handleDeleteProject,
    user,
    signOut,
    onNewBuild: handleNewBuild,
    onShare: () => { setMobileSidebarOpen(false); setReferralOpen(true) },
    isTeamsPlan,
    scope,
    setScope,
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
            "border-r border-border/60 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.12)]",
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
          <div className="h-full border-r border-border/60">
            <Sidebar {...sidebarProps} onToggle={() => setDesktopSidebarCollapsed(true)} />
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">

          {/* ── Mobile top bar ── */}
          <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-background/90 px-4 backdrop-blur-sm lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              className={cn(sidebarActionClass, "h-9 w-9")}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <img src="/Images/lotus-official-logo.png" alt="lotus.build" className="h-6 w-6 object-contain" />
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
                "h-9 w-9 items-center justify-center rounded-xl",
                "border border-border/50 bg-background text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground"
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          {/* ── Composer surface ── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-[10vh] pt-8 sm:px-8">
            <div className="w-full max-w-[44rem]">

              {/* Plan pill */}
              <div className="mb-8 flex justify-center">
                <div className="inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-background px-3.5 py-1.5 text-[12px] text-muted-foreground shadow-sm">
                  <span className="font-medium">{stats.planName} plan</span>
                  <span className="h-3 w-px bg-border/60" />
                  <Link href="/pricing" className="font-semibold text-accent transition-colors hover:text-accent/80">
                    Upgrade
                  </Link>
                </div>
              </div>

              {/* Greeting */}
              <div className="mb-8 text-center">
                <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.6rem]">
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </h1>
                <p className="mx-auto mt-3 max-w-[30rem] text-[13.5px] leading-relaxed text-muted-foreground">
                  Describe what you want to build. Lotus will create a focused workspace from your brief.
                </p>
              </div>

              <AnimatedAIInput />
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
      </div>
    </ProtectedRoute>
  )
}