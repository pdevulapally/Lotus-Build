'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { currentBackend } from '@/lib/backend/browser'
import { sessionSchema, type BackendMessage, type BackendProject, type BackendSession, type SessionEvent } from '@/lib/backend/client'
import type { ComputerTimelineEvent } from '@/components/computer/session-types'
import { followSessionEvents } from '@/lib/backend/session-events'
import { previewUrl } from '@/lib/preview'
import { computerActionLabel, isComputerAction, reduceDesktop, type DesktopState } from '@/lib/backend/desktop'
import {
  commandOutputText,
  getRunCommandInput,
  redactSecrets,
  reduceTerminal,
  type TerminalEntry,
} from '@/lib/backend/terminal'

const labels: Record<string, string> = {
  'session.queued': 'Build queued', 'session.running': 'Build running', 'session.idle': 'Ready for your next message',
  'session.failed': 'Build stopped', 'session.cancel_requested': 'Cancellation requested', 'session.awaiting_input': 'Waiting for your answer',
  'sandbox.started': 'Workspace started', 'project.restored': 'Project restored', 'preview.ready': 'Preview ready',
  'project.saved': 'Project saved', 'project.save_failed': 'Project save failed', 'agent.finished': 'Agent finished',
  'agent.blocked': 'Agent needs attention', 'agent.specialist_started': 'Review started', 'agent.specialist_completed': 'Review completed',
}
const fileTools = ['write_file', 'edit_file'] as const
type FileTool = (typeof fileTools)[number]
function isFileTool(name: unknown): name is FileTool { return typeof name === 'string' && (fileTools as readonly string[]).includes(name) }

/** The file path and before/after text a write_file or edit_file call carries, so the feed can draw the diff. */
export function getFileToolInput(name: FileTool, input: unknown): { filePath: string; editVariant: 'edit' | 'write'; oldContent?: string; newContent: string } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const record = input as Record<string, unknown>
  const filePath = typeof record.path === 'string' ? record.path.trim() : ''
  if (!filePath) return null
  if (name === 'edit_file') {
    if (typeof record.old_string !== 'string' || typeof record.new_string !== 'string') return null
    return { filePath, editVariant: 'edit', oldContent: record.old_string, newContent: record.new_string }
  }
  if (typeof record.content !== 'string') return null
  return { filePath, editVariant: 'write', newContent: record.content }
}

const runningToolTitles = ['Running command', 'Editing file', 'Creating file'] as const
function isRunningToolItem(item: ComputerTimelineEvent): boolean {
  return item.status === 'running' && (runningToolTitles as readonly string[]).includes(item.title)
}

export function activity(event: SessionEvent, index: number): ComputerTimelineEvent | null {
  if (!event.id) return null
  if (event.type === 'agent.tool_call' && event.data.name === 'run_command') {
    const command = getRunCommandInput(event.data.input)
    if (command !== null) {
      const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
      return {
        id: event.id,
        title: 'Running command',
        status: 'running',
        kind: 'code',
        createdAt: new Date(Number(event.id.split('-')[0])).toISOString(),
        index,
        metadata: { command: redactSecrets(command), ...(callId ? { callId } : {}) },
      }
    }
  }
  if (event.type === 'agent.tool_result' && event.data.name === 'run_command') return null
  if (event.type === 'agent.tool_call' && isFileTool(event.data.name)) {
    const file = getFileToolInput(event.data.name, event.data.input)
    if (file !== null) {
      const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
      return {
        id: event.id,
        title: file.editVariant === 'edit' ? 'Editing file' : 'Creating file',
        status: 'running',
        kind: 'code',
        createdAt: new Date(Number(event.id.split('-')[0])).toISOString(),
        index,
        metadata: { ...file, ...(callId ? { callId } : {}) },
      }
    }
  }
  if (event.type === 'agent.tool_result' && isFileTool(event.data.name)) return null

  const tool = event.type === 'agent.tool_call' || event.type === 'agent.tool_result'
  const name = typeof event.data.name === 'string' ? event.data.name : ''
  const input = event.data.input && typeof event.data.input === 'object' && !Array.isArray(event.data.input)
    ? event.data.input as Record<string, unknown>
    : {}
  const title = event.type === 'agent.tool_call' && isComputerAction(name)
    ? computerActionLabel(name, input)
    : tool && name ? `${event.type === 'agent.tool_call' ? 'Using' : 'Finished'} ${name.slice(0, 100)}`
    : event.type === 'agent.skill_used' ? `Used skill ${String(typeof event.data.title === 'string' && event.data.title ? event.data.title : name || 'skill').slice(0, 100)}` : labels[event.type]
  if (!title) return null
  // run_command input/output is shown after redaction; other tools stay label-only.
  const description = typeof event.data.summary === 'string' ? event.data.summary.slice(0, 2000)
    : typeof event.data.error === 'string' ? event.data.error.slice(0, 2000) : undefined
  return { id: event.id, title, status: event.type.endsWith('failed') || event.data.isError === true ? 'error' : 'complete',
    kind: tool ? 'code' : 'planning', createdAt: new Date(Number(event.id.split('-')[0])).toISOString(), index,
    ...(description ? { description } : {}) }
}

