"use client"

import {
  MoreHorizontal,
  History,
  Moon,
  Sun,
} from "lucide-react"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { SessionMenuContent } from "@/components/computer/session-menu"
import { RenameSessionDialog } from "@/components/computer/rename-session-dialog"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { GitHubGlyph } from "@/components/integrations/connector-icons"
import { cn } from "@/lib/utils"
import type { ComputerSessionResponse } from "@/components/computer/session-types"
import type { ContextUsage } from "@/components/ai-elements/context"
import styles from "./computer-workspace.module.css"

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
  onOpenRepository,
  repository,
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
  onOpenRepository?: () => void
  /** The repository the project is bound to, shown beside the session actions. */
  repository?: string
  onOpenNavigation: () => void
  navigationOpen: boolean
  workspacePanelOpen: boolean
  onToggleWorkspacePanel: () => void
  contextUsage?: { maxTokens: number; usedTokens: number; usage: ContextUsage }
  theme: ComputerTheme
  onThemeToggle: () => void
}) {

  return (
    <>
      <header className="relative z-30 shrink-0 bg-background" aria-label="Computer workspace header">
        <div className={cn(styles.toolbarRow, "relative flex h-[52px] w-full items-center")}>

          {/* Navigation on mobile, session actions on desktop. */}
          <div
            className={cn(
              styles.toolbarLeft,
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
              className={cn(styles.control, "mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden")}
            >
              <SidebarToggleIcon className="size-[18px]" side="left" open={navigationOpen} />
            </button>

            <section className="hidden lg:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Session actions" title="Session actions" className={cn(styles.control, "inline-flex items-center justify-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
                    <MoreHorizontal className="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <SessionMenuContent align="start" session={session} onRepository={onOpenRepository} projectFileCount={projectFileCount} remainingTokens={remainingTokens} planLabel={planLabel} liveSiteUrl={liveSiteUrl} contextUsage={contextUsage} onRename={onEditTitleStart} onOpenHistory={onOpenHistory} dark={theme === "dark"} />
              </DropdownMenu>
            </section>
            {repository && onOpenRepository && (
              <button type="button" onClick={onOpenRepository} title="Repository" className="hidden h-8 min-w-0 max-w-[18rem] shrink items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex">
                <GitHubGlyph className="size-3.5 shrink-0" />
                <span className="truncate">{repository}</span>
              </button>
            )}
          </div>

          {/* ── Right: workspace toolbar ── */}
          <div className={cn(styles.toolbarRight, "flex h-full shrink-0 items-center justify-end gap-2 px-3")}>
            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onThemeToggle}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className={cn(styles.control, "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50")}
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>

              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  disabled={!session.projectId}
                  aria-label="Version history"
                  className={cn(styles.control, "hidden size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 lg:inline-flex")}
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
                className={cn(styles.control, "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", workspacePanelOpen && "bg-muted text-foreground")}
              >
                <SidebarToggleIcon className="size-[18px]" side="right" open={workspacePanelOpen} />
              </button>

            </div>
          </div>
        </div>

      </header>

      <RenameSessionDialog open={isEditingTitle} dark={theme === "dark"} draft={titleDraft} saving={titleSaving} error={titleError} onDraftChange={onTitleDraftChange} onCancel={onEditTitleCancel} onSave={onTitleSave} />
    </>
  )
}
