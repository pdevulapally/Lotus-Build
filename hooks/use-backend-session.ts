'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { currentBackend } from '@/lib/backend/browser'
import { sessionSchema, type BackendMessage, type BackendProject, type BackendSession, type SessionEvent } from '@/lib/backend/client'
import type { ComputerTimelineEvent } from '@/components/computer/session-types'
import { followSessionEvents } from '@/lib/backend/session-events'
import { previewUrl, visiblePreview } from '@/lib/preview'
import { computerActionLabel, isComputerAction, reduceDesktop, type DesktopState } from '@/lib/backend/desktop'
import {
  commandOutputText,
  getRunCommandInput,
  redactSecrets,
  reduceTerminal,
  type TerminalEntry,
} from '@/lib/backend/terminal'
import { executionLabel, genericToolStepLabel, isHiddenToolStep, lifecycleFeedLabels, toolFailureLabel, toolStepLabel } from '@/lib/backend/feed-labels'
import { loadSessionSnapshot, sessionEventStatus } from '@/lib/backend/session-snapshot'
import { applyPlanEvent } from '@/lib/backend/session-plan'
import { applyDeliveryEvent } from '@/lib/backend/delivery'
import { sessionLatency } from '@/lib/backend/latency'

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

/** Text spoken before a tool step and text spoken after it are separate thoughts; keep them separate paragraphs. */
export function closeSpokenParagraph(text: string): string {
  return text.length === 0 || text.endsWith('\n\n') ? text : `${text.trimEnd()}\n\n`
}

const thinkingDisplayLimit = 200_000
/**
 * The model's reasoning for the current step, folded into one feed row that
 * grows as it streams. Any other event from the run closes it, so a step's
 * thinking sits above the actions it led to and the next step opens a new row.
 */
export function reduceThinking(events: ComputerTimelineEvent[], event: SessionEvent, index: number): ComputerTimelineEvent[] {
  const open = events.findLastIndex((item) => item.kind === 'thinking' && item.status === 'running')
  if (event.type === 'agent.thinking') {
    if (typeof event.data.delta !== 'string') throw new Error('The server returned an invalid thinking event.')
    if (!event.id || event.data.delta.length === 0) return events
    if (open === -1) {
      return [...events, { id: event.id, title: 'Thinking', kind: 'thinking', status: 'running', index,
        createdAt: new Date(Number(event.id.split('-')[0])).toISOString(), description: event.data.delta }]
    }
    const current = events[open]!
    const description = ((current.description ?? '') + event.data.delta).slice(0, thinkingDisplayLimit)
    return events.map((item, position) => position === open ? { ...item, description } : item)
  }
  if (open === -1 || !event.type.startsWith('agent.') && !event.type.startsWith('session.')) return events
  return events.map((item, position) => position === open ? { ...item, status: 'complete' as const } : item)
}

const terminalStatuses: ReadonlySet<BackendSession['status']> = new Set(['IDLE', 'STOPPED', 'FAILED'])
/** The server has nothing running for this session. */
export function isTerminalStatus(status: BackendSession['status']): boolean { return terminalStatuses.has(status) }
/** The server has accepted a Stop for the run that is still winding down. Only the server clears this, by ending the run. */
export function isStopping(session: Pick<BackendSession, 'status' | 'cancelRequested'> | null): boolean {
  return session !== null && !isTerminalStatus(session.status) && session.cancelRequested === true
}

/**
 * Events carry the run they belong to once the server numbers runs. One that
 * arrives after a later run has already been seen is stale and must not touch
 * live state; history replays in order, so this never hides earlier runs.
 */
