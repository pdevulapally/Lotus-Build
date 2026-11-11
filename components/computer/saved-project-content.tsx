"use client"
import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { currentBackend } from '@/lib/backend/browser'
import { useAuth } from '@/contexts/auth-context'
import { WorkspacePersistenceNotice } from '@/components/computer/workspace-persistence-notice'
import type { BackendFileTree, BackendFile, BackendHistory, BackendChanges } from '@/lib/backend/client'
import { getLanguageFromPath } from '@/lib/projects/utils'
import { RepositoryTable } from '@/components/computer/repository-table'
import { GitBranch } from 'lucide-react'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type { ProjectSource } from '@/lib/backend/connections'
import type { Delivery } from '@/lib/backend/delivery'
import { RepositoryPullRequests } from '@/components/computer/repository-pull-requests'
import { RepositoryHeader } from '@/components/computer/repository-header'

export function SavedProjectFiles({ projectId, codeTheme = 'light', source, currentDelivery, onManageRepository }: { projectId?: string; codeTheme?: 'light' | 'dark'; source?: ProjectSource; currentDelivery?: Delivery; onManageRepository?: () => void; files?: Array<{path: string; content: string}>; getAuthHeader?: () => Promise<Record<string, string>> }) {
  const { account } = useAuth()
  const [tree, setTree] = useState<BackendFileTree | null>(null)
  const [path, setPath] = useState<string | null>(null)
  const [file, setFile] = useState<BackendFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [section, setSection] = useState<'code' | 'branches' | 'pull-requests'>('code')
  const [branch, setBranch] = useState<string | undefined>(undefined)
  const previewBack = useRef<HTMLButtonElement>(null)
  const fileOpener = useRef<HTMLElement | null>(null)
  const tableRegion = useRef<HTMLElement>(null)
  useEffect(() => {
    if (path !== null) previewBack.current?.focus()
  }, [path])
  useEffect(() => {
    const controller = new AbortController(); setTree(null); setPath(null); setFile(null); setError(null)
    if (!projectId) { setError('The session has no project.'); return }
    currentBackend().files(projectId, controller.signal, branch).then((value) => {
      if (!controller.signal.aborted) setTree(value)
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load files.') })
    return () => controller.abort()
  }, [projectId, revision, branch])
  useEffect(() => {
    if (!projectId || path === null) { setFile(null); setBusy(false); return }
    const controller = new AbortController(); setFile(null); setBusy(true); setError(null)
    currentBackend().file(projectId, path, controller.signal, tree?.ref ?? undefined).then((value) => {
      if (value.path !== path) throw new Error('The server returned a different file.')
      if (!controller.signal.aborted) setFile(value)
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not read file.') })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [projectId, path, revision, tree?.ref])
  const repositoryUrl = source ? `https://github.com/${source.fullName.split('/').map(encodeURIComponent).join('/')}` : null
  const branchControl = tree && (tree.branches.length > 0 ? <DropdownMenu
    button={{ label: tree.ref ?? 'Choose branch', size: 'sm', icon: <GitBranch aria-hidden className="size-4" /> }} hasChevron
    items={tree.branches.map((name) => ({ id: name, label: name, onClick: () => { setPath(null); setBranch(name) } }))}
  /> : <span className="text-sm text-muted-foreground">No saved branch</span>)
  return <section aria-label="Repository" data-astryx-theme="neutral" style={{ colorScheme: codeTheme }} className="repository-theme @container/repository flex h-full min-h-0 flex-col bg-card">
    <RepositoryHeader name={source?.fullName ?? 'Repository'} repositoryUrl={repositoryUrl}
      backRef={previewBack}
      onBackToFiles={path !== null || section !== 'code' ? () => {
        setPath(null); setSection('code')
        requestAnimationFrame(() => { if (fileOpener.current?.isConnected) fileOpener.current.focus(); else tableRegion.current?.focus() })
      } : undefined}
      onManageRepository={onManageRepository}
      onRefresh={() => setRevision((value) => value + 1)} />
    <WorkspacePersistenceNotice capabilities={account?.capabilities} />
    {section === 'pull-requests' ? <section className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-auto">
      {repositoryUrl && <a href={`${repositoryUrl}/pulls`} target="_blank" rel="noopener noreferrer" className="mx-4 mt-5 inline-flex rounded text-sm text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @3xl/repository:mx-6">All pull requests on GitHub</a>}
      <RepositoryPullRequests projectId={projectId} currentDelivery={currentDelivery} revision={revision} />
    </section> : <>
    {error && <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-relaxed text-destructive">{error}</p>}
    {!tree && !error && <p role="status" className="p-6 text-sm text-muted-foreground">Loading repository…</p>}
    {section === 'branches' ? tree && <section aria-label="Saved branches" className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-auto px-4 py-5 @3xl/repository:px-6">
      <p className="mb-5 text-sm text-muted-foreground">Branches available in your saved workspace. Choose one to browse its files.</p>
      {tree.branches.length === 0 && <p className="text-sm text-muted-foreground">No saved branches yet.</p>}
      <ul className="divide-y divide-border">{tree.branches.map((name) => <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm"><GitBranch aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="break-all">{name}</span>{name === tree.head && <span className="text-xs text-muted-foreground">Current</span>}</span>
        <button type="button" onClick={() => { setBranch(name); setPath(null); setSection('code') }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Browse files</button>
      </li>)}</ul>
      {repositoryUrl && <a href={`${repositoryUrl}/branches`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage branches on GitHub</a>}
    </section> : tree && <section className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-auto px-4 py-5 @3xl/repository:px-6">
      {tree.truncated && <p className="px-6 py-3 text-xs text-muted-foreground">This listing is limited. Folder totals include only the files shown here.</p>}
      <section>
        <section ref={tableRegion} tabIndex={-1} aria-label="Repository file browser" hidden={path !== null} className="min-w-0 space-y-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RepositoryTable files={tree.files} selectedPath={path} onSelect={(nextPath) => { fileOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPath(nextPath) }} branchControl={branchControl} branchCount={tree.branches.length} onBrowseBranches={() => setSection('branches')} />
        </section>
        {path && <section aria-label="File preview" className="flex min-h-96 min-w-0 flex-col overflow-hidden rounded-xl border border-border">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
            <p className="break-all font-mono text-xs text-foreground">{path}</p>
          </header>
          {busy || (file !== null && file.path !== path) ? <p role="status" className="p-4 text-sm">Loading file…</p> : file?.binary ? <p className="p-4 text-sm">Preview is unavailable for binary files.</p> : file && <>
            {file.truncated && <p className="px-4 py-2 text-xs">Showing the first part of this file. The preview has been limited by the server.</p>}
            <section className="min-h-96 flex-1"><Editor height="60vh" language={getLanguageFromPath(file.path)} value={file.content ?? ''} theme={codeTheme === 'dark' ? 'vs-dark' : 'vs'} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }} /></section>
          </>}
        </section>}
      </section>
    </section>}
    </>}
  </section>
}

export function SavedProjectHistory({ projectId, open, onClose, variant = 'popover' }: { projectId?: string; open: boolean; onClose: () => void; variant?: 'popover' | 'sheet'; onRestored?: () => void; getAuthHeader?: () => Promise<Record<string,string>> }) {
  const [history, setHistory] = useState<BackendHistory | null>(null)
  const [changes, setChanges] = useState<BackendChanges | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!open || !projectId) return
    const controller = new AbortController(); setHistory(null); setChanges(null); setSelected(null); setError(null)
    currentBackend().history(projectId, controller.signal).then((value) => { if (!controller.signal.aborted) setHistory(value) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load history.') })
    return () => controller.abort()
  }, [projectId, open, revision])
  useEffect(() => {
    if (!open || !projectId || !selected) return
    const controller = new AbortController(); setChanges(null); setError(null); setLoading(true)
    currentBackend().changes(projectId, selected, controller.signal).then((value) => {
      if (value.sha !== selected) throw new Error('The server returned a different saved change.')
      if (!controller.signal.aborted) setChanges(value)
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load changes.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, selected, open])
  if (!open) return null
  return <div className={variant === 'sheet' ? 'fixed inset-x-3 bottom-[5.6rem] z-50 flex max-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:hidden' : 'fixed right-6 top-16 z-40 hidden max-h-[72dvh] w-[min(100vw-2rem,28rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:flex'}>
    <header className="flex justify-between gap-4 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold tracking-[-0.02em]">Version history</h2><p className="mt-1 text-xs text-muted-foreground">Review saved changes and their source diffs.</p></div><button className="self-start rounded-lg px-1.5 text-lg leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close version history" onClick={onClose}>×</button></header>
    <div className="overflow-auto p-3">
      {error && <div role="alert" className="text-xs text-destructive">{error}<button className="ml-3 underline" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
      {!history && !error && <p role="status" className="p-4 text-xs">Loading history…</p>}
      {history?.commits.length === 0 && <p className="p-4 text-xs text-muted-foreground">No saved versions yet.</p>}
      {history?.commits.map((commit) => <article key={commit.sha} className="mb-2 rounded-xl border border-border/70 p-3"><button className="w-full rounded-lg text-left transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground" onClick={() => setSelected(commit.sha)} aria-expanded={selected === commit.sha}><p className="text-xs font-semibold leading-relaxed">{commit.message}</p><time className="text-[11px] text-muted-foreground" dateTime={commit.committedAt}>{new Date(commit.committedAt).toLocaleString()}</time></button>
        {selected === commit.sha && <div className="mt-3">{loading && <p role="status" className="text-xs">Loading changes…</p>}{changes && <><p className="mb-2 text-xs text-muted-foreground">{changes.files.length} changed files{changes.truncated ? ' · Diff limited by server' : ''}</p><pre className="max-h-80 overflow-auto rounded-xl bg-muted p-2 font-mono text-[11px] leading-relaxed">{changes.patch}</pre></>}</div>}
      </article>)}
    </div>
  </div>
}
