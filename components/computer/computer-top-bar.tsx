"use client"

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

const titleMenuItemClass = "h-9 rounded-xl px-2.5 text-sm focus:bg-secondary/80 focus:text-foreground"

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
  const hasPreview = Boolean(session.previewUrl)

  return (
    <header className="relative z-30 shrink-0 bg-transparent sm:border-b sm:border-border sm:bg-card/95">
      <div className="grid h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        <div className="flex shrink-0 items-center">
          <Link
            href="/"
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex min-w-0 items-center justify-center px-1">
          {isEditingTitle ? (
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              <input
                value={titleDraft}
                onChange={(event) => onTitleDraftChange(event.target.value)}
                className="min-w-0 max-w-[min(58vw,26rem)] flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-center text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Enter a session title"
                aria-label="Edit session title"
                autoFocus
              />
              <div className="flex shrink-0 gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={onEditTitleCancel}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
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
                  className="group flex min-w-0 max-w-[min(58vw,26rem)] items-center gap-1.5 rounded-2xl px-3 py-1.5 text-center transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                  aria-label="Open session menu"
                >
                  <span className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground lg:text-[15px]">
                    {sessionTitle}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                sideOffset={10}
                className="w-[calc(100vw-1.5rem)] max-w-[21rem] rounded-2xl border-border bg-card p-2 shadow-2xl"
              >
                <DropdownMenuItem asChild className={titleMenuItemClass}>
                  <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" />
                    Go to projects
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuLabel className="px-2 py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
                      {(projectIntegration?.name || sessionTitle).trim().charAt(0).toUpperCase()}
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

                <DropdownMenuItem className={titleMenuItemClass} onSelect={onEditTitleStart}>
                  <Pencil className="h-4 w-4" />
                  Rename session
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={titleMenuItemClass}
                  onSelect={onOpenIntegrations}
                  disabled={!session.projectId}
                >
                  <KeyRound className="h-4 w-4" />
                  Connectors
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={titleMenuItemClass}
                  onSelect={onOpenDeploy}
                  disabled={!session.projectId}
                >
                  <Rocket className="h-4 w-4" />
                  Deploy
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem asChild disabled={!session.previewUrl} className={titleMenuItemClass}>
                  <a href={session.previewUrl || "#"} target="_blank" rel="noreferrer">
                    <Monitor className="h-4 w-4" />
                    Open preview
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!liveSiteUrl} className={titleMenuItemClass}>
                  <a href={liveSiteUrl || "#"} target="_blank" rel="noreferrer">
                    <Globe2 className="h-4 w-4" />
                    Open live site
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild disabled={!projectIntegration?.githubRepoUrl} className={titleMenuItemClass}>
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
                  className={titleMenuItemClass}
                  onSelect={() => {
                    void navigator.clipboard?.writeText(session.id)
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy session ID
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={titleMenuItemClass}>
                  <Link href="/settings">
                    <LayoutPanelLeft className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={titleMenuItemClass}>
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

        <div className="flex shrink-0 items-center justify-end">
          {hasPreview && (
            <a
              href={session.previewUrl!}
              target="_blank"
              rel="noreferrer"
              className="hidden h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
            >
              <Monitor className="h-3.5 w-3.5" />
              Preview
            </a>
          )}
        </div>
      </div>

      {titleError && (
        <p className="px-3 pt-1.5 text-xs text-destructive sm:px-4 lg:px-6">{titleError}</p>
      )}
    </header>
  )
}
