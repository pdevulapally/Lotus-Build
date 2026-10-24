import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskClient, TaskApiError } from '../lib/tasks/client'
import { approvalDecisions, canReplyToTask, messageText, shouldPollTask, taskSessionSchema, isTaskWorkspacePath } from '../lib/tasks/contract'
import { commandIdentity } from '../lib/tasks/commands'
const fixture = { id: 'abc', kind: 'code', status: 'queued', schema_version: 2, revision: 1, active_run_id: 'r1', cancel_requested: false, recovery_required: false, error: null, messages: [], plan: null, pending_approval: null }
const response = () => new Response(JSON.stringify(fixture), { headers: { 'Content-Type': 'application/json' } })
test('new workspace is isolated to its exact route root', () => { assert.ok(isTaskWorkspacePath('/tasks')); assert.ok(isTaskWorkspacePath('/tasks/a')); assert.equal(isTaskWorkspacePath('/tasks-other'), false) })
test('rejects unsafe API origins', () => { for (const origin of ['http://example.com', 'https://a.test/api', 'https://user:pass@a.test', 'https://a.test?token=x']) assert.throws(() => new TaskClient({ origin, token: async () => 'x' })) })
test('create uses new contract, bearer identity and stable key', async () => {
 let call: RequestInit | undefined
 const client = new TaskClient({ origin: 'https://agent.test', token: async () => 'token', fetch: async (url, init) => { assert.equal(url, 'https://agent.test/sessions'); call = init; return response() } })
 await client.create('Build a test', 'code', 'stable-key')
 assert.equal(call?.body, JSON.stringify({ task: 'Build a test', kind: 'code' })); assert.equal(call?.credentials, 'omit'); assert.equal(call?.redirect, 'error')
 assert.equal((call?.headers as Record<string, string>)['Idempotency-Key'], 'stable-key')
})
test('approval sends exact batch and decisions, cancellation uses durable DELETE', async () => {
 const calls: Array<[unknown, RequestInit | undefined]> = []
 const client = new TaskClient({ origin: 'https://agent.test', token: async () => 't', fetch: async (url, init) => { calls.push([url, init]); return response() } })
 await client.approve('abc', 'approval-1', [{ call_id: 'tool-1', approved: false }], 'k')
 await client.cancel('abc')
 assert.deepEqual(JSON.parse(calls[0][1]!.body as string), { approval_id: 'approval-1', decisions: [{ call_id: 'tool-1', approved: false }] })
 assert.equal(calls[1][1]!.method, 'DELETE'); assert.equal(calls[1][1]!.body, undefined)
})
test('invalid success and FastAPI errors never become success', async () => {
 const client = (res: Response) => new TaskClient({ origin: 'https://agent.test', token: async () => 't', fetch: async () => res })
 await assert.rejects(client(new Response('{}')).read('a'), (e: unknown) => e instanceof TaskApiError && e.status === 502)
 await assert.rejects(client(new Response(JSON.stringify({ detail: 'approval changed' }), { status: 409 })).read('a'), /approval changed/)
})
test('requires explicit decisions for each risky call and does not approve safe calls', () => {
 const task = taskSessionSchema.parse({ ...fixture, pending_approval: { id: 'a', calls: [{ id: 'x', name: 'bash', input: { command: 'example' }, risky: true }, { id: 'y', name: 'read_file', input: {}, risky: false }] } })
 assert.throws(() => approvalDecisions(task, {})); assert.deepEqual(approvalDecisions(task, { x: false }), [{ call_id: 'x', approved: false }])
})
test('uncertain mutations keep identity and reject changed input', () => {
 const first = commandIdentity(null, 'same', () => 'key'); assert.equal(commandIdentity(first, 'same').key, 'key'); assert.throws(() => commandIdentity(first, 'different'))
})
test('polls active states, blocks interrupted resend, renders text not tool payloads', () => {
 const task = taskSessionSchema.parse(fixture); assert.equal(shouldPollTask(task), true)
 assert.equal(canReplyToTask({ ...task, status: 'idle', recovery_required: true }), false)
 assert.equal(shouldPollTask({ ...task, status: 'awaiting_approval' }), false)
 assert.equal(messageText({ content: [{ type: 'text', text: 'Hello' }, { type: 'tool_use', input: 'hidden' }, { type: 'image', source: 'hidden' }] }), 'Hello')
})

test('uncertain command survives reload and stays isolated by account', async () => {
 const { runTaskCommand } = await import('../lib/tasks/commands')
 const values = new Map<string, string>()
 const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
 let firstKey = ''
 await assert.rejects(runTaskCommand(storage, 'alice', null, 'same', async key => { firstKey = key; throw new Error('network') }))
 await assert.rejects(runTaskCommand(storage, 'alice', null, 'changed', async () => 1))
 await runTaskCommand(storage, 'bob', null, 'other', async key => { assert.notEqual(key, firstKey) })
 await runTaskCommand(storage, 'alice', null, 'same', async key => { assert.equal(key, firstKey) })
 assert.equal(values.size, 0)
})

test('authorization failures and uncertain writes are not automatically retried', async () => {
 for (const status of [401, 403, 409, 503]) {
  let requests = 0
  const client = new TaskClient({ origin: 'https://agent.test', token: async () => 'token', fetch: async () => { requests++; return Response.json({ detail: 'Request rejected' }, { status }) } })
  await assert.rejects(client.create('Do work', 'code', 'stable-key'), (error: unknown) => error instanceof TaskApiError && error.status === status)
  assert.equal(requests, 1)
 }
 let requests = 0
 const client = new TaskClient({ origin: 'https://agent.test', token: async () => 'token', fetch: async () => { requests++; throw new TypeError('Network failure') } })
 await assert.rejects(client.message('abc', 'Continue', 'stable-key'), /Network failure/)
 assert.equal(requests, 1)
})

test('an abort during token lookup prevents dispatch to the API', async () => {
 const controller = new AbortController(); let requests = 0
 const client = new TaskClient({ origin: 'https://agent.test', token: async () => { controller.abort(); return 'token' }, fetch: async () => { requests++; return response() } })
 await assert.rejects(client.read('abc', controller.signal), { name: 'AbortError' })
 assert.equal(requests, 0)
})

test('only active task states keep polling; terminal and approval states stop', () => {
 const task = taskSessionSchema.parse(fixture)
 for (const status of ['queued', 'running', 'cancel_requested'] as const) assert.equal(shouldPollTask({ ...task, status }), true, status)
 for (const status of ['awaiting_approval', 'idle', 'error', 'cancelled'] as const) assert.equal(shouldPollTask({ ...task, status }), false, status)
})

test('server timestamps are preserved without inventing values for older snapshots', () => {
 const snapshot = taskSessionSchema.parse({ ...fixture, created_at: '2026-10-24T16:00:00+00:00', updated_at: '2026-10-24T16:01:00+00:00' })
 assert.equal(snapshot.created_at, '2026-10-24T16:00:00+00:00')
 assert.equal(snapshot.updated_at, '2026-10-24T16:01:00+00:00')
 assert.equal(taskSessionSchema.parse(fixture).created_at, undefined)
})
