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
  Plus,
  X,
  ChevronRight,
  Monitor,
  Pencil,
  PanelLeft,
  SlidersHorizontal,
  Gift,
  Copy,
  Check,
  Share2,
  Sparkles
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

// Date helpers removed for clean modern look

// Section labels removed for clean modern look

function projectTitle(prompt: string, max = 48): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}

// Dates removed for clean modern look

// Status dots removed for clean modern look

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar task row — Clean, no icons, spacious
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({
  p,
  onNavigate,
  onDelete,
}: {
  p: ProjectSummary
  onNavigate: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={onNavigate}
        className="flex w-full items-center rounded-lg px-3 py-[7px] pr-9 text-left transition-all duration-150 hover:bg-card hover:shadow-sm"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-[1.45] text-foreground/90">
            {projectTitle(p.prompt, 32)}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg text-muted-foreground/45 opacity-0 transition-all hover:text-destructive hover:bg-destructive/10 group-hover/row:opacity-100"
      >
        <Trash2 className="h-[11px] w-[11px]" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — Manus AI Design with lotus.build Content
// ─────────────────────────────────────────────────────────────────────────────
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
  stats: { planName: string; tokenPct: number; tokensUsed: number; tokensLimit: number }
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
    <div className="flex h-full flex-col overflow-hidden bg-muted">

      {/* ── Logo row — spacious ── */}
      <div className="flex h-[60px] shrink-0 items-center justify-between px-[18px]">
        <Link href="/" onClick={onClose} className="flex items-center gap-[7px]">
          <img
            src="/Images/lotus-official-logo.png"
            alt="lotus.build"
            className="h-7 w-7 object-contain"
          />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">
            lotus.build
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted-foreground hover:bg-surface-inset hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted-foreground hover:bg-surface-inset hover:text-foreground"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-muted-foreground hover:bg-surface-inset hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Modern New Build — prominent button ── */}
      <div className="px-[14px] pb-[10px]">
        <button
          type="button"
          onClick={() => { onClose?.(); onNewBuild() }}
          className="flex w-full items-center gap-[9px] rounded-xl border border-border bg-card px-[12px] py-[9px] text-[13px] font-medium text-foreground shadow-sm transition-all duration-150 hover:bg-surface-raised hover:border-border-strong hover:shadow-md active:scale-[0.98]"
        >
          <Pencil className="h-[14px] w-[14px] shrink-0 text-accent" />
          New build
        </button>
      </div>

      {/* ── Team scope toggle — existing functionality, Manus style ── */}
      {isTeamsPlan && (
        <div className="px-[14px] pb-[10px]">
          <button
            type="button"
            onClick={() => setScope(scope === "user" ? "team" : "user")}
            className="flex w-full items-center gap-[10px] rounded-md px-[12px] py-[9px] text-[14px] text-muted-foreground transition-colors hover:bg-surface-inset hover:text-foreground"
          >
            <Users className="h-[16px] w-[16px] shrink-0 text-muted-foreground" />
            {scope === "team" ? "My builds" : "Team"}
          </button>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-[14px] mb-[14px] h-px bg-border/70" />

      {/* ── Projects section header — Manus design: "Projects" + "+" button ── */}
      <div className="flex items-center justify-between px-[14px] pb-[8px]">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Projects
        </span>
        <button
          type="button"
          onClick={() => { onClose?.(); onNewBuild() }}
          className="flex h-[22px] w-[22px] items-center justify-center rounded text-muted-foreground hover:bg-surface-inset hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── All tasks section header — Manus design: "All tasks" + filter icon ── */}
      <div className="flex items-center justify-between px-[14px] pb-[6px] pt-[6px]">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          All tasks
        </span>
        {isTeamsPlan && (
          <button
            type="button"
            onClick={() => setScope(scope === "user" ? "team" : "user")}
            className="flex h-[22px] w-[22px] items-center justify-center rounded text-muted-foreground hover:bg-surface-inset hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Task list — flat, modern, no sections ── */}
      <div className="flex-1 overflow-y-auto px-[10px] pb-4 [scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent]">
        {projectsLoading ? (
          <div className="space-y-[3px] pt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-[42px] animate-pulse rounded-md bg-surface-inset"
                style={{ opacity: 1 - i * 0.07 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">
            {search ? "No results found" : "No builds yet"}
          </div>
        ) : (
          filtered.map((p) => (
            <TaskRow
              key={p.id}
              p={p}
              onNavigate={() => {
                onClose?.()
                router.push(
                  p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`
                )
              }}
              onDelete={(e) => handleDeleteProject(e, p.id, p.kind)}
            />
          ))
        )}
      </div>

      {/* ── Share/Referral card ── */}
      <div className="shrink-0 px-[12px] pb-[12px]">
        <button
          type="button"
          onClick={onShare}
          className="group flex w-full items-center gap-[10px] rounded-xl border border-border bg-card/60 px-[12px] py-[10px] text-left transition-colors hover:border-border-strong hover:bg-card"
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <Gift className="h-[13px] w-[13px] text-accent-soft-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium leading-tight text-foreground">
              Invite a friend
            </p>
            <p className="mt-[1px] truncate text-[11.5px] leading-tight text-muted-foreground">
              You both get 500 credits
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── Bottom: user row — spacious, no icons ── */}
      <div className="shrink-0 border-t border-border/70 px-[14px] py-[14px]">
        <div className="flex items-center justify-between">
          {/* User info — avatar + name */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-[8px] rounded-md px-[6px] py-[4px] transition-colors hover:bg-surface-inset"
              >
                <Avatar className="h-[36px] w-[36px] shrink-0 rounded-[6px]">
                  <AvatarImage
                    src={user?.photoURL ?? undefined}
                    alt=""
                    className="rounded-[6px] object-cover"
                  />
                  <AvatarFallback className="rounded-[6px] bg-accent-soft text-[9px] font-semibold text-accent-soft-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[14px] font-medium leading-tight text-foreground">
                    {user?.displayName ?? "User"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={6}
              className="w-52 border-border bg-popover shadow-lg"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-foreground focus:bg-muted"
                onClick={() => router.push("/pricing")}
              >
                <CreditCard className="h-3.5 w-3.5" /> Billing &amp; Plans
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-foreground focus:bg-muted"
                onClick={() => router.push("/settings")}
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => signOut()}
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Right side — empty, no icons */}
          <div />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
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
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://lotus.build"
    return `${origin}/pricing?ref=${encodeURIComponent(referralCode)}`
  }, [referralCode])

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    )
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — surface the link for manual copy.
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
    } catch {
      // User dismissed the share sheet — no-op.
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-primary/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite a friend"
        className="relative z-10 w-full max-w-[420px] rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
          <Gift className="h-5 w-5 text-accent-soft-foreground" />
        </div>

        <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">
          Invite friends, earn credits
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Share your link. When a friend subscribes to a paid plan, you{"\u2019"}ll{" "}
          <span className="font-medium text-foreground">both get 500 credits</span>{" "}
          added to your monthly allowance.
        </p>

        {/* Live stats */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-surface-inset/60 px-3.5 py-3">
            <p className="text-[20px] font-semibold leading-none text-foreground">
              {referralCount}
            </p>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              Friend{referralCount === 1 ? "" : "s"} subscribed
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-inset/60 px-3.5 py-3">
            <p className="flex items-center gap-1 text-[20px] font-semibold leading-none text-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              {creditsEarned.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">Credits earned</p>
          </div>
        </div>

        {/* Link + copy */}
        <div className="mt-4">
          <label className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Your referral link
          </label>
          <div className="flex items-stretch gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-surface-inset/60 px-3">
              <span className="truncate text-[12.5px] text-foreground/80">
                {link || "Sign in to generate your link"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50",
                copied
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-accent text-accent-foreground hover:bg-accent/90"
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
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            Share link
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const { user, userData, signOut } = useAuth()

  const isTeamsPlan =
    !!userData?.planId && planIdForDisplay(userData.planId) === "team"
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
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileSidebarOpen])

  const getAuthHeader = useCallback(
    async (): Promise<Record<string, string>> => {
      if (!user) return {}
      const token = await user.getIdToken()
      return { Authorization: `Bearer ${token}` }
    },
    [user]
  )

  const { projects, loading: projectsLoading } = useProjectList({
    scope,
    uid: user?.uid ?? null,
    workspaceId:
      scope === "team" ? userData?.currentWorkspaceId || null : null,
    getAuthHeader,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(
      (p) => !q || (p.prompt || "").toLowerCase().includes(q)
    )
  }, [projects, search])

  // grouped removed - flat list

  const stats = useMemo(() => {
    const tokensUsed = userData?.tokenUsage?.used ?? 0
    const tokensLimit = Math.max(
      Number(userData?.tokensLimit ?? 0),
      tokensUsed + Math.max(0, userData?.tokenUsage?.remaining ?? 0)
    )
    const tokenPct =
      tokensLimit > 0
        ? Math.min(100, Math.round((tokensUsed / tokensLimit) * 100))
        : 0
    const planName = userData?.planName || "Free"
    return { tokensUsed, tokensLimit, tokenPct, planName }
  }, [userData])

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string,
    kind?: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await deleteDoc(
        doc(
          db,
          kind === "computer" ? "computerSessions" : "projects",
          projectId
        )
      )
    } catch (err) {
      console.error(`Failed to delete ${kind || "project"}:`, err)
    }
  }

  const handleNewBuild = () => {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        "[data-animated-ai-input]"
      )
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
            "fixed inset-0 z-40 bg-primary/20 transition-opacity duration-200 lg:hidden",
            mobileSidebarOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />

        {/* ── Mobile drawer — 320px ── */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[320px] border-r border-border shadow-xl transition-transform duration-200 ease-in-out lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar
            {...sidebarProps}
            onClose={() => setMobileSidebarOpen(false)}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* ── Desktop sidebar — 320px, collapsible ── */}
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden border-border/80 transition-[width] duration-200 ease-in-out lg:flex lg:flex-col",
            desktopSidebarCollapsed ? "lg:w-0 lg:border-r-0" : "lg:w-[320px] lg:border-r"
          )}
        >
          <div className="h-full w-[320px]">
            <Sidebar {...sidebarProps} onToggle={() => setDesktopSidebarCollapsed(true)} />
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">

          {/* Ambient background — warm gradient */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--background),var(--muted),var(--surface-inset))]" />

          {/* Ambient radial glow behind input */}
          <div className="pointer-events-none absolute left-1/2 top-[45%] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-glow opacity-[0.06] blur-[120px]" />

          {/* Subtle floating shapes — brand tones */}
          <div className="pointer-events-none absolute left-[10%] top-[20%] h-[300px] w-[300px] rounded-full bg-accent opacity-[0.035] blur-[100px]" />
          <div className="pointer-events-none absolute right-[15%] top-[60%] h-[250px] w-[250px] rounded-full bg-primary opacity-[0.035] blur-[80px]" />

          {/* Dot grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage: `radial-gradient(circle, var(--border) 0.5px, transparent 0.5px)`,
              backgroundSize: `24px 24px`,
            }}
          />

          {/* Desktop: expand sidebar when collapsed */}
          {desktopSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed(false)}
              aria-label="Show sidebar"
              className="absolute left-4 top-4 z-20 hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground lg:flex"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          {/* Mobile top bar */}
          <div className="relative z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Open sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <Link href="/" className="flex items-center gap-[7px]">
              <img
                src="/Images/lotus-official-logo.png"
                alt="lotus.build"
                className="h-7 w-7 object-contain"
              />
              <span className="text-[15px] font-semibold text-foreground">
                lotus.build
              </span>
            </Link>
          </div>

          {/* ── Hero: vertically centered, nothing else ── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[10vh] pt-4">
            <div className="w-full max-w-[620px]">

              {/* Plan badge — like Manus's "Free plan | Start free trial" */}
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="rounded-full border border-border px-3 py-[3px] text-[12px] text-muted-foreground">
                  {stats.planName} plan
                </span>
                <span className="text-border-strong">·</span>
                <Link
                  href="/pricing"
                  className="text-[12px] text-accent underline-offset-2 hover:text-accent-soft-foreground hover:underline"
                >
                  Upgrade
                </Link>
              </div>

              {/* Greeting */}
              <div className="mb-6 text-center">
                <h1 className="text-[2.15rem] font-semibold tracking-[-0.025em] text-foreground sm:text-[2.5rem]">
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </h1>
              </div>

              {/* ── Input card ── Manus has a tall textarea with bottom toolbar */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_6px_var(--border),0_4px_24px_-18px_var(--primary)]">
                <AnimatedAIInput />
              </div>

              {/* Quick-prompt chips */}
              <div className="mt-[14px] flex flex-wrap items-center justify-center gap-[7px]">
                {[
                  "Landing page",
                  "SaaS dashboard",
                  "Portfolio",
                  "Booking form",
                  "Pricing page",
                  "Blog",
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-full border border-border bg-transparent px-[12px] py-[5px] text-[12px] text-muted-foreground transition-all duration-100 hover:border-border-strong hover:bg-muted hover:text-foreground active:scale-[0.97]"
                  >
                    {label}
                  </button>
                ))}
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
      </div>
    </ProtectedRoute>
  )
}