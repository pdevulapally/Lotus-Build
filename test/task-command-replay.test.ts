import assert from 'node:assert/strict'
import test from 'node:test'
import { TaskApiError, TaskClient } from '../lib/tasks/client'
import { pendingTaskCommandKey, readPendingCommand, replayPendingCommand, runTaskCommand } from '../lib/tasks/commands'

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const saved = { id: 'task-1', kind: 'code', status: 'idle', schema_version: 2, revision: 5, active_run_id: null, cancel_requested: false, recovery_required: false, error: null, messages: [], plan: null, pending_approval: null }

test('lost approval acknowledgement survives advanced canonical state and replays exact decision identity', async () => {
  const storage = memoryStorage()
  const fingerprint = JSON.stringify(['approve', 'task-1', 'approval-original', [{ call_id: 'tool-original', approved: false }]])
  const writes: Array<{ url: string; key: string | null; body: unknown }> = []
  const api = new TaskClient({ origin: 'https://agent.test', token: async () => 'token', fetch: async (input, init) => {
    if (init?.method === 'GET') return Response.json(saved)
    writes.push({ url: String(input), key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(init?.body as string) })
    if (writes.length === 1) throw new TypeError('Acknowledgement lost')
    return Response.json(saved)
  } })
  await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', fingerprint, key => api.approve('task-1', 'approval-original', [{ call_id: 'tool-original', approved: false }], key)), /Acknowledgement lost/)
  const storageKey = pendingTaskCommandKey('alice', 'task-1')
  const pending = readPendingCommand(storage, storageKey)!
  assert.equal(pending.fingerprint, fingerprint)
  assert.equal((await api.read('task-1')).status, 'idle')
  assert.deepEqual(readPendingCommand(storage, storageKey), pending, 'canonical progress does not prove receipt outcome')
  await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', JSON.stringify(['message', 'task-1', 'Next']), async () => saved), /Resolve the pending/)
  await runTaskCommand(storage, 'alice', 'task-1', pending.fingerprint, () => replayPendingCommand(api, 'task-1', pending))
  assert.deepEqual(writes[1], writes[0], 'replay must reuse original URL, approval batch, decisions and key')
  assert.equal(readPendingCommand(storage, storageKey), null)
  await runTaskCommand(storage, 'alice', 'task-1', JSON.stringify(['message', 'task-1', 'Next']), key => api.message('task-1', 'Next', key))
  assert.equal(writes[2].url, 'https://agent.test/sessions/task-1/messages')
  assert.notEqual(writes[2].key, writes[0].key)
  assert.deepEqual(writes[2].body, { content: 'Next' })
})

test('definitive validation rejection clears receipt and permits corrected input', async () => {
  const storage = memoryStorage(); let rejectedKey = ''
  await assert.rejects(runTaskCommand(storage, 'alice', null, 'invalid', async key => { rejectedKey = key; throw new TaskApiError(422, 'Invalid request') }), /Invalid request/)
  assert.equal(readPendingCommand(storage, pendingTaskCommandKey('alice', null)), null)
  await runTaskCommand(storage, 'alice', null, 'corrected', async key => { assert.notEqual(key, rejectedKey) })
  assert.equal(storage.values.size, 0)
})

test('network, server and receipt conflict failures retain pending identity and reject changed payload', async () => {
  for (const error of [new TypeError('Network failure'), new TaskApiError(503, 'Unavailable'), new TaskApiError(409, 'Receipt fingerprint conflict')]) {
    const storage = memoryStorage(); let originalKey = ''
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'original', async key => { originalKey = key; throw error }))
    assert.equal(readPendingCommand(storage, pendingTaskCommandKey('alice', 'task-1'))?.key, originalKey)
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'changed', async () => saved), /Resolve the pending/)
    await runTaskCommand(storage, 'alice', 'task-1', 'original', async key => { assert.equal(key, originalKey); return saved })
    assert.equal(storage.values.size, 0)
  }
})

test('replay rejects malformed commands or the wrong task before API dispatch', () => {
  let calls = 0
  const api = new TaskClient({ origin: 'https://agent.test', token: async () => 'token', fetch: async () => { calls++; return Response.json(saved) } })
  for (const command of [['approve', 'other-task', 'a', []], ['approve', 'task-1', 'a', [{ call_id: 'tool', approved: 'yes' }]], ['message', 'task-1', 42], { bad: 'command' }]) {
    assert.throws(() => replayPendingCommand(api, 'task-1', { key: 'original-key', fingerprint: JSON.stringify(command) }))
  }
  assert.equal(calls, 0)
})

test('a rejected replay cannot clear uncertainty from an earlier lost acknowledgement', async () => {
  for (const status of [400, 401, 403, 404, 422]) {
    const storage = memoryStorage(); let originalKey = ''
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'original', async key => { originalKey = key; throw new TypeError('Acknowledgement lost') }))
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'original', async key => { assert.equal(key, originalKey); throw new TaskApiError(status, 'Replay rejected') }), /Replay rejected/)
    assert.equal(readPendingCommand(storage, pendingTaskCommandKey('alice', 'task-1'))?.key, originalKey, `replay ${status} cannot disprove original commit`)
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'corrected', async () => saved), /Resolve the pending/)
    await runTaskCommand(storage, 'alice', 'task-1', 'original', async key => { assert.equal(key, originalKey); return saved })
    assert.equal(storage.values.size, 0)
  }
})

test('known state-conflict rejections clear only a first attempt, never an uncertain replay', async () => {
  const messages = [
    'current run is still active', 'session must be idle before another turn',
    'no pending approval on this session', 'approval batch is no longer current',
    'interrupted execution requires reconciliation; start a new session',
  ]
  for (const message of messages) {
    const initial = memoryStorage()
    await assert.rejects(runTaskCommand(initial, 'alice', 'task-1', 'first', async () => { throw new TaskApiError(409, message) }))
    assert.equal(initial.values.size, 0, `${message}: first attempt is definitively rejected`)
    await runTaskCommand(initial, 'alice', 'task-1', 'corrected', async () => saved)
    const replay = memoryStorage(); let originalKey = ''
    await assert.rejects(runTaskCommand(replay, 'alice', 'task-1', 'original', async key => { originalKey = key; throw new TypeError('Acknowledgement lost') }))
    await assert.rejects(runTaskCommand(replay, 'alice', 'task-1', 'original', async () => { throw new TaskApiError(409, message) }))
    assert.equal(readPendingCommand(replay, pendingTaskCommandKey('alice', 'task-1'))?.key, originalKey, `${message}: replay must retain earlier uncertainty`)
  }
  for (const message of ['unknown conflict', 'receipt fingerprint mismatch', 'current run is still active (unknown extra detail)']) {
    const storage = memoryStorage()
    await assert.rejects(runTaskCommand(storage, 'alice', 'task-1', 'original', async () => { throw new TaskApiError(409, message) }))
    assert.ok(readPendingCommand(storage, pendingTaskCommandKey('alice', 'task-1')), `unknown 409 remains uncertain: ${message}`)
  }
})
