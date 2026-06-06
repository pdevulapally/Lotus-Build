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
  Gift
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
        className="flex w-full items-center rounded-xl px-4 py-[12px] text-left transition-all duration-150 hover:bg-white hover:shadow-sm"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-[1.4] text-zinc-800 font-medium">
            {projectTitle(p.prompt, 32)}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-[28px] w-[28px] items-center justify-center rounded-lg text-zinc-300 opacity-0 transition-all hover:text-red-400 hover:bg-red-50 group-hover/row:opacity-100"
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
  onNewBuild,
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
  onNewBuild: () => void
  isTeamsPlan: boolean
  scope: "user" | "team"
  setScope: (s: "user" | "team") => void
}) {
  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 1).toUpperCase() ?? "U"

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f4f3f0]">

      {/* ── Logo row — spacious ── */}
      <div className="flex h-[60px] shrink-0 items-center justify-between px-[18px]">
        <Link href="/" onClick={onClose} className="flex items-center gap-[7px]">
          <img
            src="/Images/lotus-official-logo.png"
            alt="lotus.build"
            className="h-7 w-7 object-contain"
          />
          <span className="text-[16px] font-semibold tracking-tight text-zinc-800">
            lotus.build
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-zinc-400 hover:bg-black/[0.06] hover:text-zinc-600"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-zinc-400 hover:bg-black/[0.06] hover:text-zinc-600"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-zinc-400 hover:bg-black/[0.06] hover:text-zinc-600"
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
          className="flex w-full items-center gap-[10px] rounded-xl border border-zinc-200 bg-white px-[14px] py-[11px] text-[14px] font-medium text-zinc-700 shadow-sm transition-all duration-150 hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-md active:scale-[0.98]"
        >
          <Pencil className="h-[16px] w-[16px] shrink-0 text-zinc-500" />
          New build
        </button>
      </div>

      {/* ── Team scope toggle — existing functionality, Manus style ── */}
      {isTeamsPlan && (
        <div className="px-[14px] pb-[10px]">
          <button
            type="button"
            onClick={() => setScope(scope === "user" ? "team" : "user")}
            className="flex w-full items-center gap-[10px] rounded-md px-[12px] py-[9px] text-[14px] text-zinc-600 transition-colors hover:bg-black/[0.04] hover:text-zinc-800"
          >
            <Users className="h-[16px] w-[16px] shrink-0 text-zinc-400" />
            {scope === "team" ? "My builds" : "Team"}
          </button>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-[14px] mb-[14px] h-px bg-zinc-200/70" />

      {/* ── Projects section header — Manus design: "Projects" + "+" button ── */}
      <div className="flex items-center justify-between px-[14px] pb-[8px]">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-zinc-400">
          Projects
        </span>
        <button
          type="button"
          onClick={() => { onClose?.(); onNewBuild() }}
          className="flex h-[22px] w-[22px] items-center justify-center rounded text-zinc-400 hover:bg-black/[0.06] hover:text-zinc-600"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── All tasks section header — Manus design: "All tasks" + filter icon ── */}
      <div className="flex items-center justify-between px-[14px] pb-[6px] pt-[6px]">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-zinc-400">
          All tasks
        </span>
        {isTeamsPlan && (
          <button
            type="button"
            onClick={() => setScope(scope === "user" ? "team" : "user")}
            className="flex h-[22px] w-[22px] items-center justify-center rounded text-zinc-400 hover:bg-black/[0.06] hover:text-zinc-600"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Task list — flat, modern, no sections ── */}
      <div className="flex-1 overflow-y-auto px-[10px] pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.12)_transparent]">
        {projectsLoading ? (
          <div className="space-y-[3px] pt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-[42px] animate-pulse rounded-md bg-black/[0.04]"
                style={{ opacity: 1 - i * 0.07 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-8 text-center text-[12px] text-zinc-400">
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

      {/* ── Share/Referral card — Manus design style, lotus.build content ── */}
      <div className="shrink-0 px-[14px] pb-[14px]">
        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="flex w-full items-center gap-[10px] rounded-lg border border-zinc-200/80 bg-white/50 px-[14px] py-[12px] text-left transition-colors hover:bg-white/80"
        >
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md bg-[#7a6244]/10">
            <Gift className="h-[14px] w-[14px] text-[#7a6244]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-tight text-zinc-700">
              Share lotus.build with a friend
            </p>
            <p className="mt-[1px] text-[12px] leading-tight text-zinc-400">
              Get 500 credits each
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
        </button>
      </div>

      {/* ── Bottom: user row — spacious, no icons ── */}
      <div className="shrink-0 border-t border-zinc-200/70 px-[14px] py-[14px]">
        <div className="flex items-center justify-between">
          {/* User info — avatar + name */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-[8px] rounded-md px-[6px] py-[4px] transition-colors hover:bg-black/[0.04]"
              >
                <Avatar className="h-[36px] w-[36px] shrink-0 rounded-[6px]">
                  <AvatarImage
                    src={user?.photoURL ?? undefined}
                    alt=""
                    className="rounded-[6px] object-cover"
                  />
                  <AvatarFallback className="rounded-[6px] bg-[#7a6244]/20 text-[9px] font-semibold text-[#7a6244]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[14px] font-medium leading-tight text-zinc-700">
                    {user?.displayName ?? "User"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={6}
              className="w-52 border-zinc-200 bg-white shadow-lg"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-zinc-700 focus:bg-zinc-50"
                onClick={() => router.push("/pricing")}
              >
                <CreditCard className="h-3.5 w-3.5" /> Billing &amp; Plans
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-zinc-700 focus:bg-zinc-50"
                onClick={() => router.push("/settings")}
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-100" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-red-500 focus:bg-red-50 focus:text-red-500"
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
export default function ProjectsPage() {
  const router = useRouter()
  const { user, userData, signOut } = useAuth()

  const isTeamsPlan =
    !!userData?.planId && planIdForDisplay(userData.planId) === "team"
  const [scope, setScope] = useState<"user" | "team">("user")
  const [search, setSearch] = useState("")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
    isTeamsPlan,
    scope,
    setScope,
  }

  return (
    <ProtectedRoute>
      <div className="flex h-[100dvh] overflow-hidden bg-white">

        {/* ── Mobile overlay ── */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 lg:hidden",
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
            "fixed inset-y-0 left-0 z-50 w-[320px] border-r border-zinc-200 shadow-xl transition-transform duration-200 ease-in-out lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar {...sidebarProps} onClose={() => setMobileSidebarOpen(false)} />
        </div>

        {/* ── Desktop sidebar — 320px ── */}
        <aside className="hidden w-[320px] shrink-0 border-r border-zinc-200/80 lg:flex lg:flex-col">
          <Sidebar {...sidebarProps} />
        </aside>

        {/* ── Main ── */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#faf9f6]">

          {/* Ambient background — warm gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#faf9f6] via-[#f5f3ef] to-[#f0ece4]" />

          {/* Ambient radial glow behind input */}
          <div className="pointer-events-none absolute left-1/2 top-[45%] h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7a6244] opacity-[0.03] blur-[120px]" />

          {/* Subtle floating shapes — brand tones */}
          <div className="pointer-events-none absolute left-[10%] top-[20%] h-[300px] w-[300px] rounded-full bg-[#7a6244] opacity-[0.02] blur-[100px]" />
          <div className="pointer-events-none absolute right-[15%] top-[60%] h-[250px] w-[250px] rounded-full bg-[#a08b6d] opacity-[0.025] blur-[80px]" />

          {/* Dot grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage: `radial-gradient(circle, #d4cfc7 0.5px, transparent 0.5px)`,
              backgroundSize: `24px 24px`,
            }}
          />

          {/* Mobile top bar */}
          <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-zinc-100 px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
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
              <span className="text-[15px] font-semibold text-zinc-800">
                lotus.build
              </span>
            </Link>
          </div>

          {/* ── Hero: vertically centered, nothing else ── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[10vh] pt-4">
            <div className="w-full max-w-[620px]">

              {/* Plan badge — like Manus's "Free plan | Start free trial" */}
              <div className="mb-5 flex items-center justify-center gap-2">
                <span className="rounded-full border border-zinc-200 px-3 py-[3px] text-[12px] text-zinc-500">
                  {stats.planName} plan
                </span>
                <span className="text-zinc-300">·</span>
                <Link
                  href="/pricing"
                  className="text-[12px] text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
                >
                  Upgrade
                </Link>
              </div>

              {/* Greeting */}
              <div className="mb-6 text-center">
                <h1 className="text-[2.15rem] font-semibold tracking-[-0.025em] text-zinc-900 sm:text-[2.5rem]">
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </h1>
              </div>

              {/* ── Input card ── Manus has a tall textarea with bottom toolbar */}
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06),0_4px_24px_rgba(0,0,0,0.04)]">
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
                    className="rounded-full border border-zinc-200 bg-transparent px-[12px] py-[5px] text-[12px] text-zinc-500 transition-all duration-100 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}