"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Copy,
  ExternalLink,
  Github,
  Globe2,
  KeyRound,
  LayoutPanelLeft,
  Monitor,
  Pencil,
  Rocket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

const menuItemClass = "h-9 rounded-xl px-2.5 text-sm focus:bg-secondary/80 focus:text-foreground"

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
  const projectInitial = (projectIntegration?.name || sessionTitle).trim().charAt(0).toUpperCase()

  return (
    <header className="relative z-30 shrink-0 border-b border-border/60 bg-sidebar/90 backdrop-blur-sm">
      <div className="grid h-12 w-full grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-4">

        {/* ── Left: back arrow + logo ── */}
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

        {/* ── Centre: project name ── */}
        <div className="flex items-center justify-center">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={(e) => onTitleDraftChange(e.target.value)}
                className="w-[min(40vw,18rem)] rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Enter a session title"
                aria-label="Edit session title"
                autoFocus
              />
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg" onClick={onEditTitleCancel}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg"
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
                  className="group flex min-w-0 max-w-[min(50vw,22rem)] items-center gap-1.5 rounded-xl px-2 py-1 transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                  aria-label="Open session menu"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[10px] font-bold text-accent-soft-foreground">
                    {projectInitial}
                  </span>
                  <span className="min-w-0 truncate text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                    {sessionTitle}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60 transition group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="center"
                sideOffset={10}
                className="w-[calc(100vw-1.5rem)] max-w-[21rem] rounded-2xl border-border bg-card p-2 shadow-2xl"
              >
                <DropdownMenuItem asChild className={menuItemClass}>
                  <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" />
                    Go to projects
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuLabel className="px-2 py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
                      {projectInitial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {projectIntegration?.name || sessionTitle}
                      </p>
                      <p className="truncate text-[11px] font-normal text-muted-foreground">
                        {session.projectId ? `Project ${session.projectId.slice(0, 8)}` : "Computer session"}
                      </p>
                    </div>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {planLabel}
                    </span>
                  </div>
                </DropdownMenuLabel>

                <div className="my-2 rounded-xl bg-secondary px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Credits</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Available for computer runs</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-foreground">{remainingTokens} left</span>
                  </div>
                </div>

                <DropdownMenuItem className={menuItemClass} onSelect={onEditTitleStart}>
                  <Pencil className="h-4 w-4" />
                  Rename session
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemClass} onSelect={onOpenIntegrations} disabled={!session.projectId}>
                  <KeyRound className="h-4 w-4" />
                  Connectors
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemClass} onSelect={onOpenDeploy} disabled={!session.projectId}>
                  <Rocket className="h-4 w-4" />
                  Deploy
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem asChild disabled={!session.previewUrl} className={menuItemClass}>
                  <a href={session.previewUrl || "#"} target="_blank" rel="noreferrer">
                    <Monitor className="h-4 w-4" />
                    Open preview
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!liveSiteUrl} className={menuItemClass}>
                  <a href={liveSiteUrl || "#"} target="_blank" rel="noreferrer">
                    <Globe2 className="h-4 w-4" />
                    Open live site
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!projectIntegration?.githubRepoUrl} className={menuItemClass}>
                  <a href={projectIntegration?.githubRepoUrl || "#"} target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                    {projectIntegration?.githubRepoFullName || "GitHub repository"}
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <div className="grid grid-cols-2 gap-1.5 px-1 py-1">
                  <div className="rounded-xl border border-border bg-background px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Files</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{projectFileCount}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-2.5 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Supabase</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {projectIntegration?.supabaseProjectRef ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem
                  className={menuItemClass}
                  onSelect={() => void navigator.clipboard?.writeText(session.id)}
                >
                  <Copy className="h-4 w-4" />
                  Copy session ID
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={menuItemClass}>
                  <Link href="/settings">
                    <LayoutPanelLeft className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={menuItemClass}>
                  <Link href="/help">
                    <BookOpen className="h-4 w-4" />
                    Help
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </Link>
                </DropdownMenuItem>
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
  )
}
