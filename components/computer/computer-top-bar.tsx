"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Globe,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  GitBranch,
  Globe2,
  History,
  KeyRound,
  LayoutPanelLeft,
  Lock,
  LogOut,
  Moon,
  Monitor,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Sun,
  Zap,
} from "lucide-react"
import {
  Sheet,
  SheetPortal,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { useProjectList } from "@/hooks/use-project-list"

function buildTitle(prompt: string, max = 34): string {
  const t = (prompt || "").trim()
  if (!t) return "Untitled build"
  return t.length > max ? `${t.slice(0, max)}…` : t
}
import { LotusLogo } from "@/components/ui/lotus-logo"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { CreateWorkspaceModal } from "@/components/workspaces/create-workspace-modal"
import { cn } from "@/lib/utils"
import type { ComputerSessionResponse, WorkspaceTab } from "@/components/computer/session-types"
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
  type ContextUsage,
} from "@/components/ai-elements/context"

export type ComputerProjectIntegration = {
  name?: string
  files?: Array<{ path: string; content: string }>
  githubRepoUrl?: string
  githubRepoFullName?: string
  githubSyncedAt?: unknown
  netlifySiteUrl?: string
  netlifyAdminUrl?: string
  vercelSiteUrl?: string
  vercelDeployUrl?: string
  vercelDeploymentId?: string
  supabaseUrl?: string
  supabaseProjectRef?: string
  envVarNames?: string[]
}

export type ComputerTheme = "light" | "dark"

function ItemIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      {children}
    </span>
  )
}

function StatusBadge({ status }: { status: ComputerSessionResponse["status"] }) {
  if (status === "running") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success-soft-foreground">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-success" />
        Building
      </div>
    )
  }
  if (status === "planning") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-foreground" />
        Planning
      </div>
    )
  }
  if (status === "complete") return null
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
        Error
      </div>
    )
  }
  return null
}

