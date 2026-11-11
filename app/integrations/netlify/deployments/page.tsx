'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Navbar } from '@/components/ui/navbar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { NetlifyDeploymentCard } from '@/components/integrations/netlify-deployment-card'
import type { NetlifyDeployment } from '@/lib/backend/netlify'
import styles from '../../integrations.module.css'

export default function NetlifyDeploymentsPage() {
  return <ProtectedRoute><div data-product-theme="dark" className={`dark ${styles.page}`}><Navbar /><main className={styles.main}><Suspense fallback={<p role="status">Loading deployments…</p>}><Deployments /></Suspense></main></div></ProtectedRoute>
}
function Deployments() {
  const { user } = useAuth(); const params = useSearchParams()
  const [projectId, setProjectId] = useState(params.get('projectId') ?? '')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [deployments, setDeployments] = useState<NetlifyDeployment[] | null>(null)
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    currentBackend().projects(controller.signal).then(result => { if (!controller.signal.aborted) setProjects(result.projects) }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Projects could not be loaded.') })
    return () => controller.abort()
  }, [user])
  useEffect(() => {
    if (!user || !projectId) return
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const result = await currentBackend().netlifyDeployments(projectId, controller.signal)
        if (controller.signal.aborted) return
        setDeployments(result.deployments)
        const updates = await Promise.allSettled(result.deployments.map(record => (record.status === 'processing' || (record.status === 'uncertain' && record.deployId)) ? currentBackend().refreshNetlifyDeployment(projectId, record.id, controller.signal).then(value => value.deployment) : record))
        if (controller.signal.aborted) return
        const records = updates.map((update, index) => update.status === 'fulfilled' ? update.value : result.deployments[index]!)
        setDeployments(records)
        if (updates.some(update => update.status === 'rejected')) { setError('Some deployment statuses could not be updated. Saved records are shown. Check connection access and use Refresh to try again.'); return }
        if (records.some(record => record.status === 'processing' || record.status === 'uploading' || (record.status === 'preparing' && Date.parse(record.expiresAt) > Date.now()))) timer = setTimeout(() => void load(), 5000)
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Deployments could not be loaded. Use Refresh to check again.') }
    }
    setDeployments(null); setError(null); void load()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [user, projectId, revision])
  const submit = async (record: NetlifyDeployment, action: 'approve' | 'reject') => {
    setBusy(record.id); setActionError(null)
    try {
      const backend = currentBackend()
      if (action === 'approve') await backend.approveNetlifyDeployment(projectId, record.id, record.sha256)
      else await backend.rejectNetlifyDeployment(projectId, record.id)
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'The outcome could not be confirmed. Refresh before trying again.') }
    finally { setBusy(null); setRevision(value => value + 1) }
  }
  return <>
    <header className={styles.intro}><Link href="/integrations" className="text-sm underline underline-offset-4">Integrations</Link><h1 className={styles.title}>Netlify deployments</h1><p className={styles.lead}>Review a build, publish it to your account, and return to its links whenever you need them.</p></header>
    <div className="flex flex-wrap items-end gap-4"><label className="grid min-w-56 gap-2 text-sm">Project<select value={projectId} disabled={busy !== null} onChange={event => { setProjectId(event.target.value); setDeployments(null) }} className="rounded-md border border-border bg-background px-3 py-2"><option value="">Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><Button variant="outline" disabled={!projectId || busy !== null} onClick={() => setRevision(value => value + 1)}>Refresh</Button></div>
    {error && <p role="alert" className={styles.message}>{error}</p>}
    {actionError && <p role="alert" className={styles.message}>{actionError}</p>}
    {projectId && deployments === null && !error && <p role="status">Loading deployments…</p>}
    {projectId && deployments?.length === 0 && <p className={styles.lead}>No deployments yet. Connect Netlify, grant this project access, and ask the agent to build and prepare it for deployment.</p>}
    <ul className="grid list-none gap-6 p-0">{deployments?.map(record => <NetlifyDeploymentCard key={record.id} record={record} busy={busy !== null} onSubmit={action => void submit(record, action)} />)}</ul>
    <p className="text-sm text-muted-foreground">Published links do not depend on your LotusBuild workspace running. They remain available while the Netlify deployment and account are retained.</p>
  </>
}
