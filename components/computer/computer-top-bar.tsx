"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Github,
  Globe2,
  History,
  KeyRound,
  LayoutPanelLeft,
  Lock,
  LogOut,
  Monitor,
  PanelLeft,
  Pencil,
  Plus,
  Rocket,
  Zap,
} from "lucide-react"
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
import type { ComputerSessionResponse } from "@/components/computer/session-types"

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
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        Building
      </div>
    )
  }
  if (status === "planning") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        Planning
      </div>
    )
  }
  if (status === "complete") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        Ready
      </div>
    )
  }
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
}: {
  session: ComputerSessionResponse
  sessionTitle: string
  firstPrompt: string
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
}) {
  const router = useRouter()
  const { user, userData, workspaces, currentWorkspace, switchWorkspace, signOut } = useAuth()
  const [createModalOpen, setCreateModalOpen] = useState(false)

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

  return (
    <>
      <header className="relative z-30 shrink-0 bg-background">
        <div className="flex h-[52px] w-full items-center">

          {/* ── Left: nav + title + panel toggle (mirrors chat panel width) ── */}
          <div
            className={cn(
              "flex h-full shrink-0 items-center gap-1 border-b border-border/40 px-3",
              chatPanelCollapsed
                ? "min-w-0 border-r-0"
                : "min-w-0 sm:w-[38%] sm:border-r sm:border-border/40 md:w-[37%] lg:w-[380px] xl:w-[420px] 2xl:w-[460px]",
            )}
          >
            <Link
              href="/"
              aria-label="Back to projects"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-all hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-[15px] w-[15px]" />
            </Link>

            {/* Session title — takes up remaining space in left section */}
            <div className="min-w-0 flex-1 overflow-hidden">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={titleDraft}
                    onChange={(e) => onTitleDraftChange(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[13px] font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
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
                    className="w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-xl border border-border/60 bg-background p-0 shadow-xl shadow-black/8"
                  >
                    {/* User profile */}
                    <div className="flex items-center gap-3 border-b border-border/40 px-3.5 py-3">
                      <Avatar className="h-9 w-9 shrink-0 rounded-xl">
                        <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-xl object-cover" />
                        <AvatarFallback className="rounded-xl bg-primary/10 text-[13px] font-bold text-primary">
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
                      <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                              <Zap className="h-3 w-3 text-primary" />
                            </span>
                            <p className="text-[12px] font-semibold text-foreground">Credits</p>
                          </div>
                          <span className="text-[13px] font-semibold tabular-nums text-foreground">{remainingTokens} left</span>
                        </div>
                        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(4, (remainingTokens / 1000) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Workspace switcher */}
                    <div className="px-2 pt-3">
                      <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                        Workspace
                      </p>
                      <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-2.5 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                          {(currentWorkspace?.name ?? "P").charAt(0).toUpperCase()}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                          {currentWorkspace?.name ?? "Personal"}
                        </p>
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
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
                        <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Lock className="h-3 w-3 text-muted-foreground/60" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-muted-foreground">Multiple workspaces</p>
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
                        <ItemIcon><Rocket className="h-3.5 w-3.5" /></ItemIcon>
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
                          <ItemIcon><Github className="h-3.5 w-3.5" /></ItemIcon>
                          <span className="truncate">{projectIntegration?.githubRepoFullName || "GitHub repository"}</span>
                          <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40" />
                        </a>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator className="mx-2 bg-border/40" />

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                      <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Files</p>
                        <p className="mt-1.5 text-[16px] font-semibold text-foreground">{projectFileCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Supabase</p>
                        <p className="mt-1.5 text-[13px] font-semibold">
                          {projectIntegration?.supabaseProjectRef
                            ? <span className="text-emerald-500">Connected</span>
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
            {onToggleChatPanel && (
              <button
                type="button"
                onClick={onToggleChatPanel}
                aria-label={chatPanelCollapsed ? "Show chat panel" : "Collapse chat panel"}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-all hover:bg-muted hover:text-foreground sm:flex"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ── Right: workspace toolbar ── */}
          <div className="flex h-full min-w-0 flex-1 items-center justify-between border-b border-border/40 px-4">
            {/* Status badge — live state of the session */}
            <StatusBadge status={session.status} />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenIntegrations}
                disabled={!session.projectId}
                aria-label="Integrations"
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-border/50 px-3 text-[12px] font-medium text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 sm:inline-flex"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Connect
              </button>

              <button
                type="button"
                onClick={onOpenHistory}
                disabled={!session.projectId || !onOpenHistory}
                aria-label="Version history"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/50 px-2.5 text-muted-foreground transition-all hover:border-border/80 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 sm:px-3"
              >
                <History className="h-3.5 w-3.5" />
                <span className="hidden text-[12px] font-medium sm:inline">History</span>
              </button>

              <button
                type="button"
                onClick={onOpenDeploy}
                disabled={!session.projectId}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12px] font-semibold text-background transition-all hover:bg-foreground/85 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
              >
                <Rocket className="h-3 w-3" />
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
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
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
    </>
  )
}
