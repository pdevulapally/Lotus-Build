import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { type TestContext } from 'node:test'
import ts from 'typescript'
import type { User } from 'firebase/auth'
import type { BackendClient, BackendSession, SessionEvent } from '../lib/backend/client'
import { loadSessionSnapshot } from '../lib/backend/session-snapshot'
import { followSessionEvents } from '../lib/backend/session-events'
import { latencyTrace, sessionLatency } from '../lib/backend/latency'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
const session: BackendSession = { id: 's', projectId: 'p', model: 'configured', effort: 'standard', mode: 'build', status: 'RUNNING', messageCount: 1, createdAt: '2026-11-06T10:00:00.000Z' }
const project = { id: 'p', name: 'App', platform: 'web' as const, publicPreviewEnabled: false, status: 'draft' as const, createdAt: session.createdAt }

test('SSE delivers ordered, deduplicated events before initial hydration resolves and resumes its cursor', async () => {
  const abort = new AbortController(); const hydration = deferred<void>(); const seen: string[] = []; let opens = 0; let loads = 0
  const client = { events: async (_id: string, opts: { after?: string; onEvent: (event: SessionEvent) => Promise<void> }) => {
    opens++
    if (opens === 1) { assert.equal(opts.after, undefined); await opts.onEvent({ id: '1-0', type: 'agent.step', data: {} }); return }
    assert.equal(opts.after, '1-0')
    for (const id of ['1-0', '1-1', '2-0']) await opts.onEvent({ id, type: 'agent.step', data: {} })
    abort.abort()
  } } as unknown as BackendClient
  await followSessionEvents(client, 's', { signal: abort.signal, onReconcile: () => { loads++; return hydration.promise },
    onEvent: (event) => { seen.push(event.id) }, onError: assert.fail, refreshToken: async () => {},
  }, async () => {})
  assert.deepEqual(seen, ['1-0', '1-1', '2-0'])
  assert.equal(loads, 1)
  hydration.resolve(); await settle()
})

test('a failed hydration is reported without blocking an otherwise healthy stream', async () => {
  const abort = new AbortController(); const errors: string[] = []; const received: string[] = []
  const client = { events: async (_id: string, opts: { onEvent: (event: SessionEvent) => Promise<void> }) => {
    await settle(); await opts.onEvent({ id: '1-0', type: 'agent.step', data: {} }); abort.abort()
  } } as unknown as BackendClient
  await followSessionEvents(client, 's', { signal: abort.signal, onReconcile: async () => { throw new Error('History unavailable') },
    onEvent: (event) => { received.push(event.id) }, onError: (message) => { errors.push(message) }, refreshToken: async () => {},
  })
  assert.deepEqual(errors, ['History unavailable']); assert.deepEqual(received, ['1-0'])
})

test('project lookup starts as soon as session identity arrives, independently of slow history', async () => {
  const history = deferred<{ messages: [] }>(); const calls: string[] = []
  const client = { session: async () => { calls.push('session'); return session }, project: async () => { calls.push('project'); return project },
    messages: () => { calls.push('history'); return history.promise }, queuedMessages: async () => { calls.push('queue'); return { queuedMessages: [] } },
  } as unknown as BackendClient
  let workspaceReady = false
  const work = loadSessionSnapshot(client, 's', new AbortController().signal, () => { workspaceReady = true })
  await settle(); assert.deepEqual(calls, ['session', 'history', 'queue', 'project'])
  assert.equal(workspaceReady, true, 'owned workspace is available before history')
  history.resolve({ messages: [] }); assert.equal((await work).project.id, 'p')
  await assert.rejects(loadSessionSnapshot({ ...client, session: async () => ({ ...session, id: 'other' }) } as unknown as BackendClient, 's', new AbortController().signal), /mismatched session/)
})

// Run the actual hook effect with deterministic state/effect scheduling. No
// Firebase, DOM renderer, network, or provider is initialized in this harness.
const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../hooks/use-backend-session.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
function hookHarness(t: TestContext, client: BackendClient) {
  const previous = new Map<string, PropertyDescriptor | undefined>()
  const install = (name: string, value: unknown) => { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, value }) }
  install('window', Object.assign(new EventTarget(), { location: { origin: 'http://localhost' } }))
  install('navigator', { onLine: true })
  install('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0))
  install('cancelAnimationFrame', (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer))
  const slots: unknown[] = []; let index = 0; let mounted = false; let cleanup: (() => void) | undefined
  let effect: (() => void | (() => void)) | undefined
  const react = {
    useState(value: unknown) { const slot = index++; if (!mounted) slots[slot] = value; return [slots[slot], (next: unknown) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next }] },
    useRef(value: unknown) { const slot = index++; if (!mounted) slots[slot] = { current: value }; return slots[slot] },
    useCallback: (callback: unknown) => callback,
    useEffect(callback: () => void | (() => void)) { if (!mounted) effect = callback },
  }
  const module = { exports: {} as { useBackendSession: typeof import('../hooks/use-backend-session').useBackendSession } }
  const isolatedRequire = (id: string) => id === 'react' ? react : id === '@/lib/backend/browser' ? { currentBackend: () => client }
    : require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  const user = { uid: 'alice', getIdToken: async () => 'test-token' } as User
  const render = (id = 's', identity: User = user) => { index = 0; return module.exports.useBackendSession(id, identity, false) }
  render(); mounted = true; cleanup = effect?.() || undefined
  t.after(() => { cleanup?.(); for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name) } })
  return { render, unmount: () => cleanup?.() }
}

