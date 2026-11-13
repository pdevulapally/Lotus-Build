"use client"

import type { Ref } from 'react'
import { ArrowLeft, ExternalLink, FolderGit2, RefreshCw } from 'lucide-react'

export function RepositoryHeader({ name, repositoryUrl, onBackToFiles, backRef, onManageRepository, onRefresh }: {
  name: string
  repositoryUrl: string | null
  onBackToFiles?: () => void
  backRef?: Ref<HTMLButtonElement>
  onManageRepository?: () => void
  onRefresh: () => void
}) {
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return <header className="shrink-0 border-b border-border/60">
    <section className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 @3xl/repository:px-6">
      <section className="flex min-w-0 items-center gap-3">
        {onBackToFiles ? <button ref={backRef} type="button" onClick={onBackToFiles} aria-label="Back to files" title="Back to files"
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`}>
          <ArrowLeft aria-hidden className="size-4" />
        </button> : <FolderGit2 aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
        <h2 className="break-all text-base font-semibold tracking-tight text-foreground">{name}</h2>
      </section>
      <nav aria-label="Repository actions" className="flex flex-wrap items-center gap-2 text-sm">
        {onManageRepository && <button type="button" onClick={onManageRepository} className={`rounded-lg px-3 py-2 font-medium text-foreground transition-colors hover:bg-accent ${focus}`}>{repositoryUrl ? 'Manage repository' : 'Connect GitHub'}</button>}
        {repositoryUrl && <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition-colors hover:bg-accent ${focus}`}>GitHub<ExternalLink aria-hidden className="size-3.5" /></a>}
        <button type="button" aria-label="Refresh repository" title="Refresh repository" onClick={onRefresh}
          className={`inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`}><RefreshCw aria-hidden className="size-4" /></button>
      </nav>
    </section>
  </header>
}
