"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Github,
  Globe2,
  KeyRound,
  LayoutPanelLeft,
  Lock,
  LogOut,
  Monitor,
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
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {children}
    </span>
  )
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

  return (
    <>
      <header className="relative z-30 shrink-0 border-b border-border/60 bg-sidebar/90 backdrop-blur-sm">
        <div className="grid h-12 w-full grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-4">

          {/* ── Left: back + logo ── */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Image
              src="/Images/lotus-official-logo.png"
              alt="Lotus"
              width={28}
              height={28}
              className="shrink-0 object-contain"
            />
          </div>

          {/* ── Centre: session title dropdown ── */}
          <div className="flex items-center justify-center">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => onTitleDraftChange(e.target.value)}
                  className="w-[min(38vw,16rem)] rounded-lg border border-border/60 bg-background px-3 py-1 text-[13px] text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Enter a session title"
                  aria-label="Edit session title"
                  autoFocus
                />
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg text-[12px]" onClick={onEditTitleCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 rounded-lg text-[12px]"
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
                    className="group flex min-w-0 max-w-[min(48vw,20rem)] items-center gap-1.5 rounded-xl px-2 py-1.5 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                    aria-label="Open session menu"
                  >
                    <span className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                      {sessionTitle}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  sideOffset={8}
                  className="w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-2xl border border-border/60 bg-sidebar p-0 shadow-xl shadow-black/10"
                >
                  {/* ── User profile header ── */}
                  <div className="flex items-center gap-3 border-b border-border/50 px-3.5 py-3">
                    <Avatar className="h-9 w-9 shrink-0 rounded-xl">
                      <AvatarImage src={userData?.photoURL ?? undefined} className="rounded-xl object-cover" />
                      <AvatarFallback className="rounded-xl bg-accent/12 text-[13px] font-bold text-accent">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {userData?.displayName || userData?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{userData?.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                      {planLabel}
                    </span>
                  </div>

                  {/* ── Credits ── */}
                  <div className="px-2 pt-2">
                    <div className="rounded-xl bg-background px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                            <Zap className="h-3 w-3 text-accent" />
                          </span>
                          <p className="text-[12px] font-semibold text-foreground">Credits</p>
                        </div>
                        <span className="text-[13px] font-semibold tabular-nums text-foreground">{remainingTokens} left</span>
                      </div>
                      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(4, (remainingTokens / 1000) * 100))}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* ── Workspace switcher ── */}
                  <div className="px-2 pt-3">
                    <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55">
                      Workspace
                    </p>

                    {/* Current workspace */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-2.5 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[10px] font-bold text-accent">
                        {(currentWorkspace?.name ?? "P").charAt(0).toUpperCase()}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                        {currentWorkspace?.name ?? "Personal"}
                      </p>
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                    </div>

                    {/* Other workspaces — paid only */}
                    {isPaidUser ? (
                      <>
                        {otherWorkspaces.map((ws) => (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => void handleSwitchWorkspace(ws.id)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">
                              {ws.name.charAt(0).toUpperCase()}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/80">
                              {ws.name}
                            </p>
                          </button>
                        ))}

                        {/* Add workspace */}
                        <button
                          type="button"
                          onClick={() => setCreateModalOpen(true)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/80 text-muted-foreground">
                            <Plus className="h-3 w-3" />
                          </span>
                          <p className="text-[13px] font-medium text-muted-foreground">Add workspace</p>
                        </button>
                      </>
                    ) : (
                      /* Free plan — upgrade gate */
                      <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/30 px-2.5 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Lock className="h-3 w-3 text-muted-foreground/60" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-muted-foreground">Switch workspaces</p>
                          <Link
                            href="/pricing"
                            className="text-[11px] font-semibold text-accent underline underline-offset-2 hover:text-accent/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Upgrade to unlock
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator className="mx-2 mt-3 bg-border/50" />

                  {/* ── Session actions ── */}
                  <div className="p-2 space-y-px">
                    <DropdownMenuItem className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60" onSelect={onEditTitleStart}>
                      <ItemIcon><Pencil className="h-3.5 w-3.5" /></ItemIcon>
                      Rename session
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60" onSelect={onOpenIntegrations} disabled={!session.projectId}>
                      <ItemIcon><KeyRound className="h-3.5 w-3.5" /></ItemIcon>
                      Connectors
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60" onSelect={onOpenDeploy} disabled={!session.projectId}>
                      <ItemIcon><Rocket className="h-3.5 w-3.5" /></ItemIcon>
                      Deploy
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator className="mx-2 bg-border/50" />

                  {/* ── External links ── */}
                  <div className="p-2 space-y-px">
                    <DropdownMenuItem asChild disabled={!session.previewUrl} className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60">
                      <a href={session.previewUrl || "#"} target="_blank" rel="noreferrer">
                        <ItemIcon><Monitor className="h-3.5 w-3.5" /></ItemIcon>
                        Open preview
                        <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/50" />
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={!liveSiteUrl} className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60">
                      <a href={liveSiteUrl || "#"} target="_blank" rel="noreferrer">
                        <ItemIcon><Globe2 className="h-3.5 w-3.5" /></ItemIcon>
                        Open live site
                        <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/50" />
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild disabled={!projectIntegration?.githubRepoUrl} className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60">
                      <a href={projectIntegration?.githubRepoUrl || "#"} target="_blank" rel="noreferrer">
                        <ItemIcon><Github className="h-3.5 w-3.5" /></ItemIcon>
                        <span className="truncate">{projectIntegration?.githubRepoFullName || "GitHub repository"}</span>
                        <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/50" />
                      </a>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator className="mx-2 bg-border/50" />

                  {/* ── Stats ── */}
                  <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                    <div className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Files</p>
                      <p className="mt-1.5 text-[15px] font-semibold text-foreground">{projectFileCount}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Supabase</p>
                      <p className="mt-1.5 text-[13px] font-semibold text-foreground">
                        {projectIntegration?.supabaseProjectRef
                          ? <span className="text-accent">Connected</span>
                          : "Not set up"
                        }
                      </p>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="mx-2 bg-border/50" />

                  {/* ── Utility ── */}
                  <div className="p-2 space-y-px">
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60"
                      onSelect={() => void navigator.clipboard?.writeText(session.id)}
                    >
                      <ItemIcon><Copy className="h-3.5 w-3.5" /></ItemIcon>
                      Copy session ID
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 focus:bg-muted/60">
                      <Link href="/settings">
                        <ItemIcon><LayoutPanelLeft className="h-3.5 w-3.5" /></ItemIcon>
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-2.5 text-[13px] gap-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => void signOut()}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <LogOut className="h-3.5 w-3.5" />
                      </span>
                      Sign out
                    </DropdownMenuItem>
                  </div>

                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* ── Right: connect + deploy ── */}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={onOpenIntegrations}
              disabled={!session.projectId}
              className="hidden sm:inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-[12px] font-semibold text-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <KeyRound className="h-3 w-3" />
              Connect
            </button>
            <button
              type="button"
              onClick={onOpenDeploy}
              disabled={!session.projectId}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-40"
            >
              <Rocket className="h-3 w-3" />
              Deploy
            </button>
          </div>
        </div>

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
