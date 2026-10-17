"use client"
import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendFileTree, BackendFile, BackendHistory, BackendChanges } from '@/lib/backend/client'
import { getLanguageFromPath } from '@/lib/projects/utils'

export function SavedProjectFiles({ projectId, codeTheme = 'light' }: { projectId?: string; codeTheme?: 'light' | 'dark'; files?: Array<{path: string; content: string}>; getAuthHeader?: () => Promise<Record<string, string>> }) {
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
      <span>Saved files {tree ? `(${tree.files.length}${tree.truncated ? '+' : ''})` : ''}</span>
      <div className="flex gap-4"><button onClick={() => setRevision((value) => value + 1)}>Refresh</button><button disabled={!tree?.files.length || downloading} onClick={() => void download()}>{downloading ? 'Downloading…' : 'Download ZIP'}</button></div>
    </div>
    {error && <p role="alert" className="border-b border-border px-4 py-3 text-xs text-destructive">{error}</p>}
    {tree?.truncated && <p className="px-4 py-2 text-xs">The server has limited this file listing. The ZIP contains the saved branch.</p>}
    {!tree && !error ? <p role="status" className="p-4 text-sm">Loading files…</p> : tree?.files.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No saved files yet.</p> : <div className="flex min-h-0 flex-1">
      <nav aria-label="Project files" className="w-36 shrink-0 overflow-auto border-r border-border p-2 sm:w-56">{tree?.files.map((entry) => <button key={entry.path} title={entry.path} onClick={() => setPath(entry.path)} aria-current={path === entry.path ? 'true' : undefined} className={`block w-full truncate rounded-md px-2 py-2 text-left text-xs hover:bg-muted ${path === entry.path ? 'bg-muted' : ''}`}>{entry.path}</button>)}</nav>
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
  return <div className={variant === 'sheet' ? 'fixed inset-x-3 bottom-[5.6rem] z-50 flex max-h-[72dvh] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl sm:hidden' : 'fixed right-6 top-16 z-40 hidden max-h-[72dvh] w-[min(100vw-2rem,28rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl sm:flex'}>
    <header className="flex justify-between gap-4 border-b border-border px-4 py-3"><div><h2 className="text-sm font-semibold">Version history</h2><p className="mt-1 text-xs text-muted-foreground">Review saved changes and their source diffs.</p></div><button aria-label="Close version history" onClick={onClose}>×</button></header>
    <div className="overflow-auto p-3">
      {error && <div role="alert" className="text-xs text-destructive">{error}<button className="ml-3 underline" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
      {!history && !error && <p role="status" className="p-4 text-xs">Loading history…</p>}
      {history?.commits.length === 0 && <p className="p-4 text-xs text-muted-foreground">No saved versions yet.</p>}
      {history?.commits.map((commit) => <article key={commit.sha} className="mb-2 rounded-xl border border-border p-3"><button className="w-full text-left" onClick={() => setSelected(commit.sha)} aria-expanded={selected === commit.sha}><p className="text-xs font-medium">{commit.message}</p><time className="text-[11px] text-muted-foreground" dateTime={commit.committedAt}>{new Date(commit.committedAt).toLocaleString()}</time></button>
        {selected === commit.sha && <div className="mt-3">{loading && <p role="status" className="text-xs">Loading changes…</p>}{changes && <><p className="mb-2 text-xs">{changes.files.length} changed files{changes.truncated ? ' · Diff limited by server' : ''}</p><pre className="max-h-80 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{changes.patch}</pre></>}</div>}
      </article>)}
    </div>
  </div>
}