test('late hydration cannot erase earlier live text or overwrite authoritative stream state', async (t) => {
  const history = deferred<{ messages: [] }>(); const parent = deferred<typeof project>()
  let stream!: { signal: AbortSignal; onEvent: (event: SessionEvent) => Promise<void>; onOpen?: () => void }
  let loads = 0
  const client = { session: async () => { loads++; return { ...session, status: 'IDLE' } }, project: () => parent.promise,
    messages: () => history.promise, queuedMessages: async () => ({ queuedMessages: [] }), files: async () => ({ files: [], truncated: false }),
    events: async (_id: string, options: typeof stream) => { stream = options; options.onOpen?.(); await new Promise<void>((resolve) => options.signal.addEventListener('abort', () => resolve(), { once: true })) },
  } as unknown as BackendClient
  const h = hookHarness(t, client)
  await settle(); assert.equal(loads, 1); assert.equal(h.render().connection, 'connected')
  await stream.onEvent({ type: 'agent.step', id: '1-0', data: { number: 1 } })
  await stream.onEvent({ type: 'agent.text', id: '2-0', data: { delta: 'Live answer' } })
  await stream.onEvent({ type: 'session.state', data: session })
  parent.resolve(project); await settle()
  assert.equal(h.render().loading, false, 'slow history cannot hold the workspace behind a loading shell')
  history.resolve({ messages: [] }); await settle(); await new Promise((resolve) => setTimeout(resolve, 5))
  const state = h.render()
  assert.equal(state.session?.status, 'RUNNING'); assert.equal(state.text, 'Live answer'); assert.equal(state.loading, false)
  assert.equal(state.desktop.status, 'none', 'processing never invents a sandbox or desktop')
  assert.equal(loads, 1, 'the initial state frame does not trigger another hydration')
  assert.equal(h.render('other').session, null)
  assert.deepEqual(h.render('s', { uid: 'bob' } as User).messages, [])
  for (let i = 0; i < 350; i++) await stream.onEvent({ type: 'agent.tool_call', id: `${10 + i}-0`, data: { name: 'read_file', input: { path: 'app.ts' }, callId: `c${i}` } })
  assert.equal(h.render().events.length, 300, 'long sessions keep a bounded activity projection')
  await stream.onEvent({ type: 'session.failed', id: '400-0', data: { error: 'Cancelled by user' } })
  assert.equal(h.render().events.filter((event) => event.status === 'complete').length, 0, 'unanswered tools cannot become successful on cancellation')
  h.unmount(); assert.equal(stream.signal.aborted, true)
  await stream.onEvent({ type: 'agent.text', id: '3-0', data: { delta: ' stale' } })
  assert.equal(h.render().text, 'Live answer', 'callbacks after cleanup cannot update the view')
})

test('completion before history finishes keeps the live response until saved history catches up', async (t) => {
  const oldHistory = deferred<{ messages: [] }>(); let historyLoads = 0
  let stream!: { signal: AbortSignal; onEvent: (event: SessionEvent) => Promise<void> }
  let current = { ...session }
  const saved = { seq: 1, role: 'assistant' as const, content: 'Done', createdAt: session.createdAt, attachments: [] }
  const client = { session: async () => ({ ...current }), project: async () => project,
    messages: () => ++historyLoads === 1 ? oldHistory.promise : Promise.resolve({ messages: [saved] }),
    queuedMessages: async () => ({ queuedMessages: [] }), files: async () => ({ files: [], truncated: false }),
    events: async (_id: string, options: typeof stream) => { stream = options; await new Promise<void>((resolve) => options.signal.addEventListener('abort', () => resolve(), { once: true })) },
  } as unknown as BackendClient
  const h = hookHarness(t, client); await settle()
  await stream.onEvent({ type: 'agent.text', id: '1-0', data: { delta: 'Done' } })
  current = { ...session, status: 'IDLE', messageCount: 2 }
  await stream.onEvent({ type: 'session.idle', id: '2-0', data: {} })
  oldHistory.resolve({ messages: [] }); await settle(); await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(h.render().text, 'Done', 'an old empty snapshot must not erase the final response')
  await new Promise((resolve) => setTimeout(resolve, 180))
  assert.deepEqual(h.render().messages, [saved]); assert.equal(h.render().text, '', 'saved and live copies are not displayed twice')
  assert.equal(h.render().session?.status, 'IDLE')
})

