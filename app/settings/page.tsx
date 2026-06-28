"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore"
import { deleteUser } from "firebase/auth"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/firebase"
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Trash2,
  XCircle,
} from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { getAgentRunLimitForPlan } from "@/lib/agent-quotas"

type ProjectStatus = "pending" | "generating" | "complete" | "error"
type SettingsPageKey = "account" | "billing" | "usage" | "projects" | "memory"

type StripeInvoice = {
  id: string
  number: string | null
  date: number
  periodStart: number
  periodEnd: number
  amount: number
  currency: string
  status: string | null
  pdfUrl: string | null
  hostedUrl: string | null
  description: string | null
}

const SETTINGS_PAGES: Array<{ key: SettingsPageKey; label: string; description: string }> = [
  { key: "account", label: "Account", description: "Profile, workspace, security" },
  { key: "billing", label: "Billing", description: "Plan, payment, invoices" },
  { key: "usage", label: "Usage", description: "Credits and agent runs" },
  { key: "projects", label: "Projects", description: "Build history and health" },
  { key: "memory", label: "Memory", description: "Agent context controls" },
]

type ProjectAnalyticsItem = {
  id: string
  prompt: string
  model?: string
  status: ProjectStatus
  createdAt?: any
  updatedAt?: any
  projectMemory?: string
}

type ContributionActivityItem = {
  createdAt?: any
  updatedAt?: any
  activityDates?: any[]
}

type ContributionDay = {
  date: Date
  key: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isPadding?: boolean
}

type ContributionWeek = ContributionDay[]

function toDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === "function") return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function statusDot(status: ProjectStatus) {
  if (status === "complete") return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
  if (status === "generating") return <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
  if (status === "error") return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/35" />
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getContributionLevel(count: number, max: number): ContributionDay["level"] {
  if (count <= 0 || max <= 0) return 0
  const ratio = count / max
  if (ratio >= 0.8) return 4
  if (ratio >= 0.55) return 3
  if (ratio >= 0.3) return 2
  return 1
}

function buildContributionCalendar(items: ContributionActivityItem[]) {
  const today = startOfLocalDay(new Date())
  const firstDay = addDays(today, -364)
  const firstGridDay = addDays(firstDay, -firstDay.getDay())
  const lastGridDay = addDays(today, 6 - today.getDay())
  const counts = new Map<string, number>()

  items.forEach((item) => {
    const itemDates = [item.createdAt, item.updatedAt, ...(item.activityDates || [])]
    const validDates = itemDates.map(toDate).filter((date): date is Date => {
      if (!date) return false
      const day = startOfLocalDay(date)
      return day >= firstDay && day <= today
    })
    validDates.forEach((date) => {
      const key = dateKey(startOfLocalDay(date))
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })

  const max = Math.max(0, ...Array.from(counts.values()))
  const weeks: ContributionWeek[] = []
  let cursor = firstGridDay

  while (cursor <= lastGridDay) {
    const week: ContributionWeek = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(cursor)
      const key = dateKey(day)
      const count = counts.get(key) || 0
      const isPadding = day < firstDay || day > today
      week.push({ date: day, key, count: isPadding ? 0 : count, level: isPadding ? 0 : getContributionLevel(count, max), isPadding })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
  return { weeks, total }
}

function getContributionColor(level: ContributionDay["level"], isPadding?: boolean) {
  if (isPadding) return "bg-transparent border-transparent"
  if (level === 0) return "bg-muted/70 border-border"
  if (level === 1) return "bg-primary/15 border-primary/20"
  if (level === 2) return "bg-primary/30 border-primary/35"
  if (level === 3) return "bg-primary/55 border-primary/60"
  return "bg-primary border-primary"
}

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24 py-8 first:pt-0">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-sm shadow-foreground/[0.03]">
        {children}
      </div>
    </section>
  )
}

function SettingsRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-border/80 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(170px,0.72fr)_minmax(0,1fr)] sm:items-center sm:px-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  )
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="w-full rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-sm text-foreground shadow-inner sm:w-80">
      <span className="block truncate">{value}</span>
    </div>
  )
}