export function eventExecution(event: SessionEvent): number | undefined {
  const value = event.data.execution
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function isRunningToolItem(item: ComputerTimelineEvent): boolean {
  return item.status === 'running' && typeof item.metadata?.toolName === 'string'
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
        metadata: { toolName: 'run_command', command: redactSecrets(command), ...(callId ? { callId } : {}) },
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
        metadata: { toolName: event.data.name, ...file, ...(callId ? { callId } : {}) },
      }
    }
  }
  if (event.type === 'agent.tool_result' && isFileTool(event.data.name)) return null

  const tool = event.type === 'agent.tool_call' || event.type === 'agent.tool_result'
  const name = typeof event.data.name === 'string' ? event.data.name : ''
  if (tool && isHiddenToolStep(name)) return null
  // A result closes the row its call opened (see updateToolStepEvent); it never adds a second one.
  if (event.type === 'agent.tool_result') return null
  const input = event.data.input && typeof event.data.input === 'object' && !Array.isArray(event.data.input)
    ? event.data.input as Record<string, unknown>
    : {}
  const createdAt = new Date(Number(event.id.split('-')[0])).toISOString()
  if (tool && name) {
    const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
    const title = isComputerAction(name) ? computerActionLabel(name, input) : toolStepLabel(name, 'call', input) ?? genericToolStepLabel(name, 'call')
    return { id: event.id, title, status: 'running', kind: 'code', createdAt, index,
      metadata: { toolName: name, toolInputJson: JSON.stringify(input), ...(name === 'read_file' && typeof input.path === 'string' ? { filePath: input.path } : {}), ...(callId ? { callId } : {}) } }
  }
  const title = event.type === 'agent.skill_used'
    ? `Used skill ${String(typeof event.data.title === 'string' && event.data.title ? event.data.title : name || 'skill').slice(0, 100)}`
    : lifecycleFeedLabels[event.type]
  if (!title) return null
  const description = typeof event.data.summary === 'string' ? event.data.summary.slice(0, 2000)
    : typeof event.data.error === 'string' ? event.data.error.slice(0, 2000) : undefined
  return { id: event.id, title, status: event.type.endsWith('failed') ? 'error' : 'complete', kind: 'planning', createdAt, index,
    metadata: { eventType: event.type, ...(typeof event.data.execution === 'number' ? { execution: event.data.execution } : {}) },
    ...(description ? { description } : {}) }
}

/** Finds the open row a tool result belongs to: by call id when the server sent one, else the latest running tool row. */
function runningToolIndex(events: ComputerTimelineEvent[], callId: string | undefined, name: string): number {
  for (let current = events.length - 1; current >= 0; current -= 1) {
    const candidate = events[current]
    if (isRunningToolItem(candidate) && candidate.metadata?.toolName === name && (!callId || candidate.metadata?.callId === callId)) return current
  }
  return -1
}

/** Closes the row of any tool other than run_command/file tools: past-tense title, done or failed. */
export function updateToolStepEvent(events: ComputerTimelineEvent[], event: SessionEvent): ComputerTimelineEvent[] {
  if (event.type !== 'agent.tool_result' || event.data.name === 'run_command' || isFileTool(event.data.name)) return events
  const name = typeof event.data.name === 'string' ? event.data.name : ''
  if (!name || isHiddenToolStep(name)) return events
  const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
  const index = runningToolIndex(events, callId, name)
  if (index < 0) return events
  const current = events[index]
  let input: Record<string, unknown> = {}
  if (typeof current.metadata?.toolInputJson === 'string') { try { input = JSON.parse(current.metadata.toolInputJson) as Record<string, unknown> } catch { input = {} } }
  const failed = event.data.isError === true
  // A tool with its own failure copy (see feed-labels) speaks to the person in
  // its title; its result text is addressed to the model and stays hidden.
  const phase = failed ? 'failed' : 'result'
  const description = typeof event.data.error === 'string' ? event.data.error.slice(0, 2000)
    : failed && toolFailureLabel(name) === undefined && typeof event.data.text === 'string' ? event.data.text.slice(0, 400) : undefined
  const diagnostic = failed && typeof (event.data.error ?? event.data.text) === 'string' ? redactSecrets(String(event.data.error ?? event.data.text)).slice(0, 2000) : undefined
  const next = events.slice()
  next[index] = { ...current, status: failed ? 'error' : 'complete',
    title: isComputerAction(name) ? current.title : toolStepLabel(name, phase, input) ?? genericToolStepLabel(name, phase),
    metadata: { ...current.metadata, ...(diagnostic ? { diagnostic } : {}) },
    ...(description ? { description } : {}) }
  return next
}

