"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, Clock, History, Loader2, RotateCcw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { ProjectVersionSummary } from "@/lib/project-versions/types"

type VersionHistoryPanelProps = {
  projectId?: string
  open: boolean
  onClose: () => void
  onRestored?: () => void | Promise<void>
  getAuthHeader: () => Promise<Record<string, string>>
  variant?: "popover" | "sheet"
}

function formatRelativeTime(createdAt: string) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return "Recently"
  return formatDistanceToNow(date, { addSuffix: true })
}

export function VersionHistoryPanel({
  projectId,
  open,
  onClose,
  onRestored,
  getAuthHeader,
  variant = "popover",
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmVersion, setConfirmVersion] = useState<ProjectVersionSummary | null>(null)

  const loadVersions = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/versions`, {
        headers: { ...auth },
      })
      const json = await res.json().catch(() => ({})) as {
        versions?: ProjectVersionSummary[]
        currentVersionId?: string | null
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || "Could not load version history")
      }
      setVersions(Array.isArray(json.versions) ? json.versions : [])
      setCurrentVersionId(json.currentVersionId ?? json.versions?.[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load version history")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, projectId])

  useEffect(() => {
    if (!open || !projectId) return
    void loadVersions()
  }, [loadVersions, open, projectId])

  const handleRestore = async (version: ProjectVersionSummary) => {
    if (!projectId || version.id === currentVersionId) return
    setRestoringId(version.id)
    setError(null)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(version.id)}/restore`,
        { method: "POST", headers: { ...auth } }
      )
      const json = await res.json().catch(() => ({})) as { error?: string; restoredVersionId?: string }
      if (!res.ok) {
        throw new Error(json.error || "Could not restore this version")
      }
      setCurrentVersionId(json.restoredVersionId || version.id)
      setConfirmVersion(null)
      await loadVersions()
      await onRestored?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore this version")
    } finally {
      setRestoringId(null)
    }
  }

  if (!open) return null

  const shellClass = variant === "sheet"
    ? "fixed inset-x-3 bottom-[5.6rem] z-50 flex max-h-[min(72dvh,36rem)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg sm:hidden"
    : "z-30 hidden w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg sm:flex fixed right-6 top-16 max-h-[min(72dvh,36rem)]"

  return (
    <>
      <div className={shellClass}>
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[13px] font-semibold text-foreground">Version history</p>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Go back to an earlier version of your project.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
          {!projectId ? (
            <div className="rounded-xl bg-muted/50 px-4 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">Build something first to start saving versions.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">Loading versions…</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-[12px] text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => void loadVersions()}
                className="mt-2 text-[12px] font-semibold text-destructive underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-xl bg-muted/50 px-4 py-8 text-center">
              <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-[13px] font-medium text-foreground">No saved versions yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Each time the agent updates your project, a version is saved here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => {
                const isCurrent = version.id === currentVersionId
                const isExpanded = expandedId === version.id
                const isRestoring = restoringId === version.id

                return (
                  <li key={version.id}>
                    <div
                      className={cn(
                        "overflow-hidden rounded-xl border transition-colors",
                        isCurrent ? "border-primary/30 bg-accent-soft/40" : "border-border bg-background"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : version.id)}
                        className="flex w-full min-h-12 items-start gap-3 px-3.5 py-3 text-left"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <History className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-semibold text-foreground">{version.label}</p>
                            {isCurrent ? (
                              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-soft-foreground">
                                Current
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatRelativeTime(version.createdAt)}
                            {" · "}
                            {version.fileCount} {version.fileCount === 1 ? "file" : "files"}
                          </p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-border/60 px-3.5 pb-3.5 pt-2">
                          {version.summary ? (
                            <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
                              {version.summary}
                            </p>
                          ) : null}
                          {!isCurrent ? (
                            <button
                              type="button"
                              disabled={Boolean(restoringId)}
                              onClick={() => setConfirmVersion(version)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRestoring ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Go back to this version
                            </button>
                          ) : (
                            <p className="text-[12px] text-muted-foreground">This is your current project.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(confirmVersion)} onOpenChange={(next) => !next && setConfirmVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back to this version?</AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ll save your current version so you can return to it later.
              {confirmVersion ? ` You're restoring "${confirmVersion.label}".` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(restoringId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(restoringId) || !confirmVersion}
              onClick={(event) => {
                event.preventDefault()
                if (confirmVersion) void handleRestore(confirmVersion)
              }}
            >
              {restoringId ? "Restoring…" : "Go back"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
