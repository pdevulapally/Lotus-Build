"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FolderOpen, FolderGit2 } from "lucide-react"
import { PlusIcon } from "@/components/ui/lotus-icons"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { useAuth } from "@/contexts/auth-context"
import { useProjectList } from "@/hooks/use-project-list"
import { currentBackend } from "@/lib/backend/browser"
import { projectSessionPath } from "@/lib/backend/project-session-path"
import { cn } from "@/lib/utils"
import { ProjectNavigationRow } from "@/components/projects/project-navigation-row"
import { ProjectSearchDialog } from "@/components/projects/project-search-dialog"
import { SidebarProfileMenu } from "@/components/projects/sidebar-profile-menu"
import { SidebarIntegrationsLink } from "@/components/projects/sidebar-integrations-link"
import { BrandWordmark } from "@/components/ui/brand-wordmark"
import navigationStyles from "@/components/projects/sidebar-navigation.module.css"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

const actionClass = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function ComputerNavigation({ currentProjectId, mobileOpen, onMobileOpenChange, onCurrentProjectChanged, theme, repositoryActive, onOpenRepository }: {
  currentProjectId: string
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  onCurrentProjectChanged: () => void
  theme: "light" | "dark"
  repositoryActive: boolean
  onOpenRepository: () => void
}) {
  const router = useRouter()
  const { user, account, userData, signOut } = useAuth()
  const { projects, loading, error, refresh } = useProjectList({ scope: "user", uid: user?.uid })
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
    <header className={cn(navigationStyles.header, compact && navigationStyles.compactHeader, "flex h-12 shrink-0 items-center px-2", compact ? "justify-center" : "justify-between")}>
      {!compact && <Link href="/" aria-label="LotusBuild home" className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BrandWordmark size="compact" /></Link>}
      <div className="flex items-center">
        {!compact && <ProjectSearchDialog projects={projects} loading={loading} error={error} onOpenProject={(project) => { void openProject(project) }} />}
        <button type="button" onClick={() => { if (mobileOpen) onMobileOpenChange(false); else setCollapsed(!compact) }} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!compact} className={actionClass}><SidebarToggleIcon className="size-[18px]" side="left" open={!compact} /></button>
      </div>
    </header>
    <Link href="/" onClick={() => onMobileOpenChange(false)} title={compact ? "New project" : undefined} className={cn(navigationStyles.newProject, "mx-3 flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact && "justify-center px-0")}>
      <PlusIcon className="size-4 shrink-0" />{!compact && "New project"}
    </Link>
    <SidebarIntegrationsLink collapsed={compact} onNavigate={() => onMobileOpenChange(false)} className="mx-3" />
    <button type="button" title={compact ? 'Repository' : undefined} aria-label={compact ? 'Repository' : undefined} aria-current={repositoryActive ? 'page' : undefined}
      onClick={() => { onOpenRepository(); onMobileOpenChange(false) }}
      className={cn('mx-3 flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', repositoryActive && 'bg-accent text-foreground', compact && 'justify-center px-0')}>
      <FolderGit2 aria-hidden className="size-4 shrink-0" />{!compact && 'Repository'}
    </button>
    {compact ? <button type="button" onClick={() => setCollapsed(false)} className={cn(actionClass, "mx-auto")} aria-label="Show projects"><FolderOpen className="size-4" aria-hidden /></button> : <>
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={projectListId} className="mx-3 mt-5 flex min-h-9 items-center justify-between rounded-lg px-2 text-xs whitespace-nowrap text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Projects<ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", !expanded && "-rotate-90")} aria-hidden />
      </button>
      <div id={projectListId} hidden={!expanded} className="min-h-0 flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
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
    <footer className={cn(navigationStyles.footer, "mt-auto shrink-0")}>
      <SidebarProfileMenu
        name={displayName}
        email={userData?.email}
        photoURL={userData?.photoURL}
        planName={account?.plan.name}
        collapsed={compact}
        theme={theme}
        onNavigate={() => onMobileOpenChange(false)}
        onSignOut={signOut}
      />
    </footer>
  </nav>

  return <>
    <aside aria-label="Project sidebar" className={cn(navigationStyles.surface, "hidden h-full shrink-0 overflow-hidden border-r border-border/30 bg-background transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block", collapsed ? "w-[68px]" : "w-[256px]")}>{content(collapsed, `${navigationId}-desktop-projects`)}</aside>
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent id="computer-mobile-navigation" side="left" onCloseAutoFocus={(event) => {
        const trigger = document.getElementById("computer-navigation-toggle")
        if (trigger?.getClientRects().length) { event.preventDefault(); trigger.focus() }
      }} className={cn(navigationStyles.surface, "w-[min(85vw,280px)] gap-0 border-border bg-background p-0 text-foreground [&>button:last-child]:hidden", theme === "dark" && "dark")}>
        <SheetTitle className="sr-only">Project navigation</SheetTitle>
        <SheetDescription className="sr-only">Open your projects or account settings.</SheetDescription>
        {content(false, `${navigationId}-mobile-projects`)}
      </SheetContent>
    </Sheet>
  </>
}
