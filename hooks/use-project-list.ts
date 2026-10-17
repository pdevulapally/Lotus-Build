"use client"
import { useCallback, useEffect, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
export type ProjectStatus = 'pending' | 'generating' | 'complete' | 'error' | 'draft' | 'deleting'
export type ProjectScope = 'user' | 'team'
export type ProjectListItem = {
  id: string; prompt: string; model?: string; status: ProjectStatus; visibility?: 'public' | 'private' | 'link-only'
  createdAt?: string; updatedAt?: string; sandboxUrl?: string; workspaceId?: string; workspaceName?: string; kind?: 'project' | 'computer'
}
export function useProjectList({ scope, uid }: { scope: ProjectScope; uid?: string | null; workspaceId?: string | null; getAuthHeader?: () => Promise<Record<string, string>> }) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController(); setProjects([]); setError(null)
    if (!uid) { setLoading(false); return }
    if (scope !== 'user') { setError('Team workspaces are not connected to the current backend yet.'); setLoading(false); return }
    setLoading(true)
    Promise.resolve().then(() => currentBackend().projects(controller.signal)).then(({ projects: rows }) => {
      if (!controller.signal.aborted) setProjects(rows.map((project) => ({ id: project.id, prompt: project.name,
        status: project.status, createdAt: project.createdAt, kind: 'project' })))
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load projects.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, uid, revision])
  return { projects, loading, error, refresh }
}
