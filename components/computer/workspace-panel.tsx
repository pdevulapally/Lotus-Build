"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, ExternalLink, Globe2, Home, Laptop, Loader2, Monitor, RotateCcw, ShieldAlert, Wrench } from "lucide-react"
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

function formatBrowserHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Browser"
  }
}

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
    <div className="lotus-glass-strong absolute bottom-4 right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-destructive/20">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[12px] font-semibold text-foreground">Something went wrong</span>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
      </div>
      <div className="px-3.5 py-3">
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{error.message}</p>
        {error.stack && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && error.stack && (
          <pre className="lotus-glass-inset mt-1.5 max-h-[120px] overflow-y-auto rounded-lg p-2 text-[10px] leading-relaxed text-muted-foreground [scrollbar-width:thin]">
            {error.stack}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
        <button
          type="button"
          onClick={onFix}
          disabled={fixing}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-[12px] font-semibold text-background shadow-sm transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
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
      className="lotus-glass-control absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
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
        <div className="lotus-glass-inset mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground">
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
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {progress.detail}
          </p>
        )}
      </div>
    </motion.div>
  )
}

export function WorkspaceTabBar({
  activeTab,
  previewUrl,
  onRefreshPreview,
  onNavigatePreview,
}: {
  activeTab: WorkspaceTab
  previewUrl?: string | null
  onRefreshPreview?: () => void
  onNavigatePreview?: (url: string) => void
}) {
  const [urlPath, setUrlPath] = useState("/")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!previewUrl) { setUrlPath("/"); return }
    try {
      const u = new URL(previewUrl)
      setUrlPath(u.pathname || "/")
    } catch {
      setUrlPath("/")
    }
  }, [previewUrl])

  const previewOrigin = previewUrl ? (() => {
    try { return new URL(previewUrl).origin } catch { return "" }
  })() : ""

  const commitNav = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`
    setUrlPath(normalized)
    if (previewOrigin) onNavigatePreview?.(previewOrigin + normalized)
  }

  if (activeTab !== "preview" || !previewUrl) return null

  return (
    <div className="lotus-glass-inset hidden h-10 shrink-0 items-center justify-center border-b border-border/40 px-4 sm:flex">
      {/* Centered constrained URL pill */}
      <div className="lotus-glass-control group flex w-full max-w-sm items-center gap-0.5 overflow-hidden rounded-full border border-foreground/25 px-1 transition-colors focus-within:border-foreground/40 hover:border-foreground/35">

        {/* Home */}
        <button
          type="button"
          aria-label="Go to root"
          onClick={() => commitNav("/")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <Home className="h-3.5 w-3.5" />
        </button>

        {/* Host (dimmed, truncated) */}
        {previewOrigin && (
          <span className="max-w-[130px] shrink truncate select-none text-[11px] text-foreground/50">
            {previewOrigin.replace(/^https?:\/\//, "")}
          </span>
        )}

        {/* Slash + path */}
        <div className="flex min-w-[40px] flex-1 items-center">
          <span className="shrink-0 select-none text-[12px] text-foreground/40">/</span>
          <input
            ref={inputRef}
            value={urlPath.replace(/^\//, "")}
            onChange={(e) => setUrlPath("/" + e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNav(urlPath)
              if (e.key === "Escape") inputRef.current?.blur()
            }}
            onClick={() => inputRef.current?.select()}
            className="min-w-0 flex-1 bg-transparent py-0.5 text-[12px] text-foreground outline-none placeholder:text-foreground/30"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* External link */}
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in new tab"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Refresh */}
        <button
          type="button"
          aria-label="Refresh preview"
          onClick={onRefreshPreview}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
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
  previewSrc,
  iframeReloadNonce = 0,
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
  previewSrc?: string | null
  iframeReloadNonce?: number
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
        className="flex h-full min-h-0 flex-col bg-[oklch(0.955_0_0)] p-3 dark:bg-[oklch(0.18_0_0)] lg:p-4">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground">
              {formatBrowserHost(browserInspection.url)}
            </p>
            {browserInspection.title && browserInspection.title !== browserInspection.url && (
              <p className="truncate text-[10.5px] text-muted-foreground">{browserInspection.title}</p>
            )}
          </div>
          <WorkspaceHeaderLink href={browserInspection.url} />
        </div>
        <div className="lotus-glass-panel relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          {browserInspection.liveUrl && !browserInspection.isExpired ? (
            <iframe
              src={browserInspection.liveUrl}
              className="h-full w-full bg-[oklch(0.985_0_0)] dark:bg-[oklch(0.18_0_0)]"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              title="Remote browser"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {browserInspection.isExpired ? "Live view has expired." : "Live view unavailable."}
              </p>
              <a href={browserInspection.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground underline underline-offset-2 hover:text-foreground/80">
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
    const effectivePreviewSrc = previewSrc || session.previewUrl
    const iframeKey = `${effectivePreviewSrc}__${iframeReloadNonce}`
    return <PreviewPane
      iframeKey={iframeKey}
      src={effectivePreviewSrc}
      isEnsuringPreview={isEnsuringPreview}
      previewEnsureError={previewEnsureError}
      onRetryPreview={onRetryPreview}
      browserInspection={browserInspection}
      onSwitchView={onSwitchView}
      runtimeError={runtimeError}
      fixingError={fixingError}
      onFixError={onFixError}
      onDismissError={onDismissError}
    />
  }

  return <SessionProgressSurface progress={workspaceProgress} />
}

function PreviewPane({
  iframeKey,
  src,
  isEnsuringPreview,
  previewEnsureError,
  onRetryPreview,
  browserInspection,
  onSwitchView,
  runtimeError,
  fixingError,
  onFixError,
  onDismissError,
}: {
  iframeKey: string
  src: string
  isEnsuringPreview: boolean
  previewEnsureError: string | null
  onRetryPreview: () => void
  browserInspection: BrowserInspection | null
  onSwitchView: (v: WorkspaceTab) => void
  runtimeError: { message: string; stack: string } | null
  fixingError: boolean
  onFixError: () => void
  onDismissError: () => void
}) {
  const [isIframeLoading, setIsIframeLoading] = useState(true)

  useEffect(() => {
    setIsIframeLoading(true)
  }, [iframeKey])

  return (
    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
      className="flex h-full min-h-0 flex-col bg-[oklch(0.955_0_0)] dark:bg-[oklch(0.18_0_0)]">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <iframe
          key={iframeKey}
          src={src}
          className="h-full w-full bg-[oklch(0.985_0_0)] dark:bg-[oklch(0.18_0_0)]"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="Live preview"
          onLoad={() => setIsIframeLoading(false)}
        />

        {/* Loading banner — only while iframe is actually loading */}
        {isIframeLoading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-4">
            <div className="lotus-glass-control flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading preview…
            </div>
          </div>
        )}

        {previewEnsureError && !isEnsuringPreview && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center p-4">
              <div className="lotus-glass-strong flex max-w-[360px] items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] text-muted-foreground">
                <span className="min-w-0 flex-1">{previewEnsureError}</span>
                <button type="button" onClick={onRetryPreview} className="shrink-0 rounded-full px-2 py-1 text-[12px] font-medium text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                  Retry
                </button>
              </div>
            </div>
          )}
          {browserInspection && !browserInspection.isExpired && (
            <LaptopSwitcher label="Browser" title={formatBrowserHost(browserInspection.url)}
              icon={<Globe2 className="h-3.5 w-3.5" />} onClick={() => onSwitchView("browser")} />
          )}
          {runtimeError && (
            <RuntimeErrorCard error={runtimeError} fixing={fixingError} onFix={onFixError} onDismiss={onDismissError} />
          )}
        </div>
      </motion.div>
    )
}

export function LoadingShell() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="lotus-glass shrink-0 px-4 py-3">
        <div className="flex h-10 items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <div className="flex flex-1 gap-0 overflow-hidden">
        <div className="hidden w-[380px] shrink-0 animate-pulse border-r border-border/80 bg-background sm:block" />
        <div className="flex-1 animate-pulse bg-muted/35 p-3">
          <div className="lotus-glass-panel h-full rounded-lg border border-border/70" />
        </div>
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
        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-foreground/80">
          Back home
        </Link>
      </div>
    </div>
  )
}
