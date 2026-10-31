import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { cancelSession, pendingCancelKey } from '../lib/backend/cancel-session'
import { followSessionEvents } from '../lib/backend/session-events'
import { parsePreviewMessage, previewUrl } from '../lib/preview'
import nextConfig from '../next.config.mjs'

const session = { id: 's1', projectId: 'p1', status: 'FAILED', model: 'model', effort: 'standard', mode: 'build', messageCount: 1, createdAt: '2026-10-18T12:00:00.000Z' }
const expired = () => Response.json({ error: { code: 'auth/token-expired', message: 'Token expired' } }, { status: 401 })
const eventStream = (text: string) => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } })
const frame = (id: string, type = 'agent.text', data = { delta: id }) => `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`
const close = (reason: string) => `event: stream.closing\ndata: ${JSON.stringify({ reason })}\n\n`
const noWait = async () => {}

test('only an explicit expired-token rejection refreshes and retries the identical write once', async () => {
  const refreshed: boolean[] = []; const writes: RequestInit[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async (force) => {
    refreshed.push(force === true); return force ? 'fresh-token' : 'expired-token'
  }, fetch: async (_input, init) => { writes.push(init!); return writes.length === 1 ? expired() : Response.json(session) } })
  await client.cancel('s1', 'same-operation-123')
  assert.deepEqual(refreshed, [false, true])
  assert.equal(writes.length, 2)
  assert.equal(writes[0]!.body, writes[1]!.body)
  assert.equal(new Headers(writes[0]!.headers).get('idempotency-key'), new Headers(writes[1]!.headers).get('idempotency-key'))
  assert.equal(new Headers(writes[1]!.headers).get('authorization'), 'Bearer fresh-token')
})

test('revoked, disabled, malformed, forbidden and uncertain writes are never automatically retried', async () => {
  for (const [status, code] of [[401, 'auth/token-revoked'], [401, 'auth/user-disabled'], [401, 'auth/token-invalid'], [403, 'auth/email-not-verified'], [409, 'request/idempotency-conflict'], [503, 'unavailable']] as const) {
    let calls = 0
    const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => {
      calls++; return Response.json({ error: { code, message: code } }, { status })
    } })
    await assert.rejects(client.cancel('s1', 'same-operation-123'), { code })
    assert.equal(calls, 1)
  }
  let calls = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => { calls++; return expired() } })
  await assert.rejects(client.cancel('s1', 'same-operation-123'), { code: 'auth/token-expired' })
  assert.equal(calls, 2)
})

test('aborting during token lookup prevents the request from being dispatched', async () => {
  const controller = new AbortController(); let calls = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => { controller.abort(); return 'token' }, fetch: async () => { calls++; return Response.json({}) } })
  await assert.rejects(client.me(controller.signal), { name: 'AbortError' })
  assert.equal(calls, 0)
})

test('cancellation survives an uncertain response and reload without changing its receipt identity', async () => {
  const values = new Map<string, string>(); const keys: string[] = []
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  const client = () => new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (_input, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key')!)
    if (keys.length === 1) throw new TypeError('Acknowledgement lost')
    return Response.json(session)
  } })
  await assert.rejects(cancelSession(client(), storage, 'alice', 's1'), /Acknowledgement lost/)
  assert.equal(values.get(pendingCancelKey('alice', 's1')), keys[0])
  assert.equal(values.get(pendingCancelKey('bob', 's1')), undefined)
  await cancelSession(client(), storage, 'alice', 's1')
  assert.deepEqual(keys, [keys[0], keys[0]])
  assert.equal(values.size, 0)
})

test('live reconnects refresh expired credentials and resume only after the last applied event', async () => {
  const controller = new AbortController(); const cursors: (string | null)[] = []; const seen: string[] = []
  let refreshes = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (_input, init) => {
    cursors.push(new Headers(init?.headers).get('Last-Event-ID'))
    if (cursors.length === 1) return eventStream(frame('42-0') + close('token-expired'))
    return eventStream(frame('42-0') + frame('42-1'))
  } })
  await followSessionEvents(client, 's1', { signal: controller.signal, refreshToken: async () => { refreshes++ },
    onEvent: (event) => { seen.push(event.id); if (seen.length === 2) controller.abort() }, onError: () => {} }, noWait)
  assert.deepEqual(seen, ['42-0', '42-1']); assert.deepEqual(cursors, [null, '42-0']); assert.equal(refreshes, 1)
})