function ProgressMeter({ value, tone = "primary" }: { value: number; tone?: "primary" | "warning" | "danger" }) {
  const color = tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-muted-foreground" : "bg-primary"
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function Metric({ label, value, helper }: { label: string; value: ReactNode; helper?: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}

function ContributionCalendar({ items, loading }: { items: ContributionActivityItem[]; loading: boolean }) {
  const { weeks, total } = useMemo(() => buildContributionCalendar(items), [items])
  const monthLabels = useMemo(() => {
    return weeks.reduce<Array<{ label: string; index: number }>>((labels, week, index) => {
      const firstRealDay = week.find((day) => !day.isPadding)
      if (!firstRealDay) return labels
      const label = firstRealDay.date.toLocaleDateString(undefined, { month: "short" })
      if (labels[labels.length - 1]?.label !== label) labels.push({ label, index })
      return labels
    }, [])
  }, [weeks])

  return (
    <section className="rounded-xl border border-border/80 bg-card/70 p-4 shadow-sm shadow-foreground/[0.03] sm:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {loading ? "Loading activity" : `${total.toLocaleString()} workspace contribution${total === 1 ? "" : "s"}`}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Project builds, edits, and computer-agent activity across the last year.</p>
        </div>
        <Link href="/projects" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          View projects
        </Link>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
        <div className="min-w-[720px]">
          <div className="relative mb-1 ml-8 h-5">
            {monthLabels.map(({ label, index }) => (
              <span key={`${label}-${index}`} className="absolute text-[11px] text-muted-foreground" style={{ left: `${index * 16}px` }}>
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="grid h-[104px] grid-rows-7 gap-1 pt-[16px] text-[11px] text-muted-foreground">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      className={`h-3 w-3 rounded-[3px] border transition-transform hover:scale-125 ${getContributionColor(day.level, day.isPadding)}`}
                      title={day.isPadding ? undefined : `${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Live project activity</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className={`h-3 w-3 rounded-[3px] border ${getContributionColor(level as ContributionDay["level"])}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SettingsContent() {
  const router = useRouter()
  const { user, userData, currentWorkspace, workspaces, loading, signOut } = useAuth()
  const [projectsData, setProjectsData] = useState<ProjectAnalyticsItem[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [computerActivityData, setComputerActivityData] = useState<ContributionActivityItem[]>([])
  const [computerActivityLoading, setComputerActivityLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [activePage, setActivePage] = useState<SettingsPageKey>("account")
  const [portalLoading, setPortalLoading] = useState(false)
  const [invoices, setInvoices] = useState<StripeInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const invoicesFetched = useRef(false)
  const [globalMemoryDraft, setGlobalMemoryDraft] = useState("")
  const [globalMemoryLoading, setGlobalMemoryLoading] = useState(false)
  const [globalMemorySaving, setGlobalMemorySaving] = useState(false)
  const [globalMemorySaved, setGlobalMemorySaved] = useState(false)
  const [projectMemoryDrafts, setProjectMemoryDrafts] = useState<Record<string, string>>({})
  const [projectMemorySaving, setProjectMemorySaving] = useState<Record<string, boolean>>({})
  const [projectMemorySaved, setProjectMemorySaved] = useState<Record<string, boolean>>({})
  const globalMemoryFetched = useRef(false)

  useEffect(() => {
    if (!user?.uid) {
      setProjectsData([])
      setProjectsLoading(false)
      return
    }
    setProjectsLoading(true)
    const q = query(collection(db, "projects"), where("ownerId", "==", user.uid))
    const unsub = onSnapshot(q, (snap) => {
      const next: ProjectAnalyticsItem[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        next.push({
          id: d.id,
          prompt: data.prompt || "",
          model: data.model || "GPT-5.5",
          status: (data.status as ProjectStatus) || "pending",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          projectMemory: data.projectMemory || "",
        })
      })
      next.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
      setProjectsData(next)
      setProjectsLoading(false)
    }, (err) => {
      console.error("Settings analytics error:", err)
      setProjectsLoading(false)
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) {
      setComputerActivityData([])
      setComputerActivityLoading(false)
      return
    }
    setComputerActivityLoading(true)
    const q = query(collection(db, "computerSessions"), where("ownerId", "==", user.uid))
    const unsub = onSnapshot(q, (snap) => {
      const next: ContributionActivityItem[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        const timelineDates = Array.isArray(data.timeline) ? data.timeline.map((event: any) => event?.createdAt).filter(Boolean) : []
        next.push({ createdAt: data.createdAt, updatedAt: data.updatedAt, activityDates: timelineDates })
      })
      setComputerActivityData(next)
      setComputerActivityLoading(false)
    }, (err) => {
      console.error("Settings computer activity error:", err)
      setComputerActivityLoading(false)
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    const planId = userData?.planId
    const hasPaidPlan = planId && planId !== "free"
    if (activePage !== "billing" || invoicesFetched.current || !user || !hasPaidPlan) return
    let mounted = true
    setInvoicesLoading(true)
    user.getIdToken().then((token) =>
      fetch("/api/stripe/invoices", { headers: { Authorization: `Bearer ${token}` } })
    ).then((r) => r.json()).then((data) => {
      if (!mounted) return
      setInvoices(data.invoices ?? [])
      invoicesFetched.current = true
    }).catch(() => {
      if (mounted) invoicesFetched.current = true
    }).finally(() => { if (mounted) setInvoicesLoading(false) })
    return () => { mounted = false }
  }, [activePage, user, userData?.planId])

  useEffect(() => {
    if (activePage !== "memory" || !user?.uid || globalMemoryFetched.current) return
    let mounted = true
    setGlobalMemoryLoading(true)
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!mounted) return
      setGlobalMemoryDraft((snap.data()?.globalMemory as string | undefined) || "")
      globalMemoryFetched.current = true
    }).catch((err) => {
      console.error("Failed to load global memory:", err)
    }).finally(() => { if (mounted) setGlobalMemoryLoading(false) })
    return () => { mounted = false }
  }, [activePage, user?.uid])

  useEffect(() => {
    if (activePage !== "memory") return
    setProjectMemoryDrafts((prev) => {
      const next: Record<string, string> = { ...prev }
      projectsData.forEach((p) => {
        if (!(p.id in next)) next[p.id] = p.projectMemory || ""
      })
      return next
    })
  }, [activePage, projectsData])

  const analytics = useMemo(() => {
    const total = projectsData.length
    const complete = projectsData.filter((p) => p.status === "complete").length
    const generating = projectsData.filter((p) => p.status === "generating").length
    const error = projectsData.filter((p) => p.status === "error").length
    const now = new Date()
    const monthProjects = projectsData.filter((p) => {
      const d = toDate(p.createdAt)
      return !!d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekProjects = projectsData.filter((p) => {
      const d = toDate(p.createdAt)
      return !!d && d >= weekAgo
    }).length
    return {
      total,
      complete,
      generating,
      error,
      monthProjects,
      weekProjects,
      successRate: total > 0 ? Math.round((complete / total) * 100) : 0,
      recentProjects: projectsData.slice(0, 6),
    }
  }, [projectsData])

  const contributionItems = useMemo<ContributionActivityItem[]>(() => [...projectsData, ...computerActivityData], [computerActivityData, projectsData])

  if (loading || !user || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const remainingClamped = Math.max(0, userData.tokenUsage?.remaining ?? 0)
  const usedCredits = Math.max(0, Number(userData.tokenUsage?.used ?? 0))
  const tokensLimit = Math.max(Number(userData.tokensLimit ?? 0), usedCredits + remainingClamped)
  const tokenPct = tokensLimit > 0 ? Math.min(100, Math.round((usedCredits / tokensLimit) * 100)) : 0
  const periodEnd = userData.tokenUsage?.periodEnd ? new Date(userData.tokenUsage.periodEnd) : null
  const periodStart = userData.tokenUsage?.periodStart ? new Date(userData.tokenUsage.periodStart) : null
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : 0
  const cycleDays = periodStart && periodEnd ? Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000)) : 30
  const dailyAvg = Math.max(0, Math.round(usedCredits / cycleDays))
  const agentRunLimit = getAgentRunLimitForPlan(userData.planId, userData.agentRunLimit)
  const agentUsed = Math.max(0, Number(userData.agentUsage?.used ?? 0))
  const agentRemaining = Math.max(0, Number.isFinite(Number(userData.agentUsage?.remaining)) ? Number(userData.agentUsage?.remaining) : agentRunLimit - agentUsed)
  const agentPct = agentRunLimit > 0 ? Math.min(100, Math.round((agentUsed / agentRunLimit) * 100)) : 0
  const createdAt = userData.createdAt ? new Date(userData.createdAt) : null
  const isFreePlan = !userData.planId || userData.planId === "free"
  const activePageMeta = SETTINGS_PAGES.find((page) => page.key === activePage) ?? SETTINGS_PAGES[0]

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    if (email) return email[0].toUpperCase()
    return "U"
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== userData.email) return
    setDeleteLoading(true)
    setDeleteError("")
    try {
      await deleteDoc(doc(db, "users", user.uid))
      await deleteUser(user)
      router.push("/")
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        setDeleteError("For security, please sign out and sign back in before deleting your account.")
      } else {
        setDeleteError("Failed to delete account. Please try again or contact support.")
      }
      setDeleteLoading(false)
    }
  }

  const handleSaveGlobalMemory = async () => {
    if (!user?.uid || globalMemorySaving) return
    setGlobalMemorySaving(true)
    setGlobalMemorySaved(false)
    try {
      await updateDoc(doc(db, "users", user.uid), { globalMemory: globalMemoryDraft })
      setGlobalMemorySaved(true)
      setTimeout(() => setGlobalMemorySaved(false), 2500)
    } catch (err) {
      console.error("Failed to save global memory:", err)
    } finally {
      setGlobalMemorySaving(false)
    }
  }

  const handleSaveProjectMemory = async (projectId: string) => {
    if (projectMemorySaving[projectId]) return
    setProjectMemorySaving((prev) => ({ ...prev, [projectId]: true }))
    setProjectMemorySaved((prev) => ({ ...prev, [projectId]: false }))
    try {
      await updateDoc(doc(db, "projects", projectId), { projectMemory: projectMemoryDrafts[projectId] ?? "" })
      setProjectMemorySaved((prev) => ({ ...prev, [projectId]: true }))
      setTimeout(() => setProjectMemorySaved((prev) => ({ ...prev, [projectId]: false })), 2500)
    } catch (err) {
      console.error("Failed to save project memory:", err)
    } finally {
      setProjectMemorySaving((prev) => ({ ...prev, [projectId]: false }))
    }
  }

  const handleManageBilling = async () => {
    if (portalLoading || !user) return
    setPortalLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || "Failed to load billing portal")
    } catch (err) {
      console.error(err)
      alert("Failed to load billing portal")
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--muted))_0,transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))] text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Lotus Build</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Manage your workspace, billing, usage, and AI memory from one focused control surface.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/70 px-4 py-3 shadow-sm shadow-foreground/[0.03]">
            <p className="text-xs text-muted-foreground">Current section</p>
            <p className="mt-1 text-sm font-medium text-foreground">{activePageMeta.label}</p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-8 lg:h-fit">
            <div className="rounded-2xl border border-border/80 bg-card/70 p-2 shadow-sm shadow-foreground/[0.03]">
              {SETTINGS_PAGES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActivePage(item.key)}
                  className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    activePage === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${activePage === item.key ? "bg-primary-foreground" : "bg-muted-foreground/40 group-hover:bg-foreground"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className={`mt-0.5 block text-xs ${activePage === item.key ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 pb-16">
            {activePage === "account" && (
              <>
                <SettingsSection title="Profile" description="Your identity inside Lotus Build and the workspace currently attached to this account.">
                  <div className="border-b border-border/80 p-5 last:border-b-0">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <Avatar className="h-16 w-16 rounded-2xl border border-border bg-background shadow-sm sm:h-20 sm:w-20">
                          <AvatarImage src={userData.photoURL || undefined} alt={userData.displayName || "User"} />
                          <AvatarFallback className="rounded-2xl bg-muted text-xl font-semibold text-foreground">
                            {getInitials(userData.displayName, userData.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">{userData.displayName || "Account"}</h3>
                          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{userData.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="mt-1 font-medium text-foreground">{userData.planName || "Free"}</p>
                      </div>
                    </div>
                  </div>
                  <SettingsRow label="Member since">
                    <p className="text-sm text-muted-foreground">{createdAt ? createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Unknown"}</p>
                  </SettingsRow>
                  <SettingsRow label="Current workspace">
                    <ReadOnlyField value={currentWorkspace?.name || "Personal"} />
                  </SettingsRow>
                  <SettingsRow label="Workspace count">
                    <p className="text-sm text-muted-foreground">{Array.isArray(workspaces) ? workspaces.length : 0}</p>
                  </SettingsRow>
                  <SettingsRow label="User ID" description="Useful when contacting support.">
                    <p className="max-w-full truncate rounded-lg bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground sm:max-w-80">{userData.uid}</p>
                  </SettingsRow>
                </SettingsSection>

                <SettingsSection title="Security" description="Session controls and destructive account actions.">
                  <SettingsRow label="Sign out" description="End this browser session and return to the sign-in screen.">
                    <button type="button" onClick={() => signOut()} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                      Sign out
                    </button>
                  </SettingsRow>
                  <SettingsRow label="Delete account" description="Permanently delete your account, projects, and associated data. This cannot be undone.">
                    <button type="button" onClick={() => { setDeleteDialogOpen(true); setDeleteConfirmText(""); setDeleteError("") }} className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
                      Delete account
                    </button>
                  </SettingsRow>
                </SettingsSection>
              </>
            )}

            {activePage === "billing" && (
              <>
                <SettingsSection title="Billing" description="Plan status, subscription controls, and invoices for your Lotus Build workspace.">
                  <div className="grid gap-4 border-b border-border/80 p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-foreground">{userData.planName || "Free"} plan</p>
                      <p className="mt-2 text-sm text-muted-foreground">{isFreePlan ? "Free workspace" : "Active subscription"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {periodEnd ? `${isFreePlan ? "Credits reset" : "Subscription renews"} on ${periodEnd.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.` : "No billing cycle is available for this account."}
                      </p>
                    </div>
                    <Link href="/pricing" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                      {isFreePlan ? "Upgrade" : "Adjust plan"}
                    </Link>
                  </div>
                  <SettingsRow label="Payment" description={isFreePlan ? "No payment method is attached to your free plan." : "Payment details are managed from your billing portal."}>
                    {isFreePlan ? (
                      <Link href="/pricing" className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                        Add payment
                      </Link>
                    ) : (
                      <button type="button" onClick={handleManageBilling} disabled={portalLoading} className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                        {portalLoading ? "Loading" : "Update"}
                      </button>
                    )}
                  </SettingsRow>
                  <SettingsRow label="Cancellation" description={isFreePlan ? "There is no active subscription to cancel." : "Manage or cancel from the billing portal."}>
                    {!isFreePlan ? (
                      <button type="button" onClick={handleManageBilling} disabled={portalLoading} className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50">
                        {portalLoading ? "Loading" : "Cancel"}
                      </button>
                    ) : <p className="text-sm text-muted-foreground">No active subscription</p>}
                  </SettingsRow>
                </SettingsSection>

                <SettingsSection title="Invoices" description="Download receipts or open hosted invoices from Stripe.">
                  <div className="p-0">
                    {isFreePlan ? (
                      <p className="p-5 text-sm text-muted-foreground">Invoices are available after a paid subscription is active.</p>
                    ) : invoicesLoading ? (
                      <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading invoices</div>
                    ) : invoices.length === 0 ? (
                      <p className="p-5 text-sm text-muted-foreground">No invoices found for this account.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b border-border/80 bg-muted/50">
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                              <th className="px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/80">
                            {invoices.map((inv) => {
                              const date = new Date(inv.date * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                              const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency.toUpperCase() }).format(inv.amount / 100)
                              const statusColor = inv.status === "paid" ? "bg-success-soft text-success-soft-foreground border-success/20" : inv.status === "open" ? "bg-warning-soft text-warning-soft-foreground border-warning/20" : "bg-muted text-muted-foreground border-border"
                              return (
                                <tr key={inv.id} className="transition-colors hover:bg-muted/40">
                                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.number ?? inv.id.slice(-8).toUpperCase()}</td>
                                  <td className="px-4 py-3 text-foreground/85">{date}</td>
                                  <td className="px-4 py-3 font-medium text-foreground">{amount}</td>
                                  <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusColor}`}>{inv.status}</span></td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground" title="Download PDF"><Download className="h-3.5 w-3.5" /></a>}
                                      {inv.hostedUrl && <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground" title="View invoice"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </SettingsSection>
              </>
            )}

            {activePage === "usage" && (
              <>
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <Metric label="Credits remaining" value={remainingClamped.toLocaleString()} helper={`${tokenPct}% used`} />
                  <Metric label="Agent runs" value={`${agentRemaining}`} helper={`${agentUsed} of ${agentRunLimit} used`} />
                  <Metric label="Days left" value={daysLeft} helper={`${dailyAvg.toLocaleString()} credits daily avg`} />
                </div>
                <SettingsSection title="Usage" description="Track build credits and computer-agent run limits for the current billing cycle.">
                  <SettingsRow label="Build credits" description={`${usedCredits.toLocaleString()} of ${tokensLimit.toLocaleString()} credits used this cycle.`}>
                    <div className="w-full sm:w-80">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{remainingClamped.toLocaleString()} remaining</span><span>{tokenPct}% used</span></div>
                      <ProgressMeter value={tokenPct} tone={tokenPct >= 90 ? "danger" : tokenPct >= 60 ? "warning" : "primary"} />
                    </div>
                  </SettingsRow>
                  <SettingsRow label="Agent runs" description="Runs available for autonomous computer sessions.">
                    <div className="w-full sm:w-80">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{agentRemaining} remaining</span><span>{agentUsed} / {agentRunLimit}</span></div>
                      <ProgressMeter value={agentPct} />
                    </div>
                  </SettingsRow>
                </SettingsSection>
                <section className="py-8">
                  <div className="mb-5"><h2 className="text-[15px] font-semibold text-foreground">Activity</h2><p className="mt-1 text-sm text-muted-foreground">A contribution-style view of actual workspace activity.</p></div>
                  <ContributionCalendar items={contributionItems} loading={projectsLoading || computerActivityLoading} />
                </section>
              </>
            )}

            {activePage === "projects" && (
              <>
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <Metric label="Total projects" value={projectsLoading ? "..." : analytics.total} />
                  <Metric label="This month" value={projectsLoading ? "..." : analytics.monthProjects} helper={`${analytics.weekProjects} this week`} />
                  <Metric label="Success rate" value={projectsLoading ? "..." : `${analytics.successRate}%`} helper={`${analytics.complete} complete, ${analytics.error} errors`} />
                </div>
                <SettingsSection title="Projects" description="Recent builds and workspace health at a glance.">
                  <SettingsRow label="Recent builds">
                    {projectsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
                    ) : analytics.recentProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects yet</p>
                    ) : (
                      <div className="w-full space-y-1 sm:w-[28rem]">
                        {analytics.recentProjects.slice(0, 5).map((p) => (
                          <Link key={p.id} href={`/project/${p.id}`} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted">
                            {statusDot(p.status)}
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.prompt?.trim() || "Untitled project"}</span>
                            <span className="text-xs text-muted-foreground">{p.model || "GPT-5.5"}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </SettingsRow>
                  <SettingsRow label="All projects" description="Open the full projects index.">
                    <Link href="/projects" className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80">Open projects</Link>
                  </SettingsRow>
                </SettingsSection>
              </>
            )}

            {activePage === "memory" && (
              <div className="pb-12">
                <SettingsSection title="Memory" description="Control what Lotus Build remembers across projects and what stays scoped to one build.">
                  <div className="border-b border-border/80 p-5">
                    <div className="mb-3 flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-foreground">Global memory</h3>
                      <p className="text-xs leading-5 text-muted-foreground">Preferences and facts that apply to all projects, such as coding style, preferred libraries, tone, and recurring requirements.</p>
                    </div>
                    {globalMemoryLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</div>
                    ) : (
                      <>
                        <textarea
                          value={globalMemoryDraft}
                          onChange={(e) => { setGlobalMemoryDraft(e.target.value); setGlobalMemorySaved(false) }}
                          rows={8}
                          placeholder="Example: Always use TypeScript. Prefer Tailwind CSS. Keep generated code minimal and readable."
                          className="w-full resize-y rounded-xl border border-border/80 bg-background/70 px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                        />
                        <div className="mt-3 flex items-center gap-3">
                          <button type="button" onClick={handleSaveGlobalMemory} disabled={globalMemorySaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                            {globalMemorySaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{globalMemorySaving ? "Saving" : "Save memory"}
                          </button>
                          {globalMemorySaved && <span className="text-xs text-success">Saved</span>}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-5 flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-foreground">Project memory</h3>
                      <p className="text-xs leading-5 text-muted-foreground">Context specific to each project: goals, constraints, stack choices, and design decisions.</p>
                    </div>
                    {projectsLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading projects</div>
                    ) : projectsData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {projectsData.map((p) => (
                          <div key={p.id} className="rounded-xl border border-border/80 bg-background/60 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              {statusDot(p.status)}
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.prompt?.trim() || "Untitled project"}</span>
                              <a href={`/computer/${p.id}`} className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"><ExternalLink className="h-3 w-3" /> Open</a>
                            </div>
                            <textarea
                              value={projectMemoryDrafts[p.id] ?? ""}
                              onChange={(e) => { setProjectMemoryDrafts((prev) => ({ ...prev, [p.id]: e.target.value })); setProjectMemorySaved((prev) => ({ ...prev, [p.id]: false })) }}
                              rows={4}
                              placeholder="Project-specific context, constraints, decisions"
                              className="w-full resize-y rounded-lg border border-border/80 bg-card/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                            <div className="mt-2.5 flex items-center gap-3">
                              <button type="button" onClick={() => handleSaveProjectMemory(p.id)} disabled={projectMemorySaving[p.id]} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                                {projectMemorySaving[p.id] && <Loader2 className="h-3 w-3 animate-spin" />}{projectMemorySaving[p.id] ? "Saving" : "Save"}
                              </button>
                              {projectMemorySaved[p.id] && <span className="text-xs text-success">Saved</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SettingsSection>
              </div>
            )}
          </main>
        </div>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !deleteLoading && setDeleteDialogOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete your account</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">This action is permanent and cannot be reversed.</p>
              </div>
            </div>
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-destructive">You will permanently lose:</p>
              <ul className="space-y-1.5 text-sm text-destructive/90">
                {["Your account and profile", "All projects and generated code", "Token and billing history", "All workspaces and integrations"].map((item) => (
                  <li key={item} className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 shrink-0 text-destructive/60" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-sm text-foreground">Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">{userData.email}</span> to confirm</label>
              <Input type="email" value={deleteConfirmText} onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError("") }} placeholder={userData.email ?? "your@email.com"} className="h-10 rounded-lg border-border bg-muted/50 text-sm focus:bg-card" disabled={deleteLoading} autoComplete="off" />
            </div>
            {deleteError && <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{deleteError}</div>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading} className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDeleteAccount} disabled={deleteConfirmText !== userData.email || deleteLoading} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40">
                {deleteLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting</> : <><Trash2 className="h-3.5 w-3.5" />Delete account</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountSettingsPage() {
  return (
    <ProtectedRoute requiredTokens={0}>
      <SettingsContent />
    </ProtectedRoute>
  )
}
