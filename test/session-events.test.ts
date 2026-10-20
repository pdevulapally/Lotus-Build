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
  }, async (ms) => { waits.push(ms) }, () => clock)
  return { run, errors, seen, events, waits, counters: () => ({ opened, refreshed }), advance: (ms: number) => { clock += ms }, stop: () => controller.abort() }
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

test('repeated quick drops stop with a retry prompt instead of looping', async () => {
  const h = harness(Array.from({ length: 8 }, () => async () => {}))
  await h.run
  assert.equal(h.counters().opened, 6)
  assert.equal(h.seen.at(-1), STREAM_MESSAGES.stopped)
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
