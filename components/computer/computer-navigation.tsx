"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FolderOpen, SquarePen } from "lucide-react"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { BillingIcon, ChevronUpDownIcon, SettingsIcon, SignOutIcon } from "@/components/ui/lotus-icons"
import { useAuth } from "@/contexts/auth-context"
import { useProjectList } from "@/hooks/use-project-list"
import { currentBackend } from "@/lib/backend/browser"
import { projectSessionPath } from "@/lib/backend/project-session-path"
import { cn } from "@/lib/utils"
import { ProjectNavigationRow } from "@/components/projects/project-navigation-row"
import { ProjectSearchDialog } from "@/components/projects/project-search-dialog"
import { useSettingsDialog } from "@/components/settings/settings-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

const actionClass = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ComputerNavigation({ currentProjectId, mobileOpen, onMobileOpenChange, onCurrentProjectChanged, theme }: {
  currentProjectId: string
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onCurrentProjectChanged: () => void
  theme: "light" | "dark"
}) {
  const router = useRouter()
  const { user, account, userData, signOut } = useAuth()
  const { projects, loading, error, refresh } = useProjectList({ scope: "user", uid: user?.uid })
  const { openSettings } = useSettingsDialog()
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const displayName = userData?.displayName || userData?.email || "Your account"
  const navigationId = useId()

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const closeMobile = () => { if (media.matches) onMobileOpenChange(false) }
    media.addEventListener("change", closeMobile)
    return () => media.removeEventListener("change", closeMobile)
  }, [onMobileOpenChange])

  const openProject = async (project: { id: string; kind?: string }) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setNavigationError(null)
    try {
      const path = await projectSessionPath(currentBackend(), project, controller.signal)
      if (controller.signal.aborted) return
      onMobileOpenChange(false)
      router.push(path)
    } catch (reason) {
      if (!controller.signal.aborted) setNavigationError(reason instanceof Error ? reason.message : "Couldn’t open this workspace. Please try again.")
    }
  }

  const content = (compact: boolean, projectListId: string) => <nav aria-label="Workspace navigation" className="flex h-full min-h-0 flex-col gap-2">
    <header className={cn("flex h-12 shrink-0 items-center px-2", compact ? "justify-center" : "justify-between")}>
      {!compact && <Link href="/" aria-label="LotusBuild home" className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><LotusLogo size={24} /></Link>}
      <div className="flex items-center">
        {!compact && <ProjectSearchDialog projects={projects} loading={loading} error={error} onOpenProject={(project) => { void openProject(project) }} />}
        <button type="button" onClick={() => { if (mobileOpen) onMobileOpenChange(false); else setCollapsed(!compact) }} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!compact} className={actionClass}><SidebarToggleIcon className="size-[18px]" side="left" open={!compact} /></button>
      </div>
    </header>
    <Link href="/" onClick={() => onMobileOpenChange(false)} title={compact ? "New project" : undefined} className={cn("mx-2 flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact && "justify-center px-0")}>
      <SquarePen className="size-4 shrink-0" aria-hidden />{!compact && "New project"}
    </Link>
    {compact ? <button type="button" onClick={() => setCollapsed(false)} className={cn(actionClass, "mx-auto")} aria-label="Show projects"><FolderOpen className="size-4" aria-hidden /></button> : <>
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={projectListId} className="mx-3 mt-5 flex min-h-9 items-center justify-between rounded-lg px-2 text-xs whitespace-nowrap text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Projects<ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", !expanded && "-rotate-90")} aria-hidden />
      </button>
      <div id={projectListId} hidden={!expanded} className="min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
        {(error || navigationError) && <p role="alert" className="px-3 py-2 text-xs leading-relaxed text-destructive">{error || navigationError}</p>}
        {loading ? <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Loading projects…</p> : !error && projects.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Your projects will appear here.</p> : <div role="list" aria-label="Your projects">{projects.map((project) => <ProjectNavigationRow
          key={project.id}
          project={project}
          active={project.id === currentProjectId}
          portalClassName={theme === "dark" ? "dark" : undefined}
          onNavigate={() => { void openProject(project) }}
          onChanged={(action) => {
            refresh()
            if (project.id !== currentProjectId) return
            if (action === "delete") { onMobileOpenChange(false); router.push("/") }
            else onCurrentProjectChanged()
          }}
        />)}</div>}
      </div>
    </>}
    <footer className="mt-auto shrink-0 space-y-1 px-2 pb-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Open account menu for ${displayName}`} className={cn("flex min-h-12 w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact && "justify-center px-0")}>
            <Avatar className="size-7 shrink-0"><AvatarImage src={userData?.photoURL ?? undefined} /><AvatarFallback className="bg-muted text-xs">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
            {!compact && <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{displayName}</span>
              <ChevronUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
            </>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className={cn("w-64 rounded-2xl border-border bg-popover p-1.5 text-popover-foreground shadow-[0_16px_48px_-16px_rgb(0_0_0/0.3)]", theme === "dark" && "dark")}>
          <div className="flex min-w-0 items-center gap-2.5 px-2.5 py-2">
            <Avatar className="size-9 shrink-0"><AvatarImage src={userData?.photoURL ?? undefined} /><AvatarFallback className="bg-muted text-xs">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{displayName}</p>
              {userData?.email && <p className="truncate text-xs text-muted-foreground">{userData.email}</p>}
            </div>
            {account && <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{account.plan.name}</span>}
          </div>
          <DropdownMenuSeparator className="mx-1 my-1.5" />
          <DropdownMenuItem onSelect={() => { onMobileOpenChange(false); openSettings() }} className="min-h-10 gap-2.5 rounded-xl px-2.5 text-[13px] font-medium"><SettingsIcon className="size-4 text-muted-foreground" />Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { onMobileOpenChange(false); router.push("/pricing") }} className="min-h-10 gap-2.5 rounded-xl px-2.5 text-[13px] font-medium"><BillingIcon className="size-4 text-muted-foreground" />Billing &amp; plans</DropdownMenuItem>
          <DropdownMenuSeparator className="mx-1 my-1.5" />
          <DropdownMenuItem onSelect={() => void signOut()} className="min-h-10 gap-2.5 rounded-xl px-2.5 text-[13px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"><SignOutIcon className="size-4 text-destructive" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </footer>
  </nav>

  return <>
    <aside aria-label="Project sidebar" className={cn("hidden h-full shrink-0 overflow-hidden border-r border-border/30 bg-background transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block", collapsed ? "w-[68px]" : "w-[256px]")}>{content(collapsed, `${navigationId}-desktop-projects`)}</aside>
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent id="computer-mobile-navigation" side="left" onCloseAutoFocus={(event) => {
        const trigger = document.getElementById("computer-navigation-toggle")
        if (trigger?.getClientRects().length) { event.preventDefault(); trigger.focus() }
      }} className={cn("w-[min(85vw,280px)] gap-0 border-border bg-background p-0 text-foreground [&>button:last-child]:hidden", theme === "dark" && "dark")}>
        <SheetTitle className="sr-only">Project navigation</SheetTitle>
        <SheetDescription className="sr-only">Open your projects or account settings.</SheetDescription>
        {content(false, `${navigationId}-mobile-projects`)}
      </SheetContent>
    </Sheet>
  </>
}
