'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { auth } from '@/lib/firebase'
import { BackendError, type BackendClient } from '@/lib/backend/client'
import { ongoing, type Conversation, type PrivateProject } from '@/lib/backend/conversation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function visibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}

const reason = (e: unknown) => e instanceof Error ? e.message : 'Request not confirmed. Try again.'
const labels: Record<Conversation['status'], string> = {
  queued: 'Question received.', running: 'Thinking…', clarification: 'One thing to clarify.',
  stopping: 'Stopping…', stopped: 'Stopped.', completed: 'Answered.',
  uncertain: 'The outcome could not be confirmed. The request was not repeated.',
  interrupted: 'The conversation was interrupted.',
  blocked_budget: 'No answer was generated because spending is not authorized.',
}

export function PrivateConversations() {
  const {user} = useAuth()
  const visible = useSyncExternalStore(visibility, () => !document.hidden, () => false)
  return <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
    <h1 className="text-3xl font-semibold">Private conversations</h1>
    {!user ? <Link href="/login" className="underline">Sign in to open your projects</Link>
      : auth.currentUser === user && <ProjectPicker key={user.uid} client={currentBackend()} visible={visible} />}
  </main>
}

function ProjectPicker({client, visible}: {client: BackendClient; visible: boolean}) {
  const [rows, setRows] = useState<PrivateProject[]>([])
  const [after, setAfter] = useState<string | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [project, select] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, refresh] = useState(0)
  const [creating, setCreating] = useState(false)
  const creatingNow = useRef(false)

  useEffect(() => {
    if (!visible) { setRows([]); setNext(null); return }
    const controller = new AbortController()
    setLoading(true)
    client.privateProjects(after, controller.signal).then(page => {
      if (controller.signal.aborted) return
      setRows(page.projects); setNext(page.next_cursor); setError('')
    }).catch(e => {
      if (!controller.signal.aborted) { setRows([]); setNext(null); select(null); setError(reason(e)) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [client, after, revision, visible])

  if (!visible) return null
  return <>
    <form className="flex gap-2" onSubmit={async e => {
      e.preventDefault()
      if (creatingNow.current || !name.trim()) return
      creatingNow.current = true; setCreating(true); setError('')
      try {
        const result = await client.createPrivateProject(name)
        setName(''); setAfter(null); select(result.id); refresh(n => n + 1)
      } catch (e) { setError(reason(e)) }
      finally { creatingNow.current = false; setCreating(false) }
    }}>
      <Input aria-label="Project name" placeholder="Project name" value={name} onChange={e => setName(e.target.value)} required />
      <Button disabled={creating}>Create project</Button>
    </form>
    <section aria-label="Your projects" className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="private-project">Open a project</label>
      <select id="private-project" className="w-full rounded-xl border bg-card p-2" value={project ?? ''}
        onChange={e => select(e.target.value || null)}>
        <option value="">{loading ? 'Loading projects…' : 'Choose a private project'}</option>
        {rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select>
      {next && <Button variant="ghost" disabled={loading} onClick={() => { select(null); setAfter(next) }}>Next page</Button>}
      {after && <Button variant="ghost" onClick={() => { select(null); setAfter(null) }}>First page</Button>}
    </section>
    {error && <p role="alert">{error} <button onClick={() => refresh(n => n + 1)}>Reload projects</button></p>}
    {project && <Thread key={project} project={project} client={client} />}
  </>
}

function Thread({project, client}: {project: string; client: BackendClient}) {
  const [run, setRun] = useState<Conversation | null>(null)
  const [ready, setReady] = useState(false)
  const [revision, reload] = useState(0)
  const accepted = useRef<Conversation | undefined>(undefined)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mutation = useRef<AbortController | null>(null)
  const follower = useRef<AbortController | null>(null)
  useEffect(() => () => mutation.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    follower.current = controller
    const {signal} = controller
    async function follow() {
      setReady(false)
      for await (const state of client.followConversation(project, signal, accepted.current)) {
        signal.throwIfAborted()
        accepted.current = undefined
        setRun(state); setReady(true); setError('')
      }
    }
    follow().catch(e => {
      if (signal.aborted) return
      setReady(false); setRun(null); setError(reason(e))
      if (e instanceof BackendError && [401, 403, 404].includes(e.status)) client.queries.invalidate()
    })
    return () => controller.abort()
  }, [client, project, revision])

  const waiting = run?.status === 'clarification'
  const active = run && (ongoing(run.status) || waiting)
  async function submit(stop: boolean) {
    if (mutation.current || !ready) return
    const controller = new AbortController()
    mutation.current = controller; setBusy(true); setError('')
    try {
      const result = stop && run ? await client.stopConversation(project, run.session, controller.signal)
        : active && run ? await client.steerConversation(project, run.session, text, waiting ? run.cursor : null, controller.signal)
        : await client.ask(project, text, controller.signal)
      controller.signal.throwIfAborted()
      follower.current?.abort()
      accepted.current = result
      setRun(result); setText(''); reload(n => n + 1)
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(reason(e))
        if (e instanceof BackendError && [401,403,404].includes(e.status)) {
          setReady(false); setRun(null); client.queries.invalidate()
        }
      }
    } finally { mutation.current = null; setBusy(false) }
  }
  return <section className="space-y-5 border-t pt-6" aria-label="Conversation">
    {run?.events.map(event => event.text && <div key={event.sequence}>
      <p className="text-sm font-medium text-muted-foreground">{['answer','clarify'].includes(event.kind) ? 'LotusBuild' : 'You'}</p>
      <p className="whitespace-pre-wrap break-words">{event.text}</p>
    </div>)}
    <p role="status" className="text-sm text-muted-foreground">{run ? labels[run.status] : ready ? 'Ask a question about an idea or text.' : 'Loading conversation…'}</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit(false) }}>
      <Textarea aria-label="Your message" value={text} onChange={e => setText(e.target.value)} />
      <Button disabled={busy || !ready || !text.trim() || run?.status === 'stopping'}>
        {waiting ? 'Reply' : active ? 'Send correction' : 'Ask a question'}
      </Button>
      {active && <Button type="button" variant="ghost" disabled={busy || !ready || run.status === 'stopping'} onClick={() => void submit(true)}>Stop</Button>}
    </form>
    {error && <p role="alert">{error} <button onClick={() => reload(n => n + 1)}>Reconnect</button></p>}
  </section>
}