function updateCommandEvent(events: ComputerTimelineEvent[], event: SessionEvent): ComputerTimelineEvent[] {
  if (event.type !== 'agent.tool_result' || (event.data.name !== 'run_command' && !isFileTool(event.data.name))) return events
  const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
  let index = -1
  for (let current = events.length - 1; current >= 0; current -= 1) {
    const candidate = events[current]
    if (callId ? candidate.metadata?.callId === callId : isRunningToolItem(candidate)) {
      index = current
      break
    }
  }
  if (index < 0) return events

  const rawText = typeof event.data.text === 'string' ? event.data.text : ''
  const parsed = commandOutputText(redactSecrets(rawText))
  const current = events[index]
  const next = events.slice()
  next[index] = {
    ...current,
    status: event.data.isError === true ? 'error' : 'complete',
    metadata: { ...current.metadata, commandOutput: parsed.output },
  }
  return next
}

function completeRunningCommandEvents(events: ComputerTimelineEvent[]): ComputerTimelineEvent[] {
  let changed = false
  const next = events.map((event) => {
    if (!isRunningToolItem(event)) return event
    changed = true
    return { ...event, status: 'complete' as const }
  })
  return changed ? next : events
}

export function useBackendSession(id: string, user: User | null, authLoading: boolean) {
  const [session, setSession] = useState<BackendSession | null>(null)
  const [project, setProject] = useState<BackendProject | null>(null)
  const [messages, setMessages] = useState<BackendMessage[]>([])
  const [queued, setQueued] = useState<{ id: string; prompt: string }[]>([])
  const [events, setEvents] = useState<ComputerTimelineEvent[]>([])
  const [terminal, setTerminal] = useState<TerminalEntry[]>([])
  const [desktop, setDesktop] = useState<DesktopState>({ status: 'none' })
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting')
  const scopeRef = useRef('')
  const [stopping, setStopping] = useState(false)
  const [revision, setRevision] = useState(0)
  const refreshRef = useRef<() => Promise<void>>(async () => { throw new Error('Session data is not loaded.') })
  const refresh = useCallback(() => refreshRef.current(), [])
  const reconnect = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    if (authLoading) return
    const controller = new AbortController(); const signal = controller.signal
    const scope = `${user?.uid ?? ''}:${id}`
    const sameScope = scopeRef.current === scope
    scopeRef.current = scope
    if (!sameScope) {
    setSession(null); setProject(null); setMessages([]); setQueued([]); setEvents([]); setTerminal([]); setText(''); setPreview(null)
    setDesktop({ status: 'none' })
    setError(null); setStreamError(null); setStopping(false); setLoading(true)
    setFileCount(null); setFileError(null)
    }
    setConnection(navigator.onLine ? 'connecting' : 'offline')
    if (!user) { setError('Sign in to open this session.'); setLoading(false); return }
    let loadVersion = 0
    let streamText = ''
    let refreshFailed = false
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let textFrame: number | undefined
    const flushText = () => { textFrame = undefined; setText(streamText) }
    const scheduleText = () => { if (textFrame === undefined) textFrame = requestAnimationFrame(flushText) }
    const reload = async () => {
      const version = ++loadVersion
      const client = currentBackend()
      const [next, history, waiting] = await Promise.all([client.session(id, signal), client.messages(id, signal), client.queuedMessages(id, signal)])
      const parent = await client.project(next.projectId, signal)
      if (next.id !== id || parent.id !== next.projectId) throw new Error('The server returned a mismatched session or project.')
      if (signal.aborted || version !== loadVersion) return
      setSession(next); setStopping(next.cancelRequested === true); setProject(parent); setMessages(history.messages); setQueued(waiting.queuedMessages)
      void client.files(parent.id, signal).then((tree) => {
        if (!signal.aborted && version === loadVersion) { setFileCount(tree.truncated ? null : tree.files.length); setFileError(tree.truncated ? 'File listing is limited by the server. Open Code to inspect the saved files.' : null) }
      }).catch((reason) => { if (!signal.aborted && version === loadVersion) { setFileCount(null); setFileError(reason instanceof Error ? reason.message : 'Could not load saved files.') } })
      refreshFailed = false; setStreamError(null)
      if (next.status === 'IDLE' || next.status === 'FAILED') { streamText = ''; setText('') }
    }
    refreshRef.current = reload
    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        void reload().catch((reason) => {
          if (!signal.aborted) { refreshFailed = true; setStreamError(reason instanceof Error ? reason.message : 'Session refresh failed.') }
        })
      }, 150)
    }
    void (async () => {
      try { await reload(); if (!signal.aborted) setLoading(false) }
      catch (reason) { if (!signal.aborted) { const message = reason instanceof Error ? reason.message : 'Could not load session.'; if (sameScope) setStreamError(message); else setError(message); setLoading(false) }; return }
      await followSessionEvents(currentBackend(), id, {
          onReconcile: reload,
          onReconnecting: () => { if (!signal.aborted) setConnection(navigator.onLine ? 'reconnecting' : 'offline') },
          onReset: () => { streamText = ''; setText(''); setEvents([]); setTerminal([]); setDesktop({ status: 'none' }); setPreview(null) },
          onState: (state) => {
            const next = sessionSchema.parse(state)
            if (next.id !== id) throw new Error('Mismatched session state.')
            setSession(next)
            scheduleRefresh()
            setStopping(next.cancelRequested === true)
            if (next.status === 'IDLE' || next.status === 'FAILED') { streamText = ''; setText('') }
          },
          signal, refreshToken: () => user.getIdToken(true), onError: setStreamError, onConnected: () => { setConnection('connected'); setStreamError(null) },
          onEvent: (event) => {
            if (signal.aborted) return
            if (event.type === 'preview.ready') setPreview(previewUrl(event.data.url, window.location.origin))
            setDesktop((current) => reduceDesktop(current, event))
            if (event.type === 'session.running') { streamText = ''; if (textFrame !== undefined) { cancelAnimationFrame(textFrame); textFrame = undefined }; setText('') }
            if (event.type === 'agent.text') {
              if (typeof event.data.delta !== 'string') throw new Error('The server returned an invalid text event.')
              streamText += event.data.delta
              if (streamText.length > 200_000) throw new Error('The live response exceeds the display limit. Reopen the session to load its saved messages.')
              scheduleText()
            }
            setTerminal((current) => reduceTerminal(current, event))
            if (event.type === 'agent.tool_result' && (event.data.name === 'run_command' || isFileTool(event.data.name))) {
              setEvents((current) => updateCommandEvent(current, event))
            }
            const item = activity(event, Number(event.id.split('-')[0]))
            if (item) setEvents((current) => [...current, item].slice(-300))
            if (event.type === 'session.cancel_requested') setStopping(true)
            if (event.type === 'session.idle' || event.type === 'session.failed') {
              setStopping(false)
              streamText = ''; if (textFrame !== undefined) { cancelAnimationFrame(textFrame); textFrame = undefined }; setText('')
              setEvents((current) => completeRunningCommandEvents(current))
            }
            if (['session.running', 'session.queued', 'session.idle', 'session.failed', 'session.awaiting_input', 'session.message_queued', 'session.message_dequeued', 'project.saved'].includes(event.type)) scheduleRefresh()
            if (!refreshFailed) setStreamError(null)
          },
      })
    })()
    const offline = () => { setConnection('offline'); setStreamError('You are offline. Showing the last confirmed task state.') }
    const online = () => { setConnection('reconnecting'); reconnect() }
    window.addEventListener('offline', offline); window.addEventListener('online', online)
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); controller.abort(); if (refreshTimer !== undefined) clearTimeout(refreshTimer); if (textFrame !== undefined) cancelAnimationFrame(textFrame); refreshRef.current = async () => { throw new Error('The session connection is closed.') } }
  }, [id, user, authLoading, revision])
  return { session, project, messages, queued, events, terminal, desktop, text, stopping, setStopping, preview: project?.publicPreviewEnabled === true ? preview : null,
    fileCount, fileError, loading, error, streamError, connection, refresh, reconnect }
}
