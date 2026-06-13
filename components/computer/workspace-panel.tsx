"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, ExternalLink, Globe2, Laptop, Monitor, ShieldAlert, Wrench } from "lucide-react"
import { MobilePreview } from "@/components/computer/mobile-preview"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { normalizePlatform } from "@/lib/projects/platform"
import type { ComputerSessionProgress } from "@/components/computer/session-progress-model"
import {
  getEventTitle,
  type BrowserInspection,
  type ComputerSessionResponse,
  type ComputerSessionStatus,
  type ComputerTimelineEvent,
  type WorkspaceTab,
} from "@/components/computer/session-types"
import { cn } from "@/lib/utils"

function ResearchPanel({ events }: { events: ComputerTimelineEvent[] }) {
  const evidence = events.filter(
    (e) => (e.kind === "research" || e.kind === "browser") && Boolean(e.description?.trim())
  )
  if (evidence.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-[13px] font-medium text-foreground">No research yet</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Notes from research and page inspection will show up here.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin] sm:p-5">
      <AnimatePresence initial={false}>
        {evidence.map((event, i) => (
          <motion.div
            key={event.id ?? `${event.title}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="border-b border-border pb-4 last:border-0"
          >
            <p className="text-[13px] font-medium text-foreground">{getEventTitle(event)}</p>
            <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function WorkspaceHeaderLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">Open in new tab</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  )
}

function RuntimeErrorCard({
  error,
  fixing,
  onFix,
  onDismiss,
}: {
  error: { message: string; stack: string }
  fixing: boolean
  onFix: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="absolute bottom-4 right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[12px] font-semibold text-foreground">Something went wrong</span>
        </div>
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground">×</button>
      </div>
      <div className="px-3.5 py-3">
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{error.message}</p>
        {error.stack && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && error.stack && (
          <pre className="mt-1.5 max-h-[120px] overflow-y-auto rounded-lg bg-muted p-2 text-[10px] leading-relaxed text-muted-foreground [scrollbar-width:thin]">
            {error.stack}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <button
          type="button"
          onClick={onFix}
          disabled={fixing}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
        >
          <Wrench className="h-3.5 w-3.5" />
          {fixing ? "Fixing..." : "Fix with AI"}
        </button>
      </div>
    </div>
  )
}

function LaptopSwitcher({ label, title, onClick, icon }: {
  label: string; title: string; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition hover:bg-muted"
    >
      <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">{icon}</span>
      <span>
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <span className="block max-w-[140px] truncate text-[12px] font-medium text-foreground">{title}</span>
      </span>
    </button>
  )
}

function SessionProgressSurface({ progress }: { progress: ComputerSessionProgress }) {
  return (
    <motion.div key={`progress-${progress.state}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
      className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Monitor className="h-4 w-4" />
        </div>
        {progress.active ? (
          <TextShimmer className="text-[13px] font-medium">{progress.label}</TextShimmer>
        ) : (
          <p className="text-[13px] font-medium text-foreground">{progress.label}</p>
        )}
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {progress.description}
        </p>
        {progress.detail && progress.detail !== progress.description && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
            {progress.detail}
          </p>
        )}
      </div>
    </motion.div>
  )
}

export function WorkspaceTabBar({
  activeTab,
  hasPreview,
  hasBrowser,
  hasResearch,
  onTabChange,
  showCompleteBadge,
}: {
  activeTab: WorkspaceTab
  hasPreview: boolean
  hasBrowser: boolean
  hasResearch: boolean
  onTabChange: (tab: WorkspaceTab) => void
  showCompleteBadge?: boolean
}) {
  const tabs: Array<{ id: WorkspaceTab; label: string; show: boolean; dot?: boolean }> = [
    { id: "preview", label: "Preview", show: true, dot: hasPreview && activeTab !== "preview" },
    { id: "browser", label: "Browser", show: hasBrowser, dot: hasBrowser && activeTab !== "browser" },
    { id: "research", label: "Research", show: hasResearch, dot: hasResearch && activeTab !== "research" },
  ]

  return (
    <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:flex lg:px-4">
      <div className="flex min-w-0 items-center gap-1">
        {tabs.filter((tab) => tab.show || tab.id === "preview").map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
              activeTab === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {showCompleteBadge && (
        <span className="text-[11px] font-medium text-muted-foreground">Done</span>
      )}
    </div>
  )
}

export function WorkspaceContent({
  session,
  status,
  progress,
  activeTab,
  browserInspection,
  hasProjectFiles,
  projectFileCount,
  isEnsuringPreview,
  previewEnsureError,
  onSwitchView,
  runtimeError,
  fixingError,
  onFixError,
  onDismissError,
  onRetryPreview,
  getAuthHeader,
  previewSyncNonce = 0,
}: {
  session: ComputerSessionResponse
  status: ComputerSessionStatus
  progress?: ComputerSessionProgress | null
  activeTab: WorkspaceTab
  browserInspection: BrowserInspection | null
  hasProjectFiles: boolean
  projectFileCount: number
  isEnsuringPreview: boolean
  previewEnsureError: string | null
  onSwitchView: (v: WorkspaceTab) => void
  runtimeError: { message: string; stack: string } | null
  fixingError: boolean
  onFixError: () => void
  onDismissError: () => void
  onRetryPreview: () => void
  getAuthHeader: () => Promise<Record<string, string>>
  previewSyncNonce?: number
}) {
  const sessionPlatform = normalizePlatform(session.platform)
  const workspaceProgress = progress ?? {
    state: status === "error" ? "error" : status === "complete" ? "complete" : "idle",
    label: status === "complete" ? "Preview ready" : "Ready to build",
    description: status === "complete" ? "Your generated app is ready to review." : "Send a message to start building.",
    active: false,
  } satisfies ComputerSessionProgress

  if (activeTab === "research") {
    return <ResearchPanel events={session.timeline} />
  }

  if (activeTab === "browser" && browserInspection) {
    return (
      <motion.div key="browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col p-3 lg:p-4">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <p className="truncate text-[12px] font-medium text-foreground">{browserInspection.title}</p>
          <WorkspaceHeaderLink href={browserInspection.url} />
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          {browserInspection.liveUrl && !browserInspection.isExpired ? (
            <iframe
              src={browserInspection.liveUrl}
              className="h-full w-full bg-background"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              title="Remote browser"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {browserInspection.isExpired ? "Live view has expired." : "Live view unavailable."}
              </p>
              <a href={browserInspection.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline underline-offset-2">
                Open page in new tab
              </a>
            </div>
          )}
          {session.previewUrl && (
            <LaptopSwitcher label="Preview" title="Generated app"
              icon={<Monitor className="h-3.5 w-3.5" />} onClick={() => onSwitchView("preview")} />
          )}
        </div>
      </motion.div>
    )
  }

  if (activeTab === "preview" && sessionPlatform === "mobile" && session.projectId && projectFileCount > 0) {
    return (
      <motion.div key="mobile-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col">
        <MobilePreview
          projectId={session.projectId}
          getAuthHeader={getAuthHeader}
          syncNonce={previewSyncNonce}
          className="h-full"
        />
      </motion.div>
    )
  }

  if (activeTab === "preview" && sessionPlatform === "mobile" && session.projectId && !hasProjectFiles) {
    return <SessionProgressSurface progress={workspaceProgress} />
  }

  if (activeTab === "preview" && session.previewUrl) {
    return (
      <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col p-3 lg:p-4">
        <div className="mb-2 flex items-center justify-end">
          <WorkspaceHeaderLink href={session.previewUrl} />
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <iframe src={session.previewUrl} className="h-full w-full" sandbox="allow-scripts allow-same-origin allow-forms" title="Live preview" />
          {isEnsuringPreview && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-4">
              <div className="rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                Refreshing preview…
              </div>
            </div>
          )}
          {previewEnsureError && !isEnsuringPreview && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center p-4">
              <div className="flex max-w-[360px] items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 text-[12px] text-muted-foreground shadow-sm backdrop-blur-sm">
                <span className="min-w-0 flex-1">{previewEnsureError}</span>
                <button type="button" onClick={onRetryPreview} className="shrink-0 text-[12px] font-medium text-accent hover:text-accent/80">
                  Retry
                </button>
              </div>
            </div>
          )}
          {browserInspection && !browserInspection.isExpired && (
            <LaptopSwitcher label="Browser" title={browserInspection.title}
              icon={<Globe2 className="h-3.5 w-3.5" />} onClick={() => onSwitchView("browser")} />
          )}
          {runtimeError && (
            <RuntimeErrorCard error={runtimeError} fixing={fixingError} onFix={onFixError} onDismiss={onDismissError} />
          )}
        </div>
      </motion.div>
    )
  }

  return <SessionProgressSurface progress={workspaceProgress} />
}

export function LoadingShell() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex h-10 items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="hidden w-80 shrink-0 animate-pulse rounded-xl bg-muted sm:block" />
        <div className="flex-1 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <h1 className="text-[15px] font-semibold text-foreground">Session not found</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent/80">
          Back home
        </Link>
      </div>
    </div>
  )
}