export function ComputerTopBar({
  session,
  sessionTitle,
  firstPrompt,
  projectIntegration,
  projectFileCount,
  remainingTokens,
  planLabel,
  liveSiteUrl,
  isEditingTitle,
  titleDraft,
  titleSaving,
  titleError,
  onTitleDraftChange,
  onEditTitleStart,
  onEditTitleCancel,
  onTitleSave,
  onTitleError,
  onOpenIntegrations,
  onOpenDeploy,
  onOpenHistory,
  chatPanelCollapsed = false,
  onToggleChatPanel,
  activeTab,
  hasPreview,
  hasBrowser,
  hasResearch,
  onTabChange,
  contextUsage,
  theme,
  onThemeToggle,
}: {
  session: ComputerSessionResponse
  sessionTitle: string
  firstPrompt: string | undefined
  projectIntegration: ComputerProjectIntegration | null
  projectFileCount: number
  remainingTokens: number
  planLabel: string
  liveSiteUrl?: string
  isEditingTitle: boolean
  titleDraft: string
  titleSaving: boolean
  titleError: string | null
  onTitleDraftChange: (value: string) => void
  onEditTitleStart: () => void
  onEditTitleCancel: () => void
  onTitleSave: () => Promise<void>
  onTitleError: (message: string | null) => void
  onOpenIntegrations: () => void
  onOpenDeploy: () => void
  onOpenHistory?: () => void
  chatPanelCollapsed?: boolean
  onToggleChatPanel?: () => void
  activeTab?: WorkspaceTab
  hasPreview?: boolean
  hasBrowser?: boolean
  hasResearch?: boolean
  onTabChange?: (tab: WorkspaceTab) => void
  contextUsage?: { maxTokens: number; usedTokens: number; usage: ContextUsage }
  theme: ComputerTheme
  onThemeToggle: () => void
}) {
  const router = useRouter()
  const { user, userData, workspaces, currentWorkspace, switchWorkspace, signOut } = useAuth()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { projects: sidebarProjects, loading: sidebarProjectsLoading } = useProjectList({
    scope: "user",
    uid: user?.uid ?? null,
  })
  const sidebarRecentBuilds = sidebarProjects.slice(0, 6)

  const selectedWorkspaceName = currentWorkspace?.name ?? "Personal workspace"
  const selectedWorkspaceInitial = selectedWorkspaceName.charAt(0).toUpperCase()

  const isPaidUser = !!userData?.planId && userData.planId !== "free"
  const userInitials = userData?.displayName
    ? userData.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userData?.email?.slice(0, 1).toUpperCase() ?? "U"

  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspace?.id)

  const handleSwitchWorkspace = async (workspaceId: string) => {
    await switchWorkspace(workspaceId)
    router.push("/projects")
  }

  const isActive = session.status === "running" || session.status === "planning"
  const themedGlassSurface = (className: string) => cn(className, theme === "dark" && "dark")

  return (
    <>
      <header className="lotus-glass relative z-30 shrink-0">
        <div className="relative flex h-[52px] w-full items-center">
          {onToggleChatPanel && (
            <button
              type="button"
              onClick={onToggleChatPanel}
              aria-label={chatPanelCollapsed ? "Show chat panel" : "Collapse chat panel"}
              className={cn(
                "absolute top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 shrink-0 items-center justify-center rounded-lg text-muted-foreground/55 transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 sm:flex",
                chatPanelCollapsed
                  ? "left-3"
                  : "left-[calc(32%-1.75rem)] md:left-[calc(31%-1.75rem)] lg:left-[316px] xl:left-[346px] 2xl:left-[376px]",
              )}
            >
              <PanelLeft className="h-[15px] w-[15px]" />
            </button>
          )}

          {/* ── Mobile: title absolutely centered so it's always mid-screen ── */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center sm:hidden">
            <div className="pointer-events-auto flex max-w-[55vw] min-w-0 items-center">
              {isEditingTitle ? (
                <input
                  value={titleDraft}
                  onChange={(e) => onTitleDraftChange(e.target.value)}
                  className="lotus-glass-control w-[44vw] rounded-lg border px-2.5 py-1 text-[13px] font-medium text-foreground outline-none focus:border-ring"
                  placeholder="Session title"
                  aria-label="Edit session title"
                  autoFocus
                />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none"
                      aria-label="Session menu"
                    >
                      <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                        {sessionTitle}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/35 transition-transform duration-150 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    sideOffset={10}
                    className={themedGlassSurface("lotus-glass-strong w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-xl border border-border/60 p-0")}
                  >
                    {/* User profile */}
                    <div className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3">
                      <Avatar className="h-9 w-9 shrink-0 rounded-xl">
                        <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-xl object-cover" />
                        <AvatarFallback className="rounded-xl bg-muted text-[13px] font-bold text-foreground">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {userData?.displayName || userData?.email?.split("@")[0] || "User"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{userData?.email}</p>
                      </div>
                    </div>
                    {contextUsage && (
                      <div className="px-3.5 py-2.5 border-b border-border/40">
                        <Context
                          maxTokens={contextUsage.maxTokens}
                          modelId="anthropic:claude-sonnet-4-6"
                          usage={contextUsage.usage}
                          usedTokens={contextUsage.usedTokens}
                        >
                          <ContextTrigger />
                          <ContextContent>
                            <ContextContentHeader />
                            <ContextContentBody>
                              <ContextInputUsage />
                              <ContextOutputUsage />
                              <ContextReasoningUsage />
                              <ContextCacheUsage />
                            </ContextContentBody>
                            <ContextContentFooter />
                          </ContextContent>
                        </Context>
                      </div>
                    )}
                    <div className="space-y-px p-2">
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onEditTitleStart}>
                        <ItemIcon><Pencil className="h-3.5 w-3.5" /></ItemIcon>
                        Rename session
                      </DropdownMenuItem>
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenIntegrations} disabled={!session.projectId}>
                        <ItemIcon><KeyRound className="h-3.5 w-3.5" /></ItemIcon>
                        Connectors
                      </DropdownMenuItem>
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenDeploy} disabled={!session.projectId}>
                        <ItemIcon><Globe className="h-3.5 w-3.5" /></ItemIcon>
                        Deploy
                      </DropdownMenuItem>
                      {onOpenHistory && (
                        <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenHistory} disabled={!session.projectId}>
                          <ItemIcon><History className="h-3.5 w-3.5" /></ItemIcon>
                          Version history
                        </DropdownMenuItem>
                      )}
                    </div>
                    <DropdownMenuSeparator className="mx-2 bg-border/40" />
                    <div className="space-y-px p-2">
                      <DropdownMenuItem
                        className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] text-destructive focus:bg-destructive/8 focus:text-destructive"
                        onSelect={() => void signOut()}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                          <LogOut className="h-3.5 w-3.5" />
                        </span>
                        Sign out
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* ── Left: nav + title + panel toggle (mirrors chat panel width) ── */}
          <div
            className={cn(
              "flex h-full shrink-0 items-center gap-1 px-3",
              chatPanelCollapsed
                ? "min-w-0"
                : "min-w-0 sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px] 2xl:w-[400px]",
            )}
          >
            {/* Sidebar toggle — opens the nav sidebar */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
              className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/55 transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <PanelLeft className="h-[15px] w-[15px]" />
            </button>

            {/* Session title — desktop only (mobile version is absolutely centered above) */}
            <div className="hidden min-w-0 flex-1 overflow-hidden sm:block">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={titleDraft}
                    onChange={(e) => onTitleDraftChange(e.target.value)}
                    className="lotus-glass-control min-w-0 flex-1 rounded-lg border px-2.5 py-1 text-[13px] font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Session title"
                    aria-label="Edit session title"
                    autoFocus
                  />
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[12px]"
                      onClick={onEditTitleCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5 text-[12px]"
                      disabled={titleSaving || !titleDraft.trim()}
                      onClick={() => void onTitleSave()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group -mx-1 flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                      aria-label="Session menu"
                    >
                      <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                        {sessionTitle}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/35 transition-transform duration-150 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    sideOffset={10}
                    className={themedGlassSurface("lotus-glass-strong w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-xl border border-border/60 p-0")}
                  >
                    {/* User profile */}
                    <div className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3">
                      <Avatar className="h-9 w-9 shrink-0 rounded-xl">
                        <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-xl object-cover" />
                        <AvatarFallback className="rounded-xl bg-muted text-[13px] font-bold text-foreground">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {userData?.displayName || userData?.email?.split("@")[0] || "User"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{userData?.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                        {planLabel}
                      </span>
                    </div>

                    {/* Credits */}
                    <div className="px-2 pt-2">
                      <div className="lotus-glass-inset rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                              <Zap className="h-3 w-3 text-muted-foreground" />
                            </span>
                            <p className="text-[12px] font-semibold text-foreground">Credits</p>
                          </div>
                          <span className="text-[13px] font-semibold tabular-nums text-foreground">{remainingTokens} left</span>
                        </div>
                        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted/70">
                          <div
                            className="h-full rounded-full bg-foreground transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(4, (remainingTokens / 1000) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Context usage */}
                    {contextUsage && (
                      <div className="px-2 pt-2">
                        <div className="lotus-glass-inset rounded-xl px-3 py-2.5">
                          <Context
                            maxTokens={contextUsage.maxTokens}
                            modelId="anthropic:claude-sonnet-4-6"
                            usage={contextUsage.usage}
                            usedTokens={contextUsage.usedTokens}
                          >
                            <ContextTrigger />
                            <ContextContent>
                              <ContextContentHeader />
                              <ContextContentBody>
                                <ContextInputUsage />
                                <ContextOutputUsage />
                                <ContextReasoningUsage />
                                <ContextCacheUsage />
                              </ContextContentBody>
                              <ContextContentFooter />
                            </ContextContent>
                          </Context>
                        </div>
                      </div>
                    )}

                    {/* Workspace switcher */}
                    <div className="px-2 pt-3">
                      <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                        Workspace
                      </p>
                      <div className="flex items-center gap-2.5 rounded-xl bg-muted/45 px-2.5 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-foreground">
                          {(currentWorkspace?.name ?? "P").charAt(0).toUpperCase()}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                          {currentWorkspace?.name ?? "Personal"}
                        </p>
                        <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />
                      </div>

                      {isPaidUser ? (
                        <>
                          {otherWorkspaces.map((ws) => (
                            <button
                              key={ws.id}
                              type="button"
                              onClick={() => void handleSwitchWorkspace(ws.id)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                                {ws.name.charAt(0).toUpperCase()}
                              </span>
                              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/80">
                                {ws.name}
                              </p>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setCreateModalOpen(true)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border/80 text-muted-foreground">
                              <Plus className="h-3 w-3" />
                            </span>
                            <p className="text-[13px] font-medium text-muted-foreground">Add workspace</p>
                          </button>
                        </>
                      ) : (
                          <div className="lotus-glass-inset mt-1 flex items-center gap-2.5 rounded-xl border border-border/40 px-2.5 py-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Lock className="h-3 w-3 text-muted-foreground/60" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-muted-foreground">Multiple workspaces</p>
                            <Link
                              href="/pricing"
                              className="text-[11px] font-semibold text-foreground underline underline-offset-2 hover:text-foreground/80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Upgrade to unlock
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    <DropdownMenuSeparator className="mx-2 mt-3 bg-border/40" />

                    {/* Session actions */}
                    <div className="space-y-px p-2">
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onEditTitleStart}>
                        <ItemIcon><Pencil className="h-3.5 w-3.5" /></ItemIcon>
                        Rename session
                      </DropdownMenuItem>
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenIntegrations} disabled={!session.projectId}>
                        <ItemIcon><KeyRound className="h-3.5 w-3.5" /></ItemIcon>
                        Connectors
                      </DropdownMenuItem>
                      <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenDeploy} disabled={!session.projectId}>
                        <ItemIcon><Globe className="h-3.5 w-3.5" /></ItemIcon>
                        Deploy
                      </DropdownMenuItem>
                      {onOpenHistory && (
                        <DropdownMenuItem className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60" onSelect={onOpenHistory} disabled={!session.projectId}>
                          <ItemIcon><History className="h-3.5 w-3.5" /></ItemIcon>
                          Version history
                        </DropdownMenuItem>
                      )}
                    </div>

                    <DropdownMenuSeparator className="mx-2 bg-border/40" />

                    {/* External links */}
                    <div className="space-y-px p-2">
                      <DropdownMenuItem asChild disabled={!session.previewUrl} className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60">
                        <a href={session.previewUrl || "#"} target="_blank" rel="noreferrer">
                          <ItemIcon><Monitor className="h-3.5 w-3.5" /></ItemIcon>
                          Open preview
                          <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/40" />
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild disabled={!liveSiteUrl} className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60">
                        <a href={liveSiteUrl || "#"} target="_blank" rel="noreferrer">
                          <ItemIcon><Globe2 className="h-3.5 w-3.5" /></ItemIcon>
                          Open live site
                          <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/40" />
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild disabled={!projectIntegration?.githubRepoUrl} className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60">
                        <a href={projectIntegration?.githubRepoUrl || "#"} target="_blank" rel="noreferrer">
                          <ItemIcon><GitBranch className="h-3.5 w-3.5" /></ItemIcon>
                          <span className="truncate">{projectIntegration?.githubRepoFullName || "GitHub repository"}</span>
                          <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40" />
                        </a>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator className="mx-2 bg-border/40" />

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                      <div className="lotus-glass-inset rounded-xl border border-border/40 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Files</p>
                        <p className="mt-1.5 text-[16px] font-semibold text-foreground">{projectFileCount}</p>
                      </div>
                      <div className="lotus-glass-inset rounded-xl border border-border/40 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Supabase</p>
                        <p className="mt-1.5 text-[13px] font-semibold">
                          {projectIntegration?.supabaseProjectRef
                            ? <span className="text-success-soft-foreground">Connected</span>
                            : <span className="text-muted-foreground/50">Not set up</span>
                          }
                        </p>
                      </div>
                    </div>

                    <DropdownMenuSeparator className="mx-2 bg-border/40" />

                    {/* Utility */}
                    <div className="space-y-px p-2">
                      <DropdownMenuItem
                        className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60"
                        onSelect={() => void navigator.clipboard?.writeText(session.id)}
                      >
                        <ItemIcon><Copy className="h-3.5 w-3.5" /></ItemIcon>
                        Copy session ID
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] focus:bg-muted/60">
                        <Link href="/settings">
                          <ItemIcon><LayoutPanelLeft className="h-3.5 w-3.5" /></ItemIcon>
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="h-9 gap-2.5 rounded-xl px-2.5 text-[13px] text-destructive focus:bg-destructive/8 focus:text-destructive"
                        onSelect={() => void signOut()}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                          <LogOut className="h-3.5 w-3.5" />
                        </span>
                        Sign out
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Panel toggle — right edge of left section */}
          </div>

          {/* ── Right: workspace toolbar ── */}
          <div className="flex h-full min-w-0 flex-1 items-center justify-end px-3 sm:justify-between sm:px-4">
            {/* Tab group — always visible on desktop */}
            <div className="hidden items-center gap-2.5 sm:flex">
              {onTabChange && (
                <div className="lotus-glass-control flex items-center rounded-full border p-0.5">
                  {([
                    { id: "preview" as WorkspaceTab, label: "Preview", show: true },
                    { id: "browser" as WorkspaceTab, label: "Browser", show: !!hasBrowser },
                    { id: "research" as WorkspaceTab, label: "Research", show: !!hasResearch },
                  ] as Array<{ id: WorkspaceTab; label: string; show: boolean }>)
                    .filter((t) => t.show || t.id === "preview")
                    .map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                          "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                          activeTab === tab.id
                            ? "bg-card/88 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                </div>
              )}
              {isActive && <StatusBadge status={session.status} />}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onThemeToggle}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="lotus-glass-control inline-flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={onOpenIntegrations}
                disabled={!session.projectId}
                aria-label="Connectors"
                className="lotus-glass-control hidden h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-30 sm:inline-flex"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Connectors
              </button>

              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  disabled={!session.projectId}
                  aria-label="Version history"
                  className="lotus-glass-control hidden h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-30 sm:inline-flex"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const url = session.previewUrl || window.location.href
                  void navigator.clipboard?.writeText(url)
                }}
                disabled={!session.projectId}
                aria-label="Share"
                className="lotus-glass-control hidden h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-30 sm:inline-flex"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>

              <button
                type="button"
                onClick={onOpenDeploy}
                disabled={!session.projectId}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[12px] font-semibold text-background shadow-sm transition-all hover:bg-foreground/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-30"
              >
                <Globe className="h-3.5 w-3.5" />
                Deploy
              </button>
            </div>
          </div>
        </div>

        {/* Animated progress bar — scans across header bottom when agent is active */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 h-[1.5px] overflow-hidden"
            >
              <motion.div
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-foreground to-transparent opacity-35"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {titleError && (
          <p className="px-4 pb-1.5 text-xs text-destructive">{titleError}</p>
        )}
      </header>

      <CreateWorkspaceModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* ── Nav sidebar ── */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen} modal={false}>
        <SheetPortal>
          <SheetPrimitive.Content
            className={themedGlassSurface("lotus-glass-strong data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed bottom-2 left-2 top-2 z-50 flex w-[260px] flex-col overflow-hidden rounded-[1.35rem] border border-border/50 shadow-2xl shadow-foreground/10 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500")}
          >
            <SheetTitle className="sr-only">Navigation sidebar</SheetTitle>
            <SheetDescription className="sr-only">App navigation and workspace switcher</SheetDescription>

            {/* Sidebar top bar — matches main header height */}
            <div className="lotus-glass-inset flex h-[52px] shrink-0 items-center justify-between border-b border-border/35 px-3">
              <LotusLogo size={22} />
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="lotus-glass-control flex h-7 w-7 items-center justify-center rounded-full border border-border/55 text-muted-foreground transition-all duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  aria-label="Search"
                >
                  <Search className="h-[15px] w-[15px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="lotus-glass-control flex h-7 w-7 items-center justify-center rounded-full border border-border/55 text-muted-foreground transition-all duration-150 hover:border-border-strong hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  aria-label="Close sidebar"
                >
                  <PanelLeft className="h-[15px] w-[15px]" />
                </button>
              </div>
            </div>

            {/* Workspace dropdown */}
            <div className="px-2 pb-2 pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="lotus-glass-control group flex h-11 w-full items-center gap-2.5 rounded-2xl border px-3 text-left shadow-sm transition-all hover:border-border-strong hover:bg-muted"
                    aria-label="Switch workspace"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background shadow-sm">
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
                <DropdownMenuContent align="start" sideOffset={8} className={themedGlassSurface("lotus-glass-strong w-[220px] overflow-hidden rounded-2xl border-border p-1.5")}>
                  <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">
                    Workspaces
                  </div>
                  <DropdownMenuItem disabled className="flex cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2.5 opacity-100 focus:bg-muted">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                      {selectedWorkspaceInitial}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                      {selectedWorkspaceName}
                    </span>
                    <Check className="h-3.5 w-3.5 shrink-0 text-foreground" />
                  </DropdownMenuItem>
                  {isPaidUser ? (
                    <>
                      {otherWorkspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          onSelect={() => void (async () => { await switchWorkspace(ws.id); setSidebarOpen(false); router.push("/projects") })()}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 focus:bg-muted"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                            {ws.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/80">{ws.name}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem
                        onSelect={() => setCreateModalOpen(true)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 focus:bg-muted"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[13px] font-medium text-muted-foreground">Add workspace</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <div className="lotus-glass-inset mx-1 mt-1 flex items-center gap-2.5 rounded-2xl border border-border/50 px-2.5 py-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-muted-foreground">Switch workspaces</p>
                        <Link href="/pricing" className="text-[11px] font-semibold text-foreground underline underline-offset-2 hover:text-foreground/80" onClick={(e) => e.stopPropagation()}>
                          Upgrade to unlock
                        </Link>
                      </div>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Divider */}
            <div className="lotus-glass-divider mx-3 mb-2 border-t" />

            {/* Recent builds header */}
            <div className="mb-1.5 flex items-center justify-between px-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recent builds</span>
              <span className="rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{sidebarRecentBuilds.length}</span>
            </div>

            {/* Recent builds list */}
            <div className="flex-1 overflow-y-auto pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {sidebarProjectsLoading ? (
                <div className="space-y-2 px-3 pt-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="lotus-glass-inset h-10 animate-pulse rounded-2xl" style={{ opacity: 1 - i * 0.15 }} />
                  ))}
                </div>
              ) : sidebarRecentBuilds.length === 0 ? (
                <div className="lotus-glass-inset mx-3 rounded-2xl border border-border/50 px-4 py-6 text-center">
                  <p className="text-[13px] font-medium text-foreground">No builds yet</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Start with a prompt to see your builds here.</p>
                </div>
              ) : (
                <div className="space-y-1 px-2">
                  {sidebarRecentBuilds.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSidebarOpen(false); router.push(p.kind === "computer" ? `/computer/${p.id}` : `/project/${p.id}`) }}
                      className="group/row flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-snug text-foreground/85 group-hover/row:text-foreground">
                          {buildTitle(p.prompt)}
                        </span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {p.kind === "computer" ? "Computer agent" : "Website build"}
                        </span>
                      </span>
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform group-hover/row:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User row */}
            <div className="lotus-glass-inset shrink-0 border-t border-border/35 px-3 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="lotus-glass-control flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2 py-2 transition-all hover:border-border/60 hover:bg-muted">
                    <Avatar className="h-8 w-8 shrink-0 rounded-full">
                      <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-full object-cover" />
                      <AvatarFallback className="rounded-full bg-foreground text-[10px] font-semibold text-background">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                        {userData?.displayName || userData?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">{planLabel} plan</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" sideOffset={6} className={themedGlassSurface("lotus-glass-strong w-[200px] rounded-2xl border-border p-2")}>
                  <DropdownMenuItem className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted" onSelect={() => router.push("/pricing")}>
                    <CreditCard className="mr-2 h-3.5 w-3.5" />
                    Billing &amp; Plans
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-foreground focus:bg-muted" onSelect={() => router.push("/settings")}>
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-border/50" />
                  <DropdownMenuItem className="h-10 cursor-pointer rounded-xl px-3 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => void signOut()}>
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetPrimitive.Content>
        </SheetPortal>
      </Sheet>
    </>
  )
}
