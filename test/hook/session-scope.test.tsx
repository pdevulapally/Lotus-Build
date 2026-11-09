import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { harness } from '../support/hook-stubs'
import { useBackendSession } from '../../hooks/use-backend-session'
import { runEndUnrecorded } from '../../lib/backend/feed-incomplete'

type Seen = ReturnType<typeof useBackendSession>
const seen: { current: Seen | null } = { current: null }
let root: Root | null = null
let props: { id: string; uid: string } = { id: 's1', uid: 'alice' }
// One stable user object per account: the hook's effect depends on `user`, as the real AuthProvider gives it a stable one.
const users = new Map<string, unknown>()
const userFor = (uid: string) => { if (!users.has(uid)) users.set(uid, { uid, getIdToken: async () => 't' }); return users.get(uid) as never }
function Probe() { seen.current = useBackendSession(props.id, userFor(props.uid), false); return null }
const user = (uid: string) => uid
const at = '2026-11-06T18:00:00.000Z'
const snapshot = (id: string, execution: number) => ({
  session: { id, projectId: 'p', status: 'RUNNING', model: 'm', effort: 'standard', mode: 'build', messageCount: 1, createdAt: at, execution },
  project: { id: 'p', ownerUid: 'u', name: 'P', platform: 'web', status: 'draft', activeSessionId: id, createdAt: at, updatedAt: at },
  messages: [], queued: [],
})
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)) }) }
async function mount(id: string, uid: string) {
  props = { id, uid }; harness.streams.length = 0
  if (root === null) { const el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el) }
  await act(async () => { root!.render(createElement(Probe)) }); await flush(); await flush()
  const live = harness.streams.filter((s) => s.sessionId === id && !s.handlers.signal.aborted); assert.equal(live.length, 1, `one live stream for ${id} (streams: ${harness.streams.length}, error: ${seen.current?.error}, status: ${seen.current?.session?.status})`); return live[0]!.handlers
}
let seq = 0
const ev = (type: string, data: Record<string, unknown>) => { seq += 1; return { id: `${1_762_430_400_000 + seq}-${seq}`, type, data } }
const send = async (h: Awaited<ReturnType<typeof mount>>, type: string, data: Record<string, unknown>) => { await act(async () => { await h.onEvent(ev(type, data)) }); await flush() }

test('incomplete terminal on the stream: the run is declared incomplete and the end is on record live — no stale inference', async () => {
  harness.snapshot = (id) => snapshot(id, 1)
  const h = await mount('s1', user('alice'))
  await send(h, 'session.running', { execution: 1 }); await send(h, 'agent.tool_call', { execution: 1, name: 'run_command', input: { command: 'npm test' }, callId: 'c1' })
  await send(h, 'session.idle', { execution: 1, steps: 1, stopReason: 'end_turn', incomplete: true })
  assert.deepEqual(seen.current!.incompleteRuns, [1]); assert.equal(seen.current!.session?.runEnd?.incomplete, true)
  assert.equal(runEndUnrecorded(seen.current!.session!.status, seen.current!.session!.execution, seen.current!.session!.runEnd), false, 'the end is on record the moment the terminal event arrives')
})

test('scope change: another session (or account) with the same run number shows none of the previous session\'s warnings', async () => {
  harness.snapshot = (id) => snapshot(id, 1)
  await mount('s2', user('alice'))
  assert.deepEqual(seen.current!.incompleteRuns, [], 'a clean session s2 after lossy s1: nothing carried by run number')
  const h = await mount('s2', user('bob'))
  assert.deepEqual(seen.current!.incompleteRuns, [])
  await send(h, 'session.idle', { execution: 1, steps: 1, stopReason: 'end_turn', incomplete: true })
  assert.deepEqual(seen.current!.incompleteRuns, [1])
  await mount('s3', user('bob'))
  assert.deepEqual(seen.current!.incompleteRuns, [], 'cleared with the scope, not only on a stream reset')
})

test('live clean terminal: a clean end on the stream is known at once, and a stream reset at a later run keeps a replayed older incomplete declaration', async () => {
  harness.snapshot = (id) => snapshot(id, 2)
  const h = await mount('s4', user('alice'))
  await send(h, 'session.running', { execution: 2 }); await send(h, 'session.idle', { execution: 2, steps: 1, stopReason: 'end_turn' })
  assert.equal(runEndUnrecorded('IDLE', 2, seen.current!.session!.runEnd), false, 'clean end recorded live, no temporary false warning')
  await act(async () => { await h.onReset?.() }); await flush()
  await send(h, 'session.idle', { execution: 1, steps: 1, stopReason: 'end_turn', incomplete: true })   // replayed older history after the reset
  assert.deepEqual(seen.current!.incompleteRuns, [1], 'the replayed run-1 declaration is not dropped by the run gate after a reset')
})

test.after(async () => { if (root) await act(async () => { root!.unmount() }) })
