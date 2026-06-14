"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { RefreshCw, Smartphone } from "lucide-react"
import QRCode from "react-qr-code"
import type { MobileSandbox, MobileSandboxStatus } from "@/lib/mobile-preview/types"
import { cn } from "@/lib/utils"

const POLL_MS = 3000
const HEARTBEAT_MS = 60_000
const MAX_AUTO_RETRIES = 2
const AUTO_RETRY_DELAY_MS = 4000

function isRetryableError(error: string | null): boolean {
  if (!error) return false
  return /metro did not become ready|metro.*timeout|timed out|econnrefused/i.test(error)
}

function normalizePreviewError(error: string | null): string {
  if (!error) return "The mobile preview failed to start. Please try again."
  if (/metro did not become ready|metro.*timeout/i.test(error)) {
    return "The preview server took too long to start. This can happen when resources are busy."
  }
  if (/out of memory|oom/i.test(error)) {
    return "The preview ran out of memory. Please try again in a moment."
  }
  if (/econnrefused|unreachable/i.test(error)) {
    return "Could not reach the preview service. Please try again."
  }
  return error
}

/** iPhone-style viewport ratio (375×812). Inline sizing avoids % width collapse in shrink-wrapped flex parents. */
const PHONE_FRAME_STYLE: CSSProperties = {
  aspectRatio: "375 / 812",
  width: 280,
  maxWidth: "100%",
  maxHeight: "68vh",
}

type PreviewView =
  | { kind: "loading" }
  | { kind: "queue_full"; message: string }
  | { kind: "booting"; sandbox: MobileSandbox }
  | { kind: "starting"; sandbox: MobileSandbox }
  | { kind: "running"; sandbox: MobileSandbox }
  | { kind: "failed"; sandbox: MobileSandbox; message: string }
  | { kind: "error"; message: string }

function resolveView(sandbox: MobileSandbox | null, phase: PreviewView["kind"] | "idle"): PreviewView {
  if (phase === "loading") return { kind: "loading" }
  if (!sandbox) return { kind: "error", message: "Preview is unavailable right now." }

  if (sandbox.status === "failed") {
    return {
      kind: "failed",
      sandbox,
      message: sandbox.error || "The mobile preview failed to start.",
    }
  }
  if (sandbox.status === "running" && sandbox.urls?.web) {
    return { kind: "running", sandbox }
  }
  if (sandbox.status === "starting" || sandbox.status === "stopping") {
    return { kind: "starting", sandbox }
  }
  if (sandbox.status === "queued") {
    return { kind: "booting", sandbox }
  }

  return { kind: "starting", sandbox }
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>
}

