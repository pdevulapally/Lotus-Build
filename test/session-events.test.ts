import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError, type BackendClient, type SessionEvent } from '../lib/backend/client'
import { followSessionEvents, HEALTHY_CONNECTION_MS, STREAM_MESSAGES } from '../lib/backend/session-events'

type Attempt = (emit: (event: SessionEvent) => Promise<void>) => Promise<void>

function harness(attempts: Attempt[]) {
  const controller = new AbortController()
  const errors: string[] = []
  const seen: string[] = []
  const events: string[] = []
  const waits: number[] = []
  let opened = 0
  let refreshed = 0
  let reconnects = 0
  let clock = 0
  const client = {
    async events(_id: string, options: { onOpen?: () => void; onEvent: (event: SessionEvent) => void | Promise<void> }) {
      const attempt = attempts.shift()
      if (!attempt) { controller.abort(); return }
      opened += 1
      options.onOpen?.()
      await attempt(async (event) => { await options.onEvent(event) })
    },
  } as unknown as BackendClient
  const run = followSessionEvents(client, 's1', {
    signal: controller.signal,
    refreshToken: async () => { refreshed += 1 },
    onEvent: (event) => { events.push(event.id) },
    onError: (message) => { errors.push(message); seen.push(message) },
    onConnected: () => { errors.length = 0 },
    onReconnecting: () => { reconnects += 1 },
  }, async (ms) => { waits.push(ms) }, () => clock)
  return { run, errors, seen, events, waits, counters: () => ({ opened, refreshed }), reconnects: () => reconnects, advance: (ms: number) => { clock += ms }, stop: () => controller.abort() }
}

const id = (n: number) => `${1700000000000 + n}-0`
const data = (n: number): SessionEvent => ({ id: id(n), type: 'agent.step', data: {} }) as unknown as SessionEvent
const closing = (reason: string): SessionEvent => ({ type: 'stream.closing', data: { reason } }) as unknown as SessionEvent

test('a planned token rotation refreshes the token and reconnects without telling the user', async () => {
  const h = harness([
    async (emit) => { await emit(data(1)); await emit(closing('token-expired')) },
    async (emit) => { await emit(data(2)); h.stop() },
  ])
  await h.run
  assert.deepEqual(h.events, [id(1), id(2)])
  assert.deepEqual(h.counters(), { opened: 2, refreshed: 1 })
  assert.deepEqual(h.errors, [])
  assert.deepEqual(h.waits, [])
  assert.equal(h.reconnects(), 0)
})

test('the first unexpected drop retries quietly and quickly; a second consecutive drop is reported', async () => {
  const h = harness([
    async () => {},
    async () => { throw new Error('socket hang up') },
    async (emit) => { await emit(data(1)); h.stop() },
  ])
  await h.run
  assert.deepEqual(h.seen, [STREAM_MESSAGES.interrupted])
  assert.deepEqual(h.errors, [], 'reconnecting clears the notice')
  assert.deepEqual(h.waits, [300, 2000])
  assert.equal(h.reconnects(), 1, 'only the repeated failure changes visible connection status')
})

test('a connection that stayed up for a while resets the failure count', async () => {
  const h = harness([
    async () => {},
    async () => { h.advance(HEALTHY_CONNECTION_MS) },
    async () => {},
    async () => { h.stop() },
  ])
  await h.run
  assert.deepEqual(h.waits, [300, 300, 2000])
  assert.deepEqual(h.seen, [STREAM_MESSAGES.interrupted])
})

test('long interruptions keep retrying transparently with a capped delay', async () => {
  const h = harness(Array.from({ length: 8 }, () => async () => {}))
  await h.run
  assert.equal(h.counters().opened, 8)
  assert.equal(h.seen.at(-1), STREAM_MESSAGES.retrying)
  assert.ok(h.waits.every((delay) => delay <= 30_000))
})

test('losing access ends the stream with the server message', async () => {
  const h = harness([async () => { throw new BackendError(403, 'session/forbidden', 'This session belongs to another account.') }])
  await h.run
  assert.deepEqual(h.errors, ['This session belongs to another account.'])
  assert.equal(h.counters().opened, 1)
})

test('a stream the server could not re-authorise asks the user to sign in again', async () => {
  const h = harness([async (emit) => { await emit(closing('authorization-failed')) }])
  await h.run
  assert.deepEqual(h.errors, [STREAM_MESSAGES.unauthorized])
})


test('authoritative state and history resets do not advance the event acknowledgement', async () => {
  const abort = new AbortController(); const cursors: (string | undefined)[] = []; const seen: string[] = []; let resets = 0; let states = 0; let reconciliations = 0;
  const client = { events: async (_id: string, options: { after?: string; onEvent: (event: SessionEvent) => Promise<void> }) => {
    cursors.push(options.after);
    if (cursors.length === 1) { await options.onEvent(data(1)); return }
    assert.equal(options.after, id(1));
    await options.onEvent({ type: 'session.state', data: { status: 'RUNNING' } });
    await options.onEvent({ type: 'stream.reset', data: { reason: 'history-unavailable' } });
    await options.onEvent(data(1)); await options.onEvent(data(2)); abort.abort();
  } } as unknown as BackendClient;
  await followSessionEvents(client, 's1', { signal: abort.signal, refreshToken: async () => {}, onError: () => {},
    onReconcile: async () => { reconciliations++ }, onState: () => { states++ }, onReset: () => { resets++ }, onEvent: (event) => { seen.push(event.id) },
  }, async () => {});
  assert.deepEqual(cursors, [undefined, id(1)]); assert.equal(states, 1); assert.equal(resets, 1); assert.equal(reconciliations, 1, 'an outstanding reconciliation is reused across immediate reconnects');
  assert.deepEqual(seen, [id(1), id(1), id(2)]); // A reset explicitly rebuilt the view.
});
