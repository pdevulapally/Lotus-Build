import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { afterEach, beforeEach, test } from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { withRequestSignal } from '../lib/backend/request-signal'

const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')
beforeEach(() => { Reflect.deleteProperty(AbortSignal, 'any'); assert.equal(AbortSignal.any, undefined) })
afterEach(() => { if (nativeAny) Object.defineProperty(AbortSignal, 'any', nativeAny) })
const listeners = (signal: AbortSignal) => getEventListeners(signal, 'abort').length

test('account and usage load together without AbortSignal.any', async () => {
  const plan = { key: 'free', name: 'Free' }
  const responses: Record<string, unknown> = {
    '/me': { uid: 'alice', email: 'alice@example.test', emailVerified: true, projectCount: 0, plan, limits: [], models: [], capabilities: [] },
    '/me/usage': { uid: 'alice', plan, meters: [] },
  }
  const paths: string[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'fixture', fetch: async (url, init) => {
    const path = new URL(String(url)).pathname
    paths.push(path)
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture')
    return Response.json(responses[path])
  } })
  const [account, usage] = await Promise.all([client.me(), client.usage()])
  assert.deepEqual([account.uid, usage.uid], ['alice', 'alice'])
  assert.deepEqual(paths.sort(), ['/me', '/me/usage'])
})

test('release both listeners after success, error, or either cancellation source', async () => {
  for (const outcome of ['success', 'error', 'account', 'caller']) {
    const account = new AbortController(), caller = new AbortController()
    const error = new Error(outcome)
    const result = withRequestSignal(account.signal, caller.signal, async signal => {
      assert.equal(listeners(account.signal), 1)
      assert.equal(listeners(caller.signal), 1)
      if (outcome === 'error') throw error
      if (outcome !== 'success') {
        const source = outcome === 'account' ? account : caller
        source.abort(error)
        assert.equal(signal.reason, error)
        assert.equal(listeners(account.signal) + listeners(caller.signal), 0)
      }
      return 'finished'
    })
    if (outcome === 'success') assert.equal(await result, 'finished')
    else await assert.rejects(result, (reason: unknown) => reason === error)
    assert.equal(listeners(account.signal) + listeners(caller.signal), 0)
  }
  const caller = new AbortController(), account = new AbortController()
  caller.abort()
  await assert.rejects(withRequestSignal(account.signal, caller.signal, async () => assert.fail('already aborted')), { name: 'AbortError' })
  assert.equal(listeners(account.signal), 0)
})

test('cancellation reaches the response body after headers and clears listeners', async () => {
  for (const source of ['account', 'caller']) {
    const caller = new AbortController()
    const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'fixture', fetch: async (_, init) => {
      const signal = init!.signal!
      return new Response(new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
        },
      }), { headers: { 'Content-Type': 'text/event-stream' } })
    } })
    const stream = client.events('session', { signal: caller.signal, onEvent: () => assert.fail('no events'),
      onOpen: () => source === 'account' ? client.close() : caller.abort(),
    })
    await assert.rejects(stream, { name: 'AbortError' })
    assert.equal(listeners(caller.signal), 0)
  }
})
