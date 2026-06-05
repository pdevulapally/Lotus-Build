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
  Leaf,
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

const SETTINGS_PAGES: Array<{ key: SettingsPageKey; label: string }> = [
  { key: "account", label: "Account" },
  { key: "billing", label: "Billing" },
  { key: "usage", label: "Usage" },
  { key: "projects", label: "Projects" },
  { key: "memory", label: "Memory" },
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
  if (status === "complete") return <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
  if (status === "generating") return <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
  if (status === "error") return <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
  return <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 shrink-0" />
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
      week.push({
        date: day,
        key,
        count: isPadding ? 0 : count,
        level: isPadding ? 0 : getContributionLevel(count, max),
        isPadding,
      })
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
  return { weeks, total }
}

function getContributionColor(level: ContributionDay["level"], isPadding?: boolean) {
  if (isPadding) return "bg-transparent border-transparent"
  if (level === 0) return "bg-zinc-100 border-zinc-200"
  if (level === 1) return "bg-emerald-100 border-emerald-200"
  if (level === 2) return "bg-emerald-300 border-emerald-300"
  if (level === 3) return "bg-emerald-500 border-emerald-500"
  return "bg-emerald-800 border-emerald-800"
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
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {loading ? "Loading activity..." : `${total.toLocaleString()} contribution${total === 1 ? "" : "s"} in the last year`}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Project builds, edits, and computer-agent activity from your workspace.</p>
        </div>
        <Link href="/projects" className="text-xs font-medium text-zinc-500 transition-colors hover:text-foreground">
          View projects
        </Link>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
        <div className="min-w-[720px]">
          <div className="relative ml-8 mb-1 h-5">
            {monthLabels.map(({ label, index }) => (
              <span
                key={`${label}-${index}`}
                className="absolute text-[11px] text-zinc-500"
                style={{ left: `${index * 16}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="grid h-[104px] grid-rows-7 gap-1 pt-[16px] text-[11px] text-zinc-500">
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
                      title={
                        day.isPadding
                          ? undefined
                          : `${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-zinc-500">
            <span>Based on real project activity</span>
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

function SettingsSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 pb-12">
      <h2 className="mb-7 text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="divide-y divide-zinc-200/80 border-y border-zinc-200/80">
        {children}
      </div>
    </section>
  )
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(180px,0.75fr)_minmax(0,1fr)] sm:items-center">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>}
      </div>
      <div className="min-w-0 sm:justify-self-end">{children}</div>
    </div>
  )
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm sm:w-72">
      <span className="block truncate">{value}</span>
    </div>
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
          model: data.model || "GPT-4-1 Mini",
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
        const timelineDates = Array.isArray(data.timeline)
          ? data.timeline.map((event: any) => event?.createdAt).filter(Boolean)
          : []

        next.push({
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          activityDates: timelineDates,
        })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, user?.uid, userData?.planId])

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
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekProjects = projectsData.filter((p) => { const d = toDate(p.createdAt); return !!d && d >= weekAgo }).length
    return { total, complete, generating, error, monthProjects, weekProjects,
      successRate: total > 0 ? Math.round((complete / total) * 100) : 0,
      recentProjects: projectsData.slice(0, 6),
    }
  }, [projectsData])

  const contributionItems = useMemo<ContributionActivityItem[]>(() => {
    return [...projectsData, ...computerActivityData]
  }, [computerActivityData, projectsData])

  if (loading || !user || !userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  const remainingClamped = Math.max(0, userData.tokenUsage?.remaining ?? 0)
  const tokensLimit = Math.max(Number(userData.tokensLimit ?? 0), Number(userData.tokenUsage.used ?? 0) + remainingClamped)
  const tokenPct = tokensLimit > 0 ? Math.min(100, Math.round((userData.tokenUsage.used / tokensLimit) * 100)) : 0
  const periodEnd = userData.tokenUsage?.periodEnd ? new Date(userData.tokenUsage.periodEnd) : null
  const periodStart = userData.tokenUsage?.periodStart ? new Date(userData.tokenUsage.periodStart) : null
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : 0
  const cycleDays = periodStart && periodEnd ? Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000)) : 30
  const dailyAvg = Math.max(0, Math.round((userData.tokenUsage.used || 0) / cycleDays))
  const agentRunLimit = getAgentRunLimitForPlan(userData.planId, userData.agentRunLimit)
  const agentUsed = Math.max(0, Number(userData.agentUsage?.used ?? 0))
  const agentRemaining = Math.max(0, Number.isFinite(Number(userData.agentUsage?.remaining)) ? Number(userData.agentUsage?.remaining) : agentRunLimit - agentUsed)
  const createdAt = userData.createdAt ? new Date(userData.createdAt) : null
  const isFreePlan = !userData.planId || userData.planId === "free"

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
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || "Failed to load billing portal")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to load billing portal")
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12 lg:px-12 lg:py-12">
        <aside className="md:sticky md:top-10 md:h-fit">
          <div className="mb-7 flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          </div>

          <nav className="-mx-1 space-y-1 text-sm sm:mx-0">
            {SETTINGS_PAGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
                className={`block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left transition-colors ${
                  activePage === item.key
                    ? "bg-muted text-foreground"
                    : "text-zinc-600 hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 pb-16 lg:max-w-4xl">
          {activePage === "account" && (
            <>
              <SettingsSection id="profile" title="Profile">
                <div className="py-5">
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="h-20 bg-[linear-gradient(135deg,#f0efe9_0%,#e8e6de_100%)]" />
                    <div className="px-5 pb-5 sm:px-6">
                      <div className="flex items-end gap-4">
                        <Avatar className="-mt-10 h-16 w-16 rounded-2xl border-2 border-white shadow-md sm:h-20 sm:w-20">
                          <AvatarImage src={userData.photoURL || undefined} alt={userData.displayName || "User"} />
                          <AvatarFallback className="rounded-2xl bg-zinc-100 text-lg font-semibold text-zinc-700">
                            {getInitials(userData.displayName, userData.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 pb-1">
                          <h3 className="truncate text-xl font-semibold text-foreground">{userData.displayName || "Account"}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <SettingsRow label="Email">
                  <div className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm sm:w-72">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate">{userData.email}</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Member since">
                  <p className="text-sm text-zinc-600">
                    {createdAt ? createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Unknown"}
                  </p>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection id="account" title="Account Details">
                <SettingsRow label="Current workspace">
                  <ReadOnlyField value={currentWorkspace?.name || "Personal"} />
                </SettingsRow>
                <SettingsRow label="Workspace count">
                  <p className="text-sm text-zinc-600">{Array.isArray(workspaces) ? workspaces.length : 0}</p>
                </SettingsRow>
                <SettingsRow label="User ID" description="Useful when contacting support.">
                  <p className="max-w-full truncate font-mono text-xs text-zinc-500 sm:max-w-72">{userData.uid}</p>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection id="security" title="Security">
                <SettingsRow label="Sign out">
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-foreground"
                  >
                    Sign out
                  </button>
                </SettingsRow>
                <SettingsRow
                  label="Delete account"
                  description="Permanently delete your account, all projects, and associated data. This cannot be undone."
                >
                  <button
                    type="button"
                    onClick={() => { setDeleteDialogOpen(true); setDeleteConfirmText(""); setDeleteError("") }}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    Delete account
                  </button>
                </SettingsRow>
              </SettingsSection>
            </>
          )}

          {activePage === "billing" && (
          <section className="pb-12">
            <h2 className="mb-7 text-[15px] font-semibold text-foreground">Billing</h2>

            <div className="space-y-12">
              <div className="grid gap-5 border-b border-zinc-200/80 pb-10 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-start">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-foreground">
                  {isFreePlan ? <img src="/Images/leaf-svgrepo-com.svg" className="h-6 w-6" alt="Starter" /> : userData.planId === "pro" ? <img src="/Images/lotus-flower-svgrepo-com.svg" className="h-6 w-6" alt="Pro" /> : <img src="/Images/enterprise-svgrepo-com.svg" className="h-6 w-6" alt="Enterprise" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{userData.planName || "Free"} plan</p>
                  <p className="mt-2 text-sm text-foreground">{isFreePlan ? "Free workspace" : "Active subscription"}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {periodEnd
                      ? `${isFreePlan ? "Credits reset" : "Your subscription renews"} on ${periodEnd.toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}.`
                      : "No billing cycle is available for this account."}
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
                >
                  {isFreePlan ? "Upgrade plan" : "Adjust plan"}
                </Link>
              </div>

              <div>
                <h3 className="mb-7 text-[15px] font-semibold text-foreground">Payment</h3>
                <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-10 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-700">
                    {isFreePlan ? "No payment method is attached to your free plan." : "Payment details are managed from your billing portal."}
                  </p>
                  {isFreePlan ? (
                    <Link
                      href="/pricing"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
                    >
                      Add payment
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {portalLoading ? "Loading..." : "Update"}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-7 text-[15px] font-semibold text-foreground">Invoices</h3>
                <div className="border-b border-zinc-200/80 pb-10">
                  {isFreePlan ? (
                    <p className="text-sm text-zinc-500">Invoices are available after a paid subscription is active.</p>
                  ) : invoicesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
                    </div>
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-zinc-500">No invoices found for this account.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 bg-zinc-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Invoice</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {invoices.map((inv) => {
                            const date = new Date(inv.date * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency.toUpperCase() }).format(inv.amount / 100)
                            const statusColor =
                              inv.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : inv.status === "open" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-zinc-100 text-zinc-500 border-zinc-200"
                            return (
                              <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{inv.number ?? inv.id.slice(-8).toUpperCase()}</td>
                                <td className="px-4 py-3 text-zinc-700">{date}</td>
                                <td className="px-4 py-3 font-medium text-foreground">{amount}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusColor}`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    {inv.pdfUrl && (
                                      <a
                                        href={inv.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-foreground"
                                        title="Download PDF"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                    {inv.hostedUrl && (
                                      <a
                                        href={inv.hostedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-foreground"
                                        title="View invoice"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}
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
              </div>

              <div>
                <h3 className="mb-7 text-[15px] font-semibold text-foreground">Cancellation</h3>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-700">{isFreePlan ? "There is no active subscription to cancel." : "Manage or cancel your subscription from your billing portal."}</p>
                  {!isFreePlan && (
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {portalLoading ? "Loading..." : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {activePage === "usage" && (
            <>
              <SettingsSection id="usage" title="Usage">
                <SettingsRow
                  label="Build credits"
                  description={`${userData.tokenUsage.used.toLocaleString()} of ${tokensLimit.toLocaleString()} credits used this cycle.`}
                >
                  <div className="w-full sm:w-80">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{remainingClamped.toLocaleString()} remaining</span>
                      <span>{tokenPct}% used</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className={`h-full rounded-full ${tokenPct >= 90 ? "bg-red-500" : tokenPct >= 60 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${tokenPct}%` }}
                      />
                    </div>
                  </div>
                </SettingsRow>
                <SettingsRow label="Daily average">
                  <p className="text-sm text-zinc-600">{dailyAvg.toLocaleString()} credits</p>
                </SettingsRow>
                <SettingsRow label="Days left">
                  <p className="text-sm text-zinc-600">{daysLeft}</p>
                </SettingsRow>
                <SettingsRow label="Agent runs">
                  <div className="w-full sm:w-80">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{agentRemaining} remaining</span>
                      <span>{agentUsed} / {agentRunLimit}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${agentRunLimit > 0 ? Math.min(100, Math.round((agentUsed / agentRunLimit) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <section id="activity" className="scroll-mt-24 pb-12">
                <h2 className="mb-7 text-[15px] font-semibold text-foreground">Activity</h2>
                <ContributionCalendar items={contributionItems} loading={projectsLoading || computerActivityLoading} />
              </section>
            </>
          )}

          {activePage === "projects" && (
          <SettingsSection id="projects" title="Projects">
            <SettingsRow label="Total projects">
              <p className="text-sm text-zinc-600">{projectsLoading ? "Loading..." : analytics.total}</p>
            </SettingsRow>
            <SettingsRow label="This month">
              <p className="text-sm text-zinc-600">{projectsLoading ? "Loading..." : analytics.monthProjects}</p>
            </SettingsRow>
            <SettingsRow label="Success rate">
              <p className="text-sm text-zinc-600">{projectsLoading ? "Loading..." : `${analytics.successRate}%`}</p>
            </SettingsRow>
            <SettingsRow label="Recent builds">
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : analytics.recentProjects.length === 0 ? (
                <p className="text-sm text-zinc-500">No projects yet</p>
              ) : (
                <div className="w-full space-y-2 sm:w-96">
                  {analytics.recentProjects.slice(0, 4).map((p) => (
                    <Link key={p.id} href={`/project/${p.id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-100">
                      {statusDot(p.status)}
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{p.prompt?.trim() || "Untitled project"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </SettingsRow>
            <SettingsRow label="All projects">
              <Link href="/projects" className="text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-foreground">
                Open projects
              </Link>
            </SettingsRow>
          </SettingsSection>
          )}

          {activePage === "memory" && (
            <div className="pb-12">
              <h2 className="mb-2 text-[15px] font-semibold text-foreground">Memory</h2>
              <p className="mb-8 text-sm text-zinc-500">
                Memory lets the AI agent carry context across sessions. Global memory applies to every project; project memory is scoped to a single project.
              </p>

              {/* Global memory */}
              <section className="mb-10">
                <h3 className="mb-1 text-sm font-semibold text-zinc-800">Global Memory</h3>
                <p className="mb-3 text-xs text-zinc-500">Preferences and facts that apply to all projects — coding style, preferred libraries, tone, recurring requirements.</p>
                {globalMemoryLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <textarea
                      value={globalMemoryDraft}
                      onChange={(e) => { setGlobalMemoryDraft(e.target.value); setGlobalMemorySaved(false) }}
                      rows={8}
                      placeholder={"e.g. Always use TypeScript. Prefer Tailwind CSS. Keep code minimal and readable. Never add comments explaining what the code does."}
                      className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-0 shadow-sm"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveGlobalMemory}
                        disabled={globalMemorySaving}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                      >
                        {globalMemorySaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {globalMemorySaving ? "Saving…" : "Save"}
                      </button>
                      {globalMemorySaved && <span className="text-xs text-emerald-600">Saved</span>}
                    </div>
                  </>
                )}
              </section>

              {/* Project memories */}
              <section>
                <h3 className="mb-1 text-sm font-semibold text-zinc-800">Project Memory</h3>
                <p className="mb-5 text-xs text-zinc-500">Context specific to each project — goals, constraints, tech stack, design decisions. Only injected when working in that project.</p>
                {projectsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading projects…
                  </div>
                ) : projectsData.length === 0 ? (
                  <p className="text-sm text-zinc-500">No projects yet.</p>
                ) : (
                  <div className="space-y-6">
                    {projectsData.map((p) => (
                      <div key={p.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                          {statusDot(p.status)}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{p.prompt?.trim() || "Untitled project"}</span>
                          <a
                            href={`/computer/${p.id}`}
                            className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-zinc-700 flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                        </div>
                        <textarea
                          value={projectMemoryDrafts[p.id] ?? ""}
                          onChange={(e) => {
                            setProjectMemoryDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            setProjectMemorySaved((prev) => ({ ...prev, [p.id]: false }))
                          }}
                          rows={4}
                          placeholder="Project-specific context, constraints, decisions…"
                          className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-0"
                        />
                        <div className="mt-2.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSaveProjectMemory(p.id)}
                            disabled={projectMemorySaving[p.id]}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                          >
                            {projectMemorySaving[p.id] && <Loader2 className="h-3 w-3 animate-spin" />}
                            {projectMemorySaving[p.id] ? "Saving…" : "Save"}
                          </button>
                          {projectMemorySaved[p.id] && <span className="text-xs text-emerald-600">Saved</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

        </main>
      </div>

      {/* ── Delete confirmation dialog ── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            onClick={() => !deleteLoading && setDeleteDialogOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-900/20">
            {/* Header */}
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Delete your account</h3>
                <p className="mt-0.5 text-sm text-zinc-500">This action is permanent and cannot be reversed.</p>
              </div>
            </div>

            {/* Warning list */}
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-red-600">
                You will permanently lose:
              </p>
              <ul className="space-y-1.5 text-sm text-red-700">
                {[
                  "Your account and profile",
                  "All projects and generated code",
                  "Token and billing history",
                  "All workspaces and integrations",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmation input */}
            <div className="mb-5">
              <label className="mb-2 block text-sm text-zinc-700">
                Type <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-zinc-800">{userData.email}</span> to confirm
              </label>
              <Input
                type="email"
                value={deleteConfirmText}
                onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError("") }}
                placeholder={userData.email ?? "your@email.com"}
                className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-sm focus:bg-white"
                disabled={deleteLoading}
                autoComplete="off"
              />
            </div>

            {deleteError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== userData.email || deleteLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting…</>
                ) : (
                  <><Trash2 className="h-3.5 w-3.5" />Delete my account</>
                )}
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
