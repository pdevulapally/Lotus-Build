import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { attachmentProblem, sameAttachments, type AttachmentRef } from '../lib/backend/attachments'
import { sendMessage } from '../lib/backend/send-message'

const png: AttachmentRef = { id: '00000000-0000-4000-8000-000000000001', mediaType: 'image/png' }
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

test('files are screened by type, size and count before any upload', () => {
  assert.equal(attachmentProblem({ type: 'image/png', size: 10 }, 0), null)
  assert.match(attachmentProblem({ type: 'image/svg+xml', size: 10 }, 0)!, /PNG, JPEG/)
  assert.match(attachmentProblem({ type: 'image/png', size: 6 * 1024 * 1024 }, 0)!, /5 MB/)
  assert.match(attachmentProblem({ type: 'image/png', size: 10 }, 4)!, /up to 4/)
  assert.equal(sameAttachments([png], [png]), true)
  assert.equal(sameAttachments([png], []), false)
})

test('an upload is sent as the raw image with its own content type, never as JSON', async () => {
  let seen: { url: string; init: RequestInit } | undefined
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (url, init) => {
    seen = { url: String(url), init: init! }
    return Response.json({ ...png, bytes: 3 }, { status: 201 })
  } })
  const stored = await client.uploadAttachment(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
  assert.deepEqual(stored, { ...png, bytes: 3 })
  assert.equal(seen?.url, 'https://api.example.test/attachments')
  assert.equal((seen?.init.headers as Record<string, string>)['Content-Type'], 'image/png')
  assert.ok(seen?.init.body instanceof Blob)
  assert.throws(() => client.uploadAttachment(new Blob(['x'], { type: 'text/plain' })), /PNG, JPEG/)
})

test('messages without attachments still parse, and attached ones ride along to the server', async () => {
  const calls: unknown[] = []
  const client = new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (url, init) => {
    if (String(url).endsWith('/messages') && init?.method === 'POST') { calls.push(JSON.parse(String(init.body))); return Response.json({ queued: true, queuedMessage: { id: 'q1', sessionId: 's1', prompt: 'Match this', attachments: [png], createdAt: new Date(0).toISOString() } }, { status: 202 }) }
    return Response.json({ messages: [{ seq: 0, role: 'user', content: 'hi', createdAt: new Date(0).toISOString() }] })
  } })
  const { messages } = await client.messages('s1')
  assert.deepEqual(messages[0]?.attachments, [])
  const storage = memory()
  await sendMessage(client, storage, 'u', 's1', 'Match this', undefined, [png])
  assert.deepEqual((calls[0] as { attachments: unknown }).attachments, [png])
  await assert.rejects(async () => {
    storage.setItem('lotus-pending-message:u:s1', JSON.stringify({ prompt: 'Match this', key: '00000000-0000-4000-8000-000000000009', attachments: [png] }))
    await sendMessage(client, storage, 'u', 's1', 'Match this', undefined, [])
  }, /images/)
})
