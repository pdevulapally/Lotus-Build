"use client"
import { useCallback, useEffect, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
export type ProjectStatus = 'pending' | 'generating' | 'complete' | 'error' | 'draft' | 'deleting'
export type ProjectListItem = {
  id: string; prompt: string; model?: string; status: ProjectStatus; visibility?: 'public' | 'private' | 'link-only'
  createdAt?: string; updatedAt?: string; sandboxUrl?: string; workspaceId?: string; workspaceName?: string; kind?: 'project' | 'computer'
}
/** The projects of one workspace: the account's own when `workspaceId` is absent, otherwise the organisation's. */
export function useProjectList({ uid, workspaceId }: { uid?: string | null; workspaceId?: string | null }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController(); setProjects([]); setError(null)
    if (!uid) { setLoading(false); return }
    setLoading(true)
    Promise.resolve().then(() => currentBackend().projects(controller.signal, workspaceId ?? undefined)).then(({ projects: rows }) => {
      if (!controller.signal.aborted) setProjects(rows.map((project) => ({ id: project.id, prompt: project.name,
        status: project.status, createdAt: project.createdAt, workspaceId: project.workspaceId, kind: 'project' })))
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load projects.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [uid, workspaceId, revision])
  return { projects, loading, error, refresh }
}