test('failed event application is replayed rather than acknowledged', async () => {
  const controller = new AbortController(); const cursors: (string | null)[] = []; let attempts = 0
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (_input, init) => {
    cursors.push(new Headers(init?.headers).get('Last-Event-ID')); return eventStream(frame('45-0'))
  } })
  await followSessionEvents(client, 's1', { signal: controller.signal, refreshToken: async () => {},
    onEvent: () => { if (++attempts === 1) throw new Error('Apply failed'); controller.abort() }, onError: () => {} }, noWait)
  assert.deepEqual(cursors, [null, null]); assert.equal(attempts, 2)
})

test('repeated clean stream closures retry with bounded backoff and visible connection state', async () => {
  let calls = 0; const errors: string[] = []; const waits: number[] = []; const abort = new AbortController()
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => {
    calls++; if (calls === 8) abort.abort(); return eventStream('')
  } })
  await followSessionEvents(client, 's1', { signal: abort.signal, refreshToken: async () => {}, onEvent: () => {}, onError: (error) => errors.push(error) }, async (delay) => { waits.push(delay) })
  assert.equal(calls, 8); assert.match(errors.at(-1)!, /Still reconnecting/)
  assert.ok(waits.every((delay) => delay <= 30_000)); assert.equal(waits.at(-1), 30_000)
})

test('revoked stream access stops without retrying or refreshing credentials', async () => {
  for (const response of [() => eventStream(close('authorization-failed')), () => Response.json({ error: { code: 'auth/token-revoked', message: 'Revoked' } }, { status: 401 })]) {
    let calls = 0; let refreshes = 0
    const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async () => { calls++; return response() } })
    await followSessionEvents(client, 's1', { signal: new AbortController().signal, refreshToken: async () => { refreshes++ }, onEvent: () => {}, onError: () => {} }, noWait)
    assert.equal(calls, 1); assert.equal(refreshes, 0)
  }
})

test('generated previews cannot execute on the application origin or an insecure remote origin', () => {
  const app = 'https://lotus.example'
  assert.equal(previewUrl('https://sandbox.example/page', app), 'https://sandbox.example/page')
  assert.equal(previewUrl('http://localhost:4000', 'http://localhost:3000'), 'http://localhost:4000/')
  for (const value of [null, '/page', 'https://lotus.example/page', 'https://u:p@sandbox.example', 'http://sandbox.example', 'http://localhost:4000', 'javascript:alert(1)', 'data:text/html,hello']) {
    assert.throws(() => previewUrl(value, app))
  }
})

test('preview messages validate bounded geometry, payloads, navigation and section kinds', () => {
  const selection = { type: 'preview-select', id: 'element', rect: { x: 0, y: -10, width: 20, height: 30 }, viewport: { w: 390, h: 800 }, snapshot: { content: 'Hello', styles: { color: 'red' } } }
  assert.deepEqual(parsePreviewMessage(selection), selection)
  assert.ok(parsePreviewMessage({ type: 'preview-navigate', path: '/page?q=hello%20world#section' }))
  for (const value of [
    { ...selection, viewport: { w: 0, h: 100 } }, { ...selection, rect: { ...selection.rect, x: Infinity } },
    { ...selection, snapshot: { styles: { color: { unsafe: true } } } }, { ...selection, snapshot: { content: 'x'.repeat(20_001) } },
    { type: 'preview-structure', sections: [{ id: 's1', label: 'Section', kind: 'invented' }] },
    ...['//evil.test', '/\\evil.test', 'https://evil.test', '/page\n'].map((path) => ({ type: 'preview-navigate', path })),
  ]) assert.equal(parsePreviewMessage(value), null)
})

test('all routes deny embedding and objects, with transport enforcement confined to production', async () => {
  const previous = process.env.NODE_ENV
  try {
    for (const environment of ['development', 'production']) {
      Object.assign(process.env, { NODE_ENV: environment })
      assert.ok(nextConfig.headers)
      const rules = await nextConfig.headers()
      const headers = new Headers(rules[0]!.headers.map(({ key, value }): [string, string] => [key, value]))
      assert.equal(rules[0]!.source, '/:path*')
      assert.equal(headers.get('content-security-policy'), "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
      assert.equal(headers.get('x-frame-options'), 'DENY')
      assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups')
      assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(self), geolocation=()')
      assert.equal(headers.has('strict-transport-security'), environment === 'production')
    }
  } finally { if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV'); else Object.assign(process.env, { NODE_ENV: previous }) }
})
