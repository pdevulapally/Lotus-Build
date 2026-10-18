"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ChevronDown,
  History,
  Moon,
  Sun,
} from "lucide-react"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { SessionMenuContent } from "@/components/computer/session-menu"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ComputerSessionResponse } from "@/components/computer/session-types"
import type { ContextUsage } from "@/components/ai-elements/context"

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
  onOpenHistory,
  onOpenNavigation,
  navigationOpen,
  workspacePanelOpen,
  onToggleWorkspacePanel,
  contextUsage,
  theme,
  onThemeToggle,
}: {
  session: ComputerSessionResponse
  sessionTitle: string
  firstPrompt: string | undefined
  projectIntegration: ComputerProjectIntegration | null
  projectFileCount: number | null
  remainingTokens: number | null
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
  onOpenHistory?: () => void
  onOpenNavigation: () => void
  navigationOpen: boolean
  workspacePanelOpen: boolean
  onToggleWorkspacePanel: () => void
  contextUsage?: { maxTokens: number; usedTokens: number; usage: ContextUsage }
  theme: ComputerTheme
  onThemeToggle: () => void
}) {

  const shouldReduceMotion = useReducedMotion()

  const isActive = session.status === "running" || session.status === "planning"

  return (
    <>
      <header className="relative z-30 shrink-0 bg-background" aria-label="Computer workspace header">
        <div className="relative flex h-[52px] w-full items-center">
          {/* ── Mobile: title absolutely centered so it's always mid-screen ── */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center sm:hidden">
            <div className="pointer-events-auto flex max-w-[38vw] min-w-0 -translate-x-6 items-center">
              {isEditingTitle ? (
                <input
                  value={titleDraft}
                  onChange={(e) => onTitleDraftChange(e.target.value)}
                  className="bg-card w-[44vw] rounded-lg border px-2.5 py-1 text-[13px] font-medium text-foreground outline-none focus:border-ring"
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
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <SessionMenuContent align="center" session={session} projectFileCount={projectFileCount} remainingTokens={remainingTokens} planLabel={planLabel} liveSiteUrl={liveSiteUrl} contextUsage={contextUsage} onRename={onEditTitleStart} onOpenHistory={onOpenHistory} dark={theme === "dark"} />
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* ── Left: nav + title + panel toggle (mirrors chat panel width) ── */}
          <div
            className={cn(
              "flex h-full min-w-0 flex-1 items-center gap-1 px-3",
            )}
          >
            {/* Sidebar toggle — opens the nav sidebar */}
            <button
              id="computer-navigation-toggle"
              type="button"
              onClick={onOpenNavigation}
              aria-label="Open sidebar"
              aria-expanded={navigationOpen}
              aria-controls="computer-mobile-navigation"
              className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
            >
              <SidebarToggleIcon className="size-[18px]" side="left" open={navigationOpen} />
            </button>

            {/* Session title — desktop only (mobile version is absolutely centered above) */}
            <div className="hidden min-w-0 flex-1 overflow-hidden sm:block">
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={titleDraft}
                    onChange={(e) => onTitleDraftChange(e.target.value)}
                    className="bg-card min-w-0 flex-1 rounded-lg border px-2.5 py-1 text-[13px] font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
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
                      className="group -mx-1 flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label="Session menu"
                    >
                      <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                        {sessionTitle}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>

                  <SessionMenuContent align="start" session={session} projectFileCount={projectFileCount} remainingTokens={remainingTokens} planLabel={planLabel} liveSiteUrl={liveSiteUrl} contextUsage={contextUsage} onRename={onEditTitleStart} onOpenHistory={onOpenHistory} dark={theme === "dark"} />
                </DropdownMenu>
              )}
            </div>

            {/* Panel toggle — right edge of left section */}
          </div>

          {/* ── Right: workspace toolbar ── */}
          <div className="flex h-full shrink-0 items-center justify-end gap-2 px-3">
            {/* Tab group — always visible on desktop */}
            <div className="hidden items-center gap-2.5 sm:flex">
              {isActive && <StatusBadge status={session.status} />}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onThemeToggle}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>

              <></>

              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  disabled={!session.projectId}
                  aria-label="Version history"
                  className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:inline-flex"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                id="computer-workspace-toggle"
                type="button"
                onClick={onToggleWorkspacePanel}
                aria-label={workspacePanelOpen ? "Close preview panel" : "Open preview panel"}
                aria-expanded={workspacePanelOpen}
                aria-controls="computer-preview-sidebar"
                title={workspacePanelOpen ? "Close preview panel" : "Open preview panel"}
                className={cn("inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", workspacePanelOpen && "bg-muted text-foreground")}
              >
                <SidebarToggleIcon className="size-[18px]" side="right" open={workspacePanelOpen} />
              </button>

              <></>

              <></>
            </div>
          </div>
        </div>

        {/* Animated progress bar — scans across header bottom when agent is active */}
        <AnimatePresence>
          {isActive && !shouldReduceMotion && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 h-[1.5px] overflow-hidden"
            >
              <motion.div
                className="h-full w-1/2 bg-foreground/25"
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

      <></>

    </>
  )
}