function updateCommandEvent(events: ComputerTimelineEvent[], event: SessionEvent): ComputerTimelineEvent[] {
  if (event.type !== 'agent.tool_result' || (event.data.name !== 'run_command' && !isFileTool(event.data.name))) return events
  const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
  const index = runningToolIndex(events, callId, event.data.name as string)
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

export function interruptRunningToolEvents(events: ComputerTimelineEvent[]): ComputerTimelineEvent[] {
  let changed = false
  const next = events.map((event) => {
    if (!isRunningToolItem(event)) return event
    changed = true
    // No result was received. Ending a run cannot prove a tool succeeded.
    return { ...event, status: 'skipped' as const, description: 'Interrupted before a result was received.' }
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
  const [liveLabel, setLiveLabel] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting')
  const scopeRef = useRef('')
  const [revision, setRevision] = useState(0)
  const refreshRef = useRef<() => Promise<void>>(async () => { throw new Error('Session data is not loaded.') })
  const refresh = useCallback(() => refreshRef.current(), [])
  // A command's accepted response is server state too (a Stop comes back with
  // cancelRequested set): it enters through the same door as a stream frame.
  const applyStateRef = useRef<(next: BackendSession) => void>(() => {})
  const applyState = useCallback((next: BackendSession) => applyStateRef.current(next), [])
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
    setLiveLabel(null)
    setError(null); setStreamError(null); setLoading(true)
    setFileCount(null); setFileError(null)
    }
    setConnection(navigator.onLine ? 'connecting' : 'offline')
    if (!user) { setError('Sign in to open this session.'); setLoading(false); return }
    const latency = sessionLatency(user.uid, id)
    let loadVersion = 0
    let stateVersion = 0
    let latestStatus: BackendSession['status'] | undefined
    let textVersion = 0
    let turnEnded = false
    let latestExecution = 0
    let stateFingerprint: string | undefined
    const fingerprint = (next: BackendSession) => JSON.stringify([next.status, next.messageCount, next.cancelRequested, next.pendingInput, next.fallback, next.delivery])
    let streamText = ''
    let refreshFailed = false
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let textFrame: number | undefined
    const flushText = () => { textFrame = undefined; setText(streamText) }
    const scheduleText = () => { if (textFrame === undefined) textFrame = requestAnimationFrame(flushText) }
    const reload = async () => {
      const version = ++loadVersion
      const stateAtStart = stateVersion
      const textAtStart = textVersion
      const client = currentBackend()
      const { session: next, project: parent, messages: history, queued: waiting } = await loadSessionSnapshot(client, id, signal, (owned, parent) => {
        if (signal.aborted || version !== loadVersion) return
        setSession((current) => stateAtStart === stateVersion ? owned : current ?? { ...owned, status: latestStatus ?? owned.status })
        setProject(parent); setLoading(false)
      })
      if (signal.aborted || version !== loadVersion) return
      if (stateAtStart === stateVersion) { setSession(next); turnEnded = isTerminalStatus(next.status) }
      setProject(parent); setMessages(history); setQueued(waiting)
      setLoading(false); setError(null)
      const loadedFingerprint = fingerprint(next)
      if (stateFingerprint !== undefined && stateFingerprint !== loadedFingerprint) scheduleRefresh()
      else stateFingerprint = loadedFingerprint
      void client.files(parent.id, signal).then((tree) => {
        if (!signal.aborted && version === loadVersion) { setFileCount(tree.truncated ? null : tree.files.length); setFileError(tree.truncated ? 'File listing is limited by the server. Open Code to inspect the saved files.' : null) }
      }).catch((reason) => { if (!signal.aborted && version === loadVersion) { setFileCount(null); setFileError(reason instanceof Error ? reason.message : 'Could not load saved files.') } })
      refreshFailed = false; setStreamError(null)
      if (textAtStart === textVersion && turnEnded) {
        streamText = ''; if (textFrame !== undefined) { cancelAnimationFrame(textFrame); textFrame = undefined }; setText('')
      }
    }
    refreshRef.current = reload
    const applyServerState = (next: BackendSession) => {
      if (next.id !== id) throw new Error('Mismatched session state.')
      stateVersion++
      latestStatus = next.status
      if (next.execution !== undefined) latestExecution = Math.max(latestExecution, next.execution)
      const nextFingerprint = fingerprint(next)
      if (stateFingerprint !== undefined && stateFingerprint !== nextFingerprint) scheduleRefresh()
      stateFingerprint = nextFingerprint
      const ended = isTerminalStatus(next.status)
      if (ended && !turnEnded) textVersion++
      turnEnded = ended
      // Running rows end only when the server says the run has ended, never on
      // the Stop request alone: the command may still be running until then.
      if (ended) { setLiveLabel(null); setEvents((current) => interruptRunningToolEvents(current)) }
      setSession(next)
    }
    applyStateRef.current = applyServerState
    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        void reload().catch((reason) => {
          if (!signal.aborted) { refreshFailed = true; setStreamError(reason instanceof Error ? reason.message : 'Session refresh failed.') }
        })
      }, 150)
    }
    void (async () => {
      await followSessionEvents(currentBackend(), id, {
          onReconcile: async () => {
            try { await reload() }
            catch (reason) {
              if (!signal.aborted) { const message = reason instanceof Error ? reason.message : 'Could not load session.'; refreshFailed = true; setStreamError(message); if (!sameScope) setError(message); setLoading(false) }
            }
          },
          onReconnecting: () => { if (!signal.aborted) setConnection(navigator.onLine ? 'reconnecting' : 'offline') },
          onReset: () => { textVersion++; streamText = ''; setText(''); setLiveLabel(null); setEvents([]); setTerminal([]); setDesktop({ status: 'none' }); setPreview(null); scheduleRefresh() },
          onState: (state) => {
            if (signal.aborted) return
            applyServerState(sessionSchema.parse(state))
            // History catches up on durable turn/message events or reconnect.
            // Heartbeat snapshots must not discard text before history arrives.
          },
          signal, refreshToken: () => user.getIdToken(true), onError: (message) => { if (!signal.aborted) setStreamError(message) }, onConnected: () => { if (!signal.aborted) { latency.mark('connected'); setConnection('connected'); if (!refreshFailed) setStreamError(null) } },
          onEvent: (event) => {
            if (signal.aborted) return
            const execution = eventExecution(event)
            if (execution !== undefined) {
              if (execution < latestExecution) return
              latestExecution = execution
            }
            const status = sessionEventStatus[event.type]
            if (status) {
              latestStatus = status; stateVersion++
              setSession((current) => current ? { ...current, status } : current)
            }
            latency.event(event.type, event.id)
            if (['agent.step', 'agent.thinking', 'agent.text', 'agent.tool_call'].includes(event.type)) latency.mark('modelReceived')
            setLiveLabel((current) => executionLabel(current, event.type))
            if (event.type === 'preview.ready') setPreview(previewUrl(event.data.url, window.location.origin))
            if (event.type === 'sandbox.started') setPreview(null)
            setDesktop((current) => reduceDesktop(current, event))
            if (event.type === 'session.running') { turnEnded = false; textVersion++; streamText = ''; if (textFrame !== undefined) { cancelAnimationFrame(textFrame); textFrame = undefined }; setText('') }
            if (event.type === 'agent.tool_call' && streamText.length > 0) { streamText = closeSpokenParagraph(streamText); scheduleText() }
            if (event.type === 'agent.text') {
              textVersion++
              if (typeof event.data.delta !== 'string') throw new Error('The server returned an invalid text event.')
              streamText += event.data.delta
              if (streamText.length > 200_000) throw new Error('The live response exceeds the display limit. Reopen the session to load its saved messages.')
              scheduleText()
            }
            setTerminal((current) => reduceTerminal(current, event))
            if (event.type === 'agent.tool_result') {
              setEvents((current) => updateToolStepEvent(updateCommandEvent(current, event), event))
            }
            const index = Number(event.id.split('-')[0])
            setEvents((current) => reduceThinking(current, event, index))
            const item = activity(event, index)
            if (item) setEvents((current) => [...current, item].slice(-300))
            if (event.type === 'session.cancel_requested') setSession((current) => current ? { ...current, cancelRequested: true } : current)
            if (event.type === 'session.plan_updated') setSession((current) => applyPlanEvent(current, event))
            if (event.type === 'delivery.updated') setSession((current) => applyDeliveryEvent(current, event))
            if (status !== undefined && isTerminalStatus(status)) {
              turnEnded = true; textVersion++
              setEvents((current) => interruptRunningToolEvents(current))
            }
            if (['session.running', 'session.queued', 'session.idle', 'session.stopped', 'session.failed', 'session.awaiting_input', 'session.message_queued', 'session.message_dequeued', 'project.saved', 'voice.history_changed', 'delivery.updated'].includes(event.type)) scheduleRefresh()
            if (!refreshFailed) setStreamError(null)
          },
      })
    })().catch((reason: unknown) => { if (!signal.aborted) { setStreamError(reason instanceof Error ? reason.message : 'Live connection failed.'); setLoading(false) } })
    const offline = () => { setConnection('offline'); setStreamError('You are offline. Showing the last confirmed task state.') }
    const online = () => { setConnection('reconnecting'); reconnect() }
    window.addEventListener('offline', offline); window.addEventListener('online', online)
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); controller.abort(); if (refreshTimer !== undefined) clearTimeout(refreshTimer); if (textFrame !== undefined) cancelAnimationFrame(textFrame); refreshRef.current = async () => { throw new Error('The session connection is closed.') }; applyStateRef.current = () => {} }
  }, [id, user, authLoading, revision])
  // Effects clear the old scope after commit; do not expose it for that render.
  const currentScope = !authLoading && scopeRef.current === `${user?.uid ?? ''}:${id}`
  return { session: currentScope ? session : null, project: currentScope ? project : null, setProject,
    messages: currentScope ? messages : [], queued: currentScope ? queued : [], events: currentScope ? events : [],
    terminal: currentScope ? terminal : [], desktop: currentScope ? desktop : { status: 'none' as const }, text: currentScope ? text : '',
    liveLabel: currentScope ? liveLabel : null, stopping: currentScope && isStopping(session), applyState,
    preview: currentScope ? visiblePreview({ preview, session }) : null,
    fileCount: currentScope ? fileCount : null, fileError: currentScope ? fileError : null,
    loading: !currentScope || loading, error: currentScope ? error : null, streamError: currentScope ? streamError : null,
    connection, refresh, reconnect }
}
