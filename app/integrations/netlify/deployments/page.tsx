'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Navbar } from '@/components/ui/navbar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { NetlifyDeploymentCard } from '@/components/integrations/netlify-deployment-card'
import { loadNetlifyDeploymentHistory, type NetlifyDeployment } from '@/lib/backend/netlify'
import styles from '../../integrations.module.css'

export default function NetlifyDeploymentsPage() {
  return <ProtectedRoute><div data-product-theme="dark" className={`dark ${styles.page}`}><Navbar /><main className={styles.main}><Suspense fallback={<p role="status">Loading deployments…</p>}><Deployments /></Suspense></main></div></ProtectedRoute>
}
function Deployments() {
  const { user } = useAuth(); const params = useSearchParams()
  const [projectId, setProjectId] = useState(params.get('projectId') ?? '')
  const [projectList, setProjectList] = useState<{ uid: string; projects: { id: string; name: string }[]; error?: string } | null>(null)
  const [history, setHistory] = useState<{ scope: string; deployments: NetlifyDeployment[] | null; error?: string } | null>(null)
  const [busyAction, setBusy] = useState<{ scope: string; id: string } | null>(null)
  const [actionError, setActionError] = useState<{ scope: string; message: string } | null>(null)
  const [revision, setRevision] = useState(0)
  const scope = `${user?.uid}:${projectId}`
  const busy = busyAction?.scope === scope ? busyAction.id : null
  const currentScope = useRef(scope)
  currentScope.current = scope
  const submitting = useRef(false)
  const projects = projectList?.uid === user?.uid ? projectList : null
  const deployments = history?.scope === scope ? history.deployments : null
  const error = history?.scope === scope ? history.error : null
  const requestedProject = params.get('projectId') ?? ''
  useEffect(() => { setProjectId(requestedProject) }, [requestedProject])
  useEffect(() => { setBusy(null) }, [user?.uid])
  useEffect(() => {
    currentScope.current = scope
    return () => { currentScope.current = '' }
  }, [scope])
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setProjectList(null)
    currentBackend().projects(controller.signal)
      .then(result => { if (!controller.signal.aborted) setProjectList({ uid: user.uid, projects: result.projects }) })
      .catch(() => { if (!controller.signal.aborted) setProjectList({ uid: user.uid, projects: [], error: 'Projects could not be loaded. Use Refresh to try again.' }) })
    return () => controller.abort()
  }, [user?.uid, revision])
  useEffect(() => {
    if (!user || !projectId) return
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const result = await loadNetlifyDeploymentHistory(currentBackend(), projectId, controller.signal)
        if (controller.signal.aborted) return
        const records = result.deployments
        setHistory({ scope, deployments: records, ...(result.refreshFailed ? { error: 'Some statuses could not be updated. Saved records are shown. Review Integration access and use Refresh to try again.' } : {}) })
        const expiry = records.filter(record => ['awaiting_approval', 'preparing'].includes(record.status)).map(record => Date.parse(record.expiresAt) - Date.now()).filter(delay => delay > 0)
        const active = !result.refreshFailed && records.some(record => record.status === 'processing' || record.status === 'uploading' || (record.status === 'preparing' && Date.parse(record.expiresAt) > Date.now()))
        const delay = Math.min(active ? 5000 : Infinity, ...expiry)
        if (Number.isFinite(delay)) timer = setTimeout(() => void load(), Math.max(1, Math.min(delay, 2_147_483_647)))
      } catch { if (!controller.signal.aborted) setHistory({ scope, deployments: null, error: 'Deployments could not be loaded. Use Refresh to check again. If access changed, review Integration access.' }) }
    }
    setHistory({ scope, deployments: null }); void load()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [user?.uid, projectId, revision, scope])
  const submit = async (record: NetlifyDeployment, action: 'approve' | 'reject') => {
    if (submitting.current || !user || record.projectId !== projectId) return
    if (action === 'approve' && Date.parse(record.expiresAt) <= Date.now()) {
      setActionError({ scope, message: 'This build review expired. Ask the project agent to prepare a fresh deployment.' })
      setRevision(value => value + 1)
      return
    }
    submitting.current = true
    setBusy({ scope, id: record.id }); setActionError(null)
    try {
      const backend = currentBackend()
      const result = action === 'approve' ? await backend.approveNetlifyDeployment(projectId, record.id, record.sha256)
        : await backend.rejectNetlifyDeployment(projectId, record.id)
      if (currentScope.current === scope) setHistory(previous => previous?.scope === scope ? { scope, deployments: previous.deployments?.map(item => item.id === record.id ? result.deployment : item) ?? null } : previous)
    } catch { if (currentScope.current === scope) setActionError({ scope, message: 'The outcome could not be confirmed. Check the refreshed status before trying again. For access problems, review Integration access.' }) }
    finally { submitting.current = false; if (currentScope.current === scope) { setBusy(null); setRevision(value => value + 1) } }
  }
  return <>
    <header className={styles.intro}><Link href="/integrations" className="text-sm underline underline-offset-4">Integrations</Link><h1 className={styles.title}>Netlify deployments</h1><p className={styles.lead}>Review a build, publish it to your account, and return to its links whenever you need them.</p></header>
    <div className="flex flex-wrap items-end gap-4"><label className="grid min-w-56 gap-2 text-sm">Project<select value={projectId} disabled={!projects || busy !== null} onChange={event => { setProjectId(event.target.value); setActionError(null) }} className="rounded-md border border-border bg-background px-3 py-2"><option value="">Choose a project</option>{projects?.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><Button variant="outline" disabled={busy !== null} onClick={() => setRevision(value => value + 1)}>Refresh</Button></div>
    {!projects && <p role="status">Loading projects…</p>}
    {projects?.error && <p role="alert" className={styles.message}>{projects.error}</p>}
    {projects && !projects.error && projects.projects.length === 0 && <p role="status">No projects are available yet. Create a project before preparing a deployment.</p>}
    {error && <p role="alert" className={styles.message}>{error}</p>}
    {actionError?.scope === scope && <p role="alert" className={styles.message}>{actionError.message}</p>}
    {projectId && deployments === null && !error && <p role="status">Loading deployments…</p>}
    {projectId && deployments?.length === 0 && <p className={styles.lead}>No deployments yet. Connect Netlify, grant this project access, and ask the agent to build and prepare it for deployment.</p>}
    <p className="text-sm text-muted-foreground"><Link href="/integrations#integration-access" className="underline underline-offset-4">Review Integration access</Link>{projectId && <> · <Link href={`/project/${encodeURIComponent(projectId)}`} className="underline underline-offset-4">Open project to prepare a deployment</Link></>}</p>
    <ul className="grid list-none gap-6 p-0">{deployments?.map(record => <NetlifyDeploymentCard key={record.id} record={record} busy={busy !== null} onSubmit={action => void submit(record, action)} />)}</ul>
    <p className="text-sm text-muted-foreground">Published links do not depend on your LotusBuild workspace running. They remain available while the Netlify deployment and account are retained.</p>
  </>
}
