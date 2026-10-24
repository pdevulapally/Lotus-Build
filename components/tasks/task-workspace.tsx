'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell, Stack } from '@astryxdesign/core'
import { ArrowUp, ArrowUpRight, CirclePause, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTaskWorkspace } from '@/hooks/use-task-workspace'
import { canCancelTask, canReplyToTask, messageText, taskStatusLabels } from '@/lib/tasks/contract'
import { pendingTaskCommandKey, readPendingCommand } from '@/lib/tasks/commands'
import { TaskApproval } from './task-approval'
import { claimTaskDraft, clearCreatedTaskDraft, clearTaskDraft, saveTaskDraft } from '@/lib/tasks/draft-transfer'

export function TaskWorkspace() {
  const { user, loading } = useAuth()
  if (loading) return <Stack padding={8}><p role="status">Checking your sign-in…</p></Stack>
  if (!user) return <Stack padding={8} gap={4}><h1 className="text-2xl font-semibold">Your next task starts here.</h1><p>Sign in to open your private workspace.</p><Link href="/login?redirect=%2Ftasks" className="underline">Sign in</Link></Stack>
  if (!process.env.NEXT_PUBLIC_AGENT_BACKEND_URL) return <Stack padding={8} gap={4}><h1 className="text-2xl font-semibold">The new workspace is not connected yet.</h1><p className="text-muted-foreground">A separate agent API must be configured before tasks can run. No connection to the retired backend will be attempted.</p><Link href="/" className="underline">Return to LotusBuild</Link></Stack>
  return <AuthenticatedWorkspace key={user.uid} uid={user.uid} />
}

function AuthenticatedWorkspace({ uid }: { uid: string }) {
  const router = useRouter(); const search = useSearchParams()
  const id = search.get('session')
  const onCreated = useCallback((sessionId: string) => router.replace(`/tasks?session=${encodeURIComponent(sessionId)}`), [router])
  const task = useTaskWorkspace(uid, id, onCreated)
  return <TaskWorkspaceView uid={uid} id={id} task={task} onCreated={onCreated} onNew={() => router.push('/tasks')} />
}

