'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { currentTaskBackend } from '@/lib/backend/browser'
import { type TaskClient } from '@/lib/backend/client'
import { clearCreatedTaskDraft } from '@/lib/tasks/draft-transfer'
import { runTaskCommand, pendingTaskCommandKey, readPendingCommand, replayPendingCommand } from '@/lib/tasks/commands'
import { shouldPollTask, type TaskSession, type ApprovalDecision } from '@/lib/tasks/contract'

export function useTaskWorkspace(uid: string, sessionId: string | null, onCreated: (id: string) => void) {
  const [session, setSession] = useState<TaskSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!sessionId)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(false)
  const [retry, setRetry] = useState(0)
  const active = useRef(0)
  const pollEpoch = useRef(0)
  const busyRef = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const current = useRef<TaskSession | null>(null)
  const accept = useCallback((next: TaskSession) => {
    setSession(previous => previous?.id === next.id && previous.revision > next.revision ? previous : next)
    if (!current.current || current.current.id !== next.id || current.current.revision <= next.revision) current.current = next
  }, [])

  useEffect(() => {
    try { setPendingRequest(!!readPendingCommand(sessionStorage, pendingTaskCommandKey(uid, sessionId))) } catch { setPendingRequest(true) }
    const version = ++active.current
    const abort = new AbortController(); controller.current = abort
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    current.current = null; busyRef.current = false
    setSession(null); setError(null); setBusy(false); setLoading(!!sessionId); setConnected(false)
    if (!sessionId) { setLoading(false); return () => { active.current++; abort.abort() } }
    async function poll() {
      if (busyRef.current) { timer = setTimeout(poll, 1500); return }
      const epoch = pollEpoch.current
      try {
        const next = await currentTaskBackend(uid).read(sessionId!, abort.signal)
        if (version !== active.current) return
        if (epoch !== pollEpoch.current) { timer = setTimeout(poll, 1500); return }
        accept(next); setConnected(true); setError(null); failures = 0
        if (shouldPollTask(next)) timer = setTimeout(poll, 1500)
      } catch (cause) {
        if (version !== active.current || abort.signal.aborted) return
        if (epoch !== pollEpoch.current) { timer = setTimeout(poll, 1500); return }
        setConnected(false); setError(cause instanceof Error ? cause.message : 'Could not load this task.')
        if (++failures < 4) timer = setTimeout(poll, Math.min(1500 * 2 ** failures, 12000))
      } finally { if (version === active.current) setLoading(false) }
    }
    void poll()
    return () => { active.current++; abort.abort(); clearTimeout(timer) }
  }, [uid, sessionId, retry, accept])

  const mutate = useCallback(async (fingerprint: string, action: (api: TaskClient, key: string, signal: AbortSignal) => Promise<TaskSession>, repeatableIntent = false) => {
    if (busyRef.current) return false
    const version = active.current
    pollEpoch.current++ // Invalidate reads begun before this mutation, including same-revision states.
    busyRef.current = true; setBusy(true); setError(null)
    try {
      const replaying = !repeatableIntent && !!readPendingCommand(sessionStorage, pendingTaskCommandKey(uid, sessionId))
      const invoke = (key: string) => action(currentTaskBackend(uid), key, controller.current?.signal ?? new AbortController().signal)
      // Cancel is a repeatable durable intent, and must remain available after an uncertain message.
      const next = repeatableIntent ? await invoke('') : await runTaskCommand(sessionStorage, uid, sessionId, fingerprint, invoke)
      if (version !== active.current) return false
      // A receipt may contain the original queued snapshot, not the current server state.
      if (!replaying) accept(next)
      setConnected(true)
      if (sessionId !== next.id) {
        try { const command = JSON.parse(fingerprint); if (command[0] === 'create') clearCreatedTaskDraft(sessionStorage, uid, command[1], command[2]) } catch { /* Receipt is resolved; never repeat execution to clear a draft. */ }
        onCreated(next.id)
      }
      else setRetry(value => value + 1)
      return true
    } catch (cause) {
      if (version === active.current) setError(cause instanceof Error ? cause.message : 'The result is uncertain. Retry this same action before starting another.')
      return false
    } finally { if (version === active.current) {
      busyRef.current = false; setBusy(false)
      try { setPendingRequest(!!readPendingCommand(sessionStorage, pendingTaskCommandKey(uid, sessionId))) } catch { setPendingRequest(true) }
    } }
  }, [accept, onCreated, sessionId, uid])

  const resolvePending = async () => {
    try {
      const pending = readPendingCommand(sessionStorage, pendingTaskCommandKey(uid, sessionId))
      if (!pending) { setPendingRequest(false); return false }
      return await mutate(pending.fingerprint, (api, _key, signal) => replayPendingCommand(api, sessionId, pending, signal))
    } catch { setError('The pending request cannot be read. Do not repeat it with a new identity.'); return false }
  }
  return { session, error, loading, busy, connected, pendingRequest, resolvePending,
    refresh: () => setRetry(value => value + 1),
    create: (task: string, kind: 'code' | 'desktop') => mutate(JSON.stringify(['create', task, kind]), (api, key, signal) => api.create(task, kind, key, signal)),
    send: (content: string) => mutate(JSON.stringify(['message', sessionId, content]), (api, key, signal) => api.message(sessionId!, content, key, signal)),
    approve: (approvalId: string, decisions: ApprovalDecision[]) => mutate(JSON.stringify(['approve', sessionId, approvalId, decisions]), (api, key, signal) => api.approve(sessionId!, approvalId, decisions, key, signal)),
    cancel: () => mutate(JSON.stringify(['cancel', sessionId]), (api, _key, signal) => api.cancel(sessionId!, signal), true),
  }
}