export function MobilePreview({
  projectId,
  getAuthHeader,
  className,
  syncNonce = 0,
}: {
  projectId: string
  getAuthHeader: () => Promise<Record<string, string>>
  className?: string
  /** Bump to re-sync project files into the running sandbox (e.g. after agent edits). */
  syncNonce?: number
}) {
  const [view, setView] = useState<PreviewView>({ kind: "loading" })
  const [previewGeneration, setPreviewGeneration] = useState(0)
  const sandboxRef = useRef<MobileSandbox | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const autoRetryTimerRef = useRef<number | null>(null)
  const autoRetryCountRef = useRef(0)
  const getAuthHeaderRef = useRef(getAuthHeader)
  const creatingRef = useRef(false)

  getAuthHeaderRef.current = getAuthHeader

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const clearAutoRetry = useCallback(() => {
    if (autoRetryTimerRef.current !== null) {
      window.clearTimeout(autoRetryTimerRef.current)
      autoRetryTimerRef.current = null
    }
  }, [])

  const applySandbox = useCallback((sandbox: MobileSandbox) => {
    sandboxRef.current = sandbox
    setView(resolveView(sandbox, "idle"))
  }, [])

  const ensurePreview = useCallback(async (options?: { quiet?: boolean }) => {
    if (creatingRef.current) return
    creatingRef.current = true
    if (!options?.quiet) {
      setView({ kind: "loading" })
    }

    try {
      const auth = await getAuthHeaderRef.current()
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ensure-mobile-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ force: false }),
      })
      const json = await readJson<{
        sandbox?: MobileSandbox
        queueFull?: boolean
        message?: string
        error?: string
        synced?: boolean
      }>(response)

      if (!response.ok) {
        setView({ kind: "error", message: json.error || "Could not start mobile preview." })
        return
      }
      if (json.queueFull) {
        setView({ kind: "queue_full", message: json.message || "The preview queue is full." })
        return
      }
      if (!json.sandbox) {
        setView({ kind: "error", message: "Preview response was incomplete." })
        return
      }

      applySandbox(json.sandbox)
      if (json.synced && json.sandbox.status === "running" && json.sandbox.urls?.web) {
        setPreviewGeneration((current) => current + 1)
      }
    } finally {
      creatingRef.current = false
    }
  }, [applySandbox, projectId])

  const fetchSandbox = useCallback(async () => {
    const sandbox = sandboxRef.current
    if (!sandbox || creatingRef.current) return

    const auth = await getAuthHeaderRef.current()
    const response = await fetch(
      `/api/mobile-preview/${encodeURIComponent(sandbox.id)}?projectId=${encodeURIComponent(projectId)}`,
      { headers: { ...auth } },
    )
    const json = await readJson<{ sandbox?: MobileSandbox; expired?: boolean; error?: string }>(response)

    if (!response.ok) {
      setView({ kind: "error", message: json.error || "Could not refresh preview status." })
      clearPoll()
      return
    }
    if (json.expired) {
      clearPoll()
      clearHeartbeat()
      sandboxRef.current = null
      void ensurePreview()
      return
    }
    if (json.sandbox) {
      applySandbox(json.sandbox)
      if (json.sandbox.status === "running") {
        clearPoll()
      }
    }
  }, [applySandbox, clearHeartbeat, clearPoll, ensurePreview, projectId])

  const sendHeartbeat = useCallback(async () => {
    const sandbox = sandboxRef.current
    if (!sandbox || sandbox.status !== "running" || document.visibilityState !== "visible") return

    const auth = await getAuthHeaderRef.current()
    await fetch(`/api/mobile-preview/${encodeURIComponent(sandbox.id)}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ projectId }),
    }).catch(() => undefined)
  }, [projectId])

  useEffect(() => {
    sandboxRef.current = null
    autoRetryCountRef.current = 0
    clearAutoRetry()
    void ensurePreview()
    return () => {
      creatingRef.current = false
      clearPoll()
      clearHeartbeat()
      clearAutoRetry()
    }
  }, [projectId, ensurePreview, clearPoll, clearHeartbeat, clearAutoRetry])

  useEffect(() => {
    if (syncNonce === 0) return
    void ensurePreview({ quiet: true })
  }, [syncNonce, ensurePreview])

  useEffect(() => {
    if (view.kind !== "failed") {
      clearAutoRetry()
      return
    }

    const rawError = view.sandbox.error
    if (!isRetryableError(rawError) || autoRetryCountRef.current >= MAX_AUTO_RETRIES) return

    autoRetryCountRef.current += 1
    autoRetryTimerRef.current = window.setTimeout(() => {
      autoRetryTimerRef.current = null
      sandboxRef.current = null
      clearPoll()
      clearHeartbeat()
      void ensurePreview()
    }, AUTO_RETRY_DELAY_MS)

    return clearAutoRetry
  }, [view, ensurePreview, clearPoll, clearHeartbeat, clearAutoRetry])

  useEffect(() => {
    const sandbox = sandboxRef.current
    if (!sandbox || sandbox.status === "running" || view.kind === "queue_full" || view.kind === "error") {
      clearPoll()
      return
    }

    clearPoll()
    pollTimerRef.current = window.setInterval(() => {
      void fetchSandbox()
    }, POLL_MS)

    return clearPoll
  }, [clearPoll, fetchSandbox, view])

  useEffect(() => {
    if (view.kind !== "running") {
      clearHeartbeat()
      return
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat()
        if (sandboxRef.current?.status === "running") {
          void ensurePreview({ quiet: true })
        }
      }
    }

    void sendHeartbeat()
    heartbeatTimerRef.current = window.setInterval(() => {
      void sendHeartbeat()
    }, HEARTBEAT_MS)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearHeartbeat()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [clearHeartbeat, ensurePreview, sendHeartbeat, view.kind])

  const handleRetry = () => {
    autoRetryCountRef.current = 0
    clearAutoRetry()
    sandboxRef.current = null
    clearPoll()
    clearHeartbeat()
    void ensurePreview()
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-[#f0ece4] p-3 sm:p-4", className)}>
      {view.kind === "loading" && (
        <PreviewShell title="Starting preview" subtitle="Preparing your mobile sandbox…">
          <PhoneFrame loading />
        </PreviewShell>
      )}

      {view.kind === "queue_full" && (
        <PreviewShell title="Preview queue is full" subtitle={view.message}>
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-[#1c1c1c]">{view.message}</p>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              View plans
            </Link>
          </div>
        </PreviewShell>
      )}

      {view.kind === "booting" && (
        <PreviewShell
          title={view.sandbox.queuePosition != null ? `In queue — position ${view.sandbox.queuePosition}` : "Booting preview"}
          subtitle="Your mobile preview is getting ready."
        >
          <div className="flex flex-col items-center gap-3">
            {view.sandbox.queuePosition != null && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                In queue — position {view.sandbox.queuePosition}
              </span>
            )}
            <PhoneFrame loading />
          </div>
        </PreviewShell>
      )}

      {view.kind === "starting" && (
        <PreviewShell title="Starting your preview…" subtitle="The Expo dev server is coming online.">
          <PhoneFrame loading />
        </PreviewShell>
      )}

      {view.kind === "failed" && (() => {
        const willAutoRetry = isRetryableError(view.sandbox.error) && autoRetryCountRef.current < MAX_AUTO_RETRIES
        const friendlyMessage = normalizePreviewError(view.sandbox.error)
        return (
          <PreviewShell
            title={willAutoRetry ? "Preview timed out — retrying…" : "Preview failed"}
            subtitle={willAutoRetry ? "Attempting to restart the preview automatically." : friendlyMessage}
          >
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-[#1c1c1c]">{friendlyMessage}</p>
              {willAutoRetry ? (
                <p className="text-xs text-muted-foreground">Retrying automatically in a moment…</p>
              ) : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-[#1c1c1c] transition hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </button>
              )}
            </div>
          </PreviewShell>
        )
      })()}

      {view.kind === "error" && (
        <PreviewShell title="Preview unavailable" subtitle={view.message}>
          <button
            type="button"
            onClick={handleRetry}
            className="mx-auto inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-[#1c1c1c] transition hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </PreviewShell>
      )}

      {view.kind === "running" && view.sandbox.urls && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row"
        >
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <PhoneDeviceFrame>
              <iframe
                key={previewGeneration}
                src={view.sandbox.urls.web}
                title="Mobile web preview"
                className="h-full w-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </PhoneDeviceFrame>
          </div>

          <div className="flex shrink-0 flex-col justify-center rounded-2xl border border-border bg-card p-5 shadow-sm lg:w-[min(100%,320px)]">
            <div className="mx-auto rounded-xl bg-white p-4">
              <QRCode value={view.sandbox.urls.expoGo} size={180} />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-[#1c1c1c]">
              Scan with Expo Go to preview on your phone
            </p>
            <p className="mt-2 break-all rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground select-all">
              {view.sandbox.urls.expoGo}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function PreviewShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</p>
        <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">{children}</div>
    </div>
  )
}

function PhoneDeviceFrame({
  loading = false,
  children,
}: {
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex w-full items-center justify-center px-4 py-6">
      <div className="relative shrink-0">
        {loading ? (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[3px] z-0 overflow-hidden rounded-[2.35rem]"
          >
            <div className="absolute left-1/2 top-1/2 h-[280%] w-[280%] -translate-x-1/2 -translate-y-1/2 animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,var(--accent)_40deg,var(--accent-soft)_100deg,transparent_160deg)]" />
          </div>
        ) : null}
        <div
          className="relative z-10 overflow-hidden rounded-[2.25rem] border-8 border-[#1a1a1a] bg-black shadow-2xl"
          style={PHONE_FRAME_STYLE}
        >
          <div className="absolute left-1/2 top-3 z-10 h-[22px] w-[72px] -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
          {children ?? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-100 px-8 text-center">
              <Smartphone className="h-8 w-8 text-zinc-400" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-28 w-full animate-pulse rounded-2xl bg-zinc-200" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PhoneFrame({ loading = false }: { loading?: boolean }) {
  return <PhoneDeviceFrame loading={loading} />
}
