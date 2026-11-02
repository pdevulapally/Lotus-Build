"use client"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { currentBackend } from "@/lib/backend/browser"
import { cn } from "@/lib/utils"
import type { Connection, ProjectSource, Repository } from "@/lib/backend/connections"

type Load =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "ready"; connections: Connection[] }
  | { kind: "error"; message: string }

/**
 * Binds a GitHub repository to the project. Choosing one grants the
 * connection to this project (nothing is granted by default) and records the
 * repository as the project's source; the next session clones it.
 */
export function RepositoryDialog({ open, projectId, source, dark, onClose, onBound }: {
  open: boolean
  /** Dialogs portal to <body>, outside the workspace theme wrapper, so the theme is passed in. */
  dark: boolean
  projectId: string
  source: ProjectSource | undefined
  onClose: () => void
  onBound: (source: ProjectSource | null) => void
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" })
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [repositories, setRepositories] = useState<Repository[] | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoad({ kind: "loading" }); setError(null); setChanging(false); setQuery("")
    currentBackend().connections(controller.signal)
      .then(({ connections }) => {
        const github = connections.filter((c) => c.connector === "github" && c.status === "active")
        setLoad(github.length === 0 ? { kind: "none" } : { kind: "ready", connections: github })
        setConnectionId(source?.connectionId ?? github[0]?.id ?? null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ kind: "error", message: reason instanceof Error ? reason.message : "Could not load your GitHub connections." })
      })
    return () => controller.abort()
  }, [open, source?.connectionId])

  const picking = open && (source === undefined || changing)
  useEffect(() => {
    if (!picking || connectionId === null) return
    const controller = new AbortController()
    setRepositories(null)
    currentBackend().connectionRepositories(connectionId, controller.signal)
      .then(({ repositories }) => setRepositories(repositories))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : "Could not list repositories.")
        setRepositories([])
      })
    return () => controller.abort()
  }, [picking, connectionId])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (repositories ?? []).filter((r) => needle === "" || r.fullName.toLowerCase().includes(needle)).slice(0, 50)
  }, [repositories, query])

  const choose = async (repository: Repository) => {
    if (connectionId === null) return
    setBusy(repository.fullName); setError(null)
    try {
      const backend = currentBackend()
      const { connection } = await backend.connection(connectionId)
      const granted = connection.grantedProjectIds ?? []
      if (!granted.includes(projectId)) await backend.setConnectionGrants(connectionId, [...granted, projectId])
      const result = await backend.bindProjectSource(projectId, { connectionId, fullName: repository.fullName })
      onBound(result.source)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not use that repository.")
    } finally { setBusy(null) }
  }

  const remove = async () => {
    setBusy("remove"); setError(null)
    try {
      await currentBackend().unbindProjectSource(projectId)
      onBound(null)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the repository.")
    } finally { setBusy(null) }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && busy === null) onClose() }}>
      <DialogContent showCloseButton={false} className={cn("max-w-[28rem] gap-0 rounded-2xl border-border/60 p-5 text-foreground shadow-[0_24px_64px_-24px_rgb(0_0_0/0.35)]", dark && "dark")}>
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="text-[16px] font-semibold">Repository</DialogTitle>
          <DialogDescription className="text-[13px]">
            {source !== undefined && !changing
              ? "This project is linked to the repository below. The agent will work on its own lotusbuild/ branch and open pull requests for you to review."
              : "Choose a repository for this project. The agent will work on a lotusbuild/ branch and open pull requests for you to review."}
          </DialogDescription>
        </DialogHeader>

        {source !== undefined && !changing ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3">
            <GitHubMark />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{source.fullName}</p>
              <p className="text-[12.5px] text-muted-foreground">Pull requests into {source.defaultBranch}</p>
            </div>
          </div>
        ) : load.kind === "loading" ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground" role="status"><Spinner className="size-4" /> Loading…</p>
        ) : load.kind === "none" ? (
          <p className="mt-4 text-[13.5px] text-muted-foreground">Connect GitHub first in <a href="/integrations" className="font-medium text-foreground underline-offset-4 hover:underline">Integrations</a>, then choose a repository here.</p>
        ) : load.kind === "error" ? (
          <p className="mt-4 text-[13px] text-destructive" role="alert">{load.message}</p>
        ) : (
          <div className="mt-4 grid gap-2.5">
            {load.connections.length > 1 && (
              <select aria-label="GitHub account" value={connectionId ?? ""} onChange={(event) => setConnectionId(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {load.connections.map((c) => <option key={c.id} value={c.id}>{c.account?.name ?? "GitHub"}</option>)}
              </select>
            )}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories" aria-label="Search repositories" autoFocus
              className="h-10 w-full rounded-xl border border-border bg-background px-3.5 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
            <ul className="max-h-[17rem] overflow-y-auto rounded-xl border border-border" aria-label="Repositories">
              {repositories === null ? (
                <li className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-muted-foreground" role="status"><Spinner className="size-4" /> Loading repositories…</li>
              ) : shown.length === 0 ? (
                <li className="px-3.5 py-3 text-[13px] text-muted-foreground">{repositories.length === 0 ? "This installation has no repositories yet. Add some in GitHub → Settings → Applications → LotusBuild." : "No repositories match."}</li>
              ) : shown.map((repository) => (
                <li key={repository.id} className="border-b border-border/60 last:border-b-0">
                  <button type="button" onClick={() => void choose(repository)} disabled={busy !== null}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-progress disabled:opacity-60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{repository.fullName}</span>
                      <span className="block text-[12px] text-muted-foreground">{repository.private ? "Private" : "Public"} · {repository.defaultBranch}</span>
                    </span>
                    {busy === repository.fullName && <Spinner className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="mt-2 text-[12.5px] text-destructive" role="alert">{error}</p>}

        <DialogFooter className="mt-5 flex-row justify-end gap-2">
          {source !== undefined && !changing ? (
            <>
              <Button type="button" variant="ghost" className="h-9 rounded-full px-4 text-[13px] text-destructive hover:text-destructive" onClick={() => void remove()} disabled={busy !== null}>{busy === "remove" ? "Removing…" : "Remove"}</Button>
              <Button type="button" variant="ghost" className="h-9 rounded-full px-4 text-[13px]" onClick={() => setChanging(true)} disabled={busy !== null}>Change</Button>
              <Button type="button" className="h-9 rounded-full px-4 text-[13px]" onClick={onClose}>Done</Button>
            </>
          ) : (
            <Button type="button" variant="ghost" className="h-9 rounded-full px-4 text-[13px]" onClick={source !== undefined ? () => setChanging(false) : onClose} disabled={busy !== null}>{source !== undefined ? "Back" : "Cancel"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GitHubMark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/integrations/github.svg" alt="" width={22} height={22} className="shrink-0 dark:invert" />
}