test('Stopping comes from the server and Stopped only from the server; stale events from an earlier run cannot touch the live view', async (t) => {
  let stream!: { signal: AbortSignal; onEvent: (event: SessionEvent) => Promise<void> }
  let current: BackendSession = { ...session, execution: 2 }
  const client = { session: async () => ({ ...current }), project: async () => project,
    messages: async () => ({ messages: [] }), queuedMessages: async () => ({ queuedMessages: [] }), files: async () => ({ files: [], truncated: false }),
    events: async (_id: string, options: typeof stream) => { stream = options; await new Promise<void>((resolve) => options.signal.addEventListener('abort', () => resolve(), { once: true })) },
  } as unknown as BackendClient
  const h = hookHarness(t, client); await settle()
  await stream.onEvent({ type: 'session.running', id: '1-0', data: { execution: 2 } })
  await stream.onEvent({ type: 'agent.tool_call', id: '2-0', data: { execution: 2, name: 'run_command', input: { command: 'npm test' }, callId: 'c1' } })
  await stream.onEvent({ type: 'agent.text', id: '3-0', data: { execution: 2, delta: 'Half an answer' } })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(h.render().stopping, false)

  // The accepted Stop response is server state: it says the run is winding down, not that it has ended.
  h.render().applyState({ ...current, cancelRequested: true, cancelRequestedAt: '2026-11-06T10:00:05.000Z' })
  let state = h.render()
  assert.equal(state.stopping, true, 'an accepted Stop shows as stopping')
  assert.equal(state.session?.status, 'RUNNING', 'the run is still running until the server ends it')
  assert.equal(state.text, 'Half an answer', 'streamed text is not thrown away on Stop')
  assert.equal(state.events.find((event) => event.metadata?.callId === 'c1')?.status, 'running', 'a command the server has not ended is not marked interrupted')

  await stream.onEvent({ type: 'session.cancel_requested', id: '4-0', data: { execution: 2 } })
  assert.equal(h.render().stopping, true)

  // A late event from an earlier run is ignored for live state.
  await stream.onEvent({ type: 'agent.text', id: '5-0', data: { execution: 1, delta: ' from the past' } })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(h.render().text, 'Half an answer')

  current = { ...current, status: 'STOPPED', cancelRequested: undefined, cancelRequestedAt: undefined }
  await stream.onEvent({ type: 'session.stopped', id: '6-0', data: { execution: 2, stopAfterMs: 1200 } })
  state = h.render()
  assert.equal(state.stopping, false, 'the server ended the run')
  assert.equal(state.session?.status, 'STOPPED')
  assert.equal(state.events.find((event) => event.metadata?.callId === 'c1')?.status, 'skipped', 'running rows end only when the server says so')
  assert.equal(state.events.find((event) => event.title === 'Stopped')?.status, 'complete', 'a stop is not an error row')
  assert.equal(state.liveLabel, null)

  // A state frame for a newer run supersedes the stopped one; the next run starts clean.
  await stream.onEvent({ type: 'session.state', data: { ...current, status: 'RUNNING', execution: 3 } })
  await stream.onEvent({ type: 'session.running', id: '7-0', data: { execution: 3 } })
  await stream.onEvent({ type: 'agent.text', id: '8-0', data: { execution: 2, delta: 'stale' } })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(h.render().text, '', 'a stale delta from the stopped run cannot leak into the new run')
  assert.equal(h.render().stopping, false)
})

test('latency measures use monotonic local intervals and separate journal durations without content or identities', () => {
  let time = 0; const rows: { name: string; duration: number }[] = []
  const trace = latencyTrace(() => time, (name, start, end) => rows.push({ name, duration: end - start }))
  trace.mark('submit'); time = 5; trace.mark('acknowledged'); time = 20; trace.mark('accepted'); trace.mark('accepted')
  trace.event('session.accepted', '1000-0'); trace.event('session.running', '1020-0'); trace.event('agent.step', '1030-0')
  assert.deepEqual(rows, [ { name: 'submit-to-acknowledgment', duration: 5 }, { name: 'submit-to-acceptance', duration: 20 },
    { name: 'journal.acceptance-to-runner', duration: 20 }, { name: 'journal.runner-to-model-step', duration: 10 } ])
  assert.notStrictEqual(sessionLatency('alice', 's'), sessionLatency('bob', 's'))
  assert.notStrictEqual(sessionLatency('alice', 's'), sessionLatency('alice', 'other'))
})