export function TaskWorkspaceView({ uid, id, task, onCreated, onNew }: {
  uid: string; id: string | null; task: ReturnType<typeof useTaskWorkspace>; onCreated: (id: string) => void; onNew: () => void
}) {
  const [draft, setDraft] = useState('')
  const [kind, setKind] = useState<'code' | 'desktop'>('code')
  const [openId, setOpenId] = useState('')
  const [draftNotice, setDraftNotice] = useState('')
  useEffect(() => {
    setDraft(''); setDraftNotice('')
    try {
      const pending = readPendingCommand(sessionStorage, pendingTaskCommandKey(uid, id))
      if (!pending) {
        if (!id) { const incoming = claimTaskDraft(sessionStorage, uid); if (incoming) { setDraft(incoming.text); setKind(incoming.kind); setDraftNotice('Your draft is ready. Review it, then select Start task. Nothing has run yet.') } }
        return
      }
      const command = JSON.parse(pending.fingerprint)
      if (command[0] === 'create') { setDraft(command[1]); setKind(command[2]) }
      if (command[0] === 'message') setDraft(command[2])
    } catch { setDraftNotice('Your saved draft could not be read. Existing uncertain requests must still be resolved before a new task.') }
  }, [uid, id])
  const session = task.session
  const messages = session?.messages.map(message => ({ role: message.role, text: messageText(message) })).filter(message => message.text) ?? []
  const canWrite = !id || !!session && canReplyToTask(session)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft.trim() || !canWrite || task.busy) return
    const done = id ? await task.send(draft.trim()) : await task.create(draft.trim(), kind)
    if (done) { setDraft(''); setDraftNotice(''); if (!id) { try { clearCreatedTaskDraft(sessionStorage, uid, draft, kind) } catch { /* Server success is authoritative; no repeated submission. */ } } }
  }
  const updateDraft = (text: string, nextKind = kind) => {
    setDraft(text); setKind(nextKind)
    if (!id) { try { if (text.trim()) saveTaskDraft(sessionStorage, uid, text, nextKind, true); else clearTaskDraft(sessionStorage, uid) } catch { setDraftNotice('Draft changes could not be saved for reload. Keep this page open.') } }
  }
  return <AppShell className="task-workspace-theme" variant="wash" height="auto" contentPadding={0} topNav={<Stack as="header" direction="horizontal" hAlign="between" vAlign="center" padding={6} gap={3}>
    <Link href="/" aria-label="LotusBuild home" className="inline-flex items-center gap-2 font-semibold"><img src="/Images/lotusbuild-icon.svg" alt="" width={28} height={28} />LotusBuild</Link>
    <Stack direction="horizontal" gap={2} vAlign="center"><Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground">Account</Link><span className="hidden text-xs text-muted-foreground sm:inline">New workspace · Preview</span><Button variant="ghost" onClick={() => { setDraft(''); setDraftNotice(''); try { clearTaskDraft(sessionStorage, uid) } catch {} onNew() }} disabled={task.busy}><Plus size={16} />New task</Button></Stack>
  </Stack>}>
    <Stack className="mx-auto min-h-svh w-full max-w-4xl px-5 pb-10 sm:px-10" gap={8}>
      <Stack as="section" gap={3} className="pt-8 sm:pt-14">
        <p className="text-sm text-muted-foreground">A space to think, build and get things done.</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{id ? 'Let’s move this forward.' : 'What would you like to work on?'}</h1>
        {!id && <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Start with a goal. Follow the work, review actions that need your permission, and pick up where you left off.</p>}
      </Stack>
      {id && <Stack direction="horizontal" hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Stack gap={1}><p role="status" className="font-medium">{session ? taskStatusLabels[session.status] : task.loading ? 'Opening your task…' : 'Task unavailable'}</p><p className="text-xs text-muted-foreground">{task.connected ? 'Showing saved server state' : 'Not connected'}{session && ` · Revision ${session.revision}`}</p></Stack>
        <Stack direction="horizontal" gap={2}><Button variant="ghost" onClick={task.refresh} disabled={task.busy}><RefreshCw size={16} />Refresh</Button>{session && canCancelTask(session) && <Button variant="outline" onClick={() => void task.cancel()} disabled={task.busy}><CirclePause size={16} />Stop task</Button>}</Stack>
      </Stack>}
      {task.pendingRequest && <Stack role="status" gap={3} className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">A request needs reconciliation</h2><p className="text-sm text-muted-foreground">Its acknowledgement was not saved. Resolve the original request with the same identity before starting a different action. This does not approve any new action.</p><Button variant="outline" className="self-start" disabled={task.busy} onClick={() => void task.resolvePending()}>Resolve pending request</Button></Stack>}
      {task.error && <Stack role="alert" gap={2} className="rounded-xl bg-muted p-4"><p>{task.error}</p><p className="text-sm text-muted-foreground">If an action’s result is uncertain, retry that same action. Do not submit a different task as a workaround.</p></Stack>}
      {session?.recovery_required && <Stack role="alert" gap={2} className="rounded-xl bg-muted p-5"><h2 className="font-semibold">This task needs a review</h2><p className="text-sm">Execution was interrupted and an action may already have happened. Automatic retry is blocked to avoid repeating it. Check the external result before starting another task.</p></Stack>}
      {session?.error && <p role="alert" className="text-sm text-destructive">{session.error}</p>}
      {messages.length > 0 && <Stack as="section" gap={6} aria-label="Conversation">{messages.map((message, index) => <Stack as="article" key={index} gap={2} className={message.role === 'user' ? 'ml-6 rounded-xl bg-muted p-5 sm:ml-16' : 'pr-5'}><h2 className="text-xs font-semibold text-muted-foreground">{message.role === 'user' ? 'You' : 'LotusBuild'}</h2><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.text}</p></Stack>)}</Stack>}
      {session?.status === 'awaiting_approval' && session.pending_approval && <TaskApproval key={session.pending_approval.id} session={session} busy={task.busy} onDecision={task.approve} />}
      {!id && draftNotice && <p role="status" className="text-sm text-muted-foreground">{draftNotice}</p>}
      {canWrite && <form onSubmit={submit} className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
        <label htmlFor="task-prompt" className="sr-only">{id ? 'Your next message' : 'Describe your task'}</label>
        <Textarea id="task-prompt" value={draft} onChange={event => updateDraft(event.target.value)} maxLength={32000} disabled={task.busy} placeholder={id ? 'What should we do next?' : 'Describe what you want to get done…'} className="min-h-32 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0" />
        <Stack direction="horizontal" hAlign="between" vAlign="center" gap={3} className="pt-4">
          {!id ? <label className="flex items-center gap-2 text-xs text-muted-foreground">Workspace<select value={kind} onChange={event => updateDraft(draft, event.target.value as 'code' | 'desktop')} disabled={task.busy} className="rounded-lg bg-muted p-2 text-foreground"><option value="code">Code</option><option value="desktop">Desktop</option></select></label> : <span className="text-xs text-muted-foreground">Your conversation is saved by the server.</span>}
          <Button type="submit" disabled={task.busy || !draft.trim()}><ArrowUp size={16} />{task.busy ? 'Sending…' : id ? 'Send' : 'Start task'}</Button>
        </Stack>
      </form>}
      {session?.status === 'cancel_requested' && <p className="text-sm text-muted-foreground">Stop requested. An in-progress action may need time to finish; no new action should start. We’ll keep checking.</p>}
      {session?.status === 'cancelled' && <p className="text-sm text-muted-foreground">This task is stopped. Its saved conversation remains available.</p>}
      {!id && <Stack as="section" gap={3} className="pb-10"><h2 className="text-sm font-medium">Pick up an existing task</h2><form onSubmit={event => { event.preventDefault(); if (/^[A-Za-z0-9_-]{1,128}$/.test(openId)) onCreated(openId) }} className="flex gap-2"><input aria-label="Task ID" value={openId} onChange={event => setOpenId(event.target.value)} placeholder="Paste a task ID" className="min-w-0 flex-1 rounded-lg bg-muted px-3 text-sm" maxLength={128} /><Button variant="ghost" type="submit" disabled={!/^[A-Za-z0-9_-]{1,128}$/.test(openId)}>Open<ArrowUpRight size={16} /></Button></form><p className="text-xs text-muted-foreground">Task history, connectors and scheduled work will arrive in later stages. They are not connected in this preview.</p></Stack>}
    </Stack>
  </AppShell>
}
