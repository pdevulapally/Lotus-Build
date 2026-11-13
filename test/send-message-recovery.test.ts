import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient, BackendError } from '../lib/backend/client'
import { pendingMessageKey, readPendingMessage, sendMessage } from '../lib/backend/send-message'

const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const accepted = () => Response.json({ steered: true, sessionId: 's1' })
const rejected = (status: number, code: string) => Response.json({ error: { code, message: 'Request was rejected.' } }, { status })
const client = (fetch: typeof globalThis.fetch) => new BackendClient({ origin: 'https://api.example.test', token: async () => 'test-token', fetch })

test('definitive stale or replaced input rejection clears the pending slot and allows a fresh answer', async () => {
  for (const code of ['session/input-stale', 'session/input-required']) {
    const saved = storage(); const keys: string[] = []; const bodies: unknown[] = []
    const backend = client(async (_url, init) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key')!)
      bodies.push(JSON.parse(String(init?.body)))
      return keys.length === 1 ? rejected(409, code) : accepted()
    })
    await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Old answer', undefined, [], { id: 'old-question', answer: 'Old answer' }), (reason) => reason instanceof BackendError && reason.code === code)
    assert.equal(readPendingMessage(saved, 'alice', 's1'), null)
    await sendMessage(backend, saved, 'alice', 's1', 'New answer', undefined, [], { id: 'current-question', answer: 'New answer' })
    assert.notEqual(keys[0], keys[1])
    assert.equal(keys.length, 2)
    assert.deepEqual(bodies[1], { prompt: 'New answer', inputResponse: { id: 'current-question', answer: 'New answer' } })
  }
})

test('uncertain failures retain the exact command for retry, including unrelated 409 conflicts', async () => {
  for (const failure of [() => { throw new TypeError('Lost acknowledgement') }, () => rejected(500, 'session/input-stale'),
    () => rejected(503, 'session/input-persistence-unconfirmed'), () => rejected(409, 'mutation/in-progress'),
    () => Response.json({}, { status: 409 }), () => new Response('not json', { status: 202 })]) {
    const saved = storage(); const keys: string[] = []
    const backend = client(async (_url, init) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key')!)
      return keys.length === 1 ? failure() : accepted()
    })
    const input = { id: 'q1', answer: 'Teams' }
    await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Teams', undefined, [], input))
    const pending = readPendingMessage(saved, 'alice', 's1')
    assert.equal(pending?.key, keys[0]); assert.deepEqual(pending?.inputResponse, input)
    await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Different'), /Retry the pending message/)
    assert.equal(keys.length, 1, 'a replacement is never sent while acceptance is uncertain')
    await sendMessage(backend, saved, 'alice', 's1', 'Teams', undefined, [], input)
    assert.equal(keys[0], keys[1]); assert.equal(readPendingMessage(saved, 'alice', 's1'), null)
  }
})

test('an older rejection cannot remove a newer pending command written by another tab', async () => {
  const saved = storage()
  const newer = { prompt: 'New request', key: crypto.randomUUID(), attachments: [] }
  const backend = client(async () => {
    saved.setItem(pendingMessageKey('alice', 's1'), JSON.stringify(newer))
    return rejected(409, 'session/input-stale')
  })
  await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Old answer', undefined, [], { id: 'q1', answer: 'Old answer' }))
  assert.deepEqual(readPendingMessage(saved, 'alice', 's1'), newer)
})

test('a retained uncertain answer becomes replaceable only after its original retry is definitively rejected', async () => {
  const saved = storage(); const keys: string[] = []
  const backend = client(async (_url, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key')!)
    if (keys.length === 1) throw new TypeError('Lost acknowledgement')
    return keys.length === 2 ? rejected(409, 'session/input-stale') : accepted()
  })
  const input = { id: 'old-question', answer: 'Teams' }
  await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Teams', undefined, [], input))
  await assert.rejects(sendMessage(backend, saved, 'alice', 's1', 'Teams', undefined, [], input))
  assert.equal(keys[0], keys[1]); assert.equal(readPendingMessage(saved, 'alice', 's1'), null)
  await sendMessage(backend, saved, 'alice', 's1', 'Please continue with the current request.')
  assert.notEqual(keys[1], keys[2]); assert.equal(keys.length, 3)
})
