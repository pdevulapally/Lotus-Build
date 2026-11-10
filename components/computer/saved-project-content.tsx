"use client"
import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { currentBackend } from '@/lib/backend/browser'
import { useAuth } from '@/contexts/auth-context'
import { WorkspacePersistenceNotice } from '@/components/computer/workspace-persistence-notice'
import type { BackendFileTree, BackendFile, BackendHistory, BackendChanges } from '@/lib/backend/client'
import { buildFileTree, getLanguageFromPath } from '@/lib/projects/utils'
import { CodeTreeNode } from '@/components/computer/file-tree'

export function SavedProjectFiles({ projectId, codeTheme = 'light' }: { projectId?: string; codeTheme?: 'light' | 'dark'; files?: Array<{path: string; content: string}>; getAuthHeader?: () => Promise<Record<string, string>> }) {
  const { account } = useAuth()
  const [tree, setTree] = useState<BackendFileTree | null>(null)
  const [path, setPath] = useState<string | null>(null)
  const [file, setFile] = useState<BackendFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [downloading, setDownloading] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); setTree(null); setPath(null); setFile(null); setError(null)
    if (!projectId) { setError('The session has no project.'); return }
    currentBackend().files(projectId, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setTree(value); setPath(value.files[0]?.path ?? null) }
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load files.') })
    return () => controller.abort()
  }, [projectId, revision])
  useEffect(() => {
    if (!projectId || path === null) return
    const controller = new AbortController(); setFile(null); setBusy(true); setError(null)
    currentBackend().file(projectId, path, controller.signal).then((value) => {
      if (value.path !== path) throw new Error('The server returned a different file.')
      if (!controller.signal.aborted) setFile(value)
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not read file.') })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [projectId, path, revision])
  const download = async () => {
    if (!projectId || downloading) return
    setDownloading(true); setError(null)
    try {
      const blob = await currentBackend().archive(projectId)
      const url = URL.createObjectURL(blob); const link = document.createElement('a')
      link.href = url; link.download = `lotusbuild-${projectId}.zip`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not download project.') }
    finally { setDownloading(false) }
  }
  return <div className="flex h-full min-h-0 flex-col bg-card">
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-xs">
      <span className="font-semibold tracking-[-0.02em] text-foreground">Saved files {tree ? `(${tree.files.length}${tree.truncated ? '+' : ''})` : ''}</span>
      <div className="flex gap-4"><button className="rounded-lg font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setRevision((value) => value + 1)}>Refresh</button><button className="rounded-lg font-medium text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" disabled={!tree?.files.length || downloading} onClick={() => void download()}>{downloading ? 'Downloading…' : 'Download ZIP'}</button></div>
    </div>
    <WorkspacePersistenceNotice capabilities={account?.capabilities} />
    {error && <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-relaxed text-destructive">{error}</p>}
    {tree?.truncated && <p className="px-4 py-2 text-xs">The server has limited this file listing. The ZIP contains the saved branch.</p>}
    {!tree && !error ? <p role="status" className="p-4 text-sm">Loading files…</p> : tree?.files.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No saved files yet.</p> : <div className="flex min-h-0 flex-1">
      <nav aria-label="Project files" className="w-44 shrink-0 overflow-auto border-r border-border bg-background/50 py-2 pr-1 sm:w-60">{buildFileTree(tree!.files.map((entry) => ({ path: entry.path, content: '' }))).map((node) => <CodeTreeNode key={node.path} node={node} selectedPath={path} onSelect={setPath} />)}</nav>
      <div className="min-w-0 flex-1">{busy ? <p role="status" className="p-4 text-sm">Loading file…</p> : file?.binary ? <p className="p-4 text-sm">Binary file. Download the ZIP to open it.</p> : file && <>
        {file.truncated && <p className="px-4 py-2 text-xs">Showing the first part of this file. Download the ZIP for its full content.</p>}
        <Editor height="100%" language={getLanguageFromPath(file.path)} value={file.content ?? ''} theme={codeTheme === 'dark' ? 'vs-dark' : 'vs'} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }} />
      </>}</div>
    </div>}
  </div>
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
