import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient, BackendError, sessionSchema } from '../lib/backend/client'
import { applyPlanEvent, approvePlan, editPlan, planAvailability, sessionPlanSchema } from '../lib/backend/session-plan'

const session = {
  id: 'ses_1', projectId: 'prj_1', status: 'IDLE', model: 'claude', effort: 'standard', mode: 'plan', messageCount: 2, createdAt: '2026-11-06T18:00:00.000Z',
}
const plan = {
  protocol: 1, revision: 2, title: 'Todo app', summary: 'A small list with **persistence**.',
  steps: [{ id: 's1', title: 'Scaffold', status: 'done', evidence: ['tool-1'] }, { id: 's2', title: 'List view', status: 'in_progress' }, { id: 's3', title: 'Tests', status: 'proposed' }],
  questions: [{ id: 'q1', text: 'Persist between reloads?' }], checks: ['npm test'], decisions: [], risks: ['No backend yet'], source: 'agent',
}

test('a session parses with the plan and with a mode this client has never seen', () => {
  const parsed = sessionSchema.parse({ ...session, plan })
  assert.equal(parsed.plan?.revision, 2)
  assert.equal(parsed.plan?.steps[1]?.status, 'in_progress')
  assert.equal(sessionSchema.parse({ ...session, mode: 'auto' }).mode, 'auto')
  assert.equal(sessionSchema.parse(session).plan, undefined)
  assert.throws(() => sessionPlanSchema.parse({ ...plan, steps: [{ id: 's1', title: 'x', status: 'finished' }] }))
  assert.throws(() => sessionPlanSchema.parse({ ...plan, title: 'x'.repeat(201) }))
})

test('a plan event replaces the plan only when its revision is newer', () => {
  const current = sessionSchema.parse({ ...session, plan })
  const newer = { ...plan, revision: 3, approvedRevision: 3, steps: plan.steps.map((step) => ({ ...step, status: 'done' as const })) }
  const updated = applyPlanEvent(current, { type: 'session.plan_updated', data: { revision: 3, plan: newer } })
  assert.equal(updated?.plan?.revision, 3)
  assert.equal(updated?.plan?.approvedRevision, 3)
  const stale = applyPlanEvent(updated, { type: 'session.plan_updated', data: { revision: 2, plan } })
  assert.equal(stale, updated)
  assert.equal(applyPlanEvent(current, { type: 'session.plan_updated', data: { plan: { bogus: true } } }), current)
  assert.equal(applyPlanEvent(current, { type: 'session.idle', data: {} }), current)
  assert.equal(applyPlanEvent(null, { type: 'session.plan_updated', data: { plan } }), null)
})

test('approve and edit are offered only between runs with nothing else waiting on the user', () => {
  const idle = sessionSchema.parse({ ...session, plan })
  assert.deepEqual([planAvailability(idle).canApprove, planAvailability(idle).canEdit], [true, true])
  for (const status of ['QUEUED', 'RUNNING'] as const) {
    const busy = planAvailability({ ...idle, status })
    assert.deepEqual([busy.canApprove, busy.canEdit], [false, false], status)
  }
  const asked = planAvailability({ ...idle, pendingInput: { id: 'in_1', kind: 'question', prompt: 'Which colour?' } })
  assert.deepEqual([asked.canApprove, asked.canEdit], [false, false])
  const approved = planAvailability({ ...idle, plan: { ...idle.plan!, approvedRevision: 2 } })
  assert.deepEqual([approved.canApprove, approved.canEdit], [false, true])
  const changed = planAvailability({ ...idle, plan: { ...idle.plan!, revision: 3, approvedRevision: 2 } })
  assert.equal(changed.canApprove, true)
  assert.equal(planAvailability(sessionSchema.parse(session)).canApprove, false)
  assert.equal(planAvailability(null).plan, undefined)
})

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) }, size: () => values.size }
}

test('approval names the revision, carries one Idempotency-Key per attempt chain, and applies the server session', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  let fail = true
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test-token', fetch: async (input, init) => {
    calls.push({ url: String(input), init: init! })
    if (fail) { fail = false; return new Response(JSON.stringify({ error: { code: 'network/unavailable', message: 'Try again.' } }), { status: 503 }) }
    return new Response(JSON.stringify({ ...session, status: 'QUEUED', mode: 'build', execution: 2, plan: { ...plan, approvedRevision: 2 } }), { status: 200 })
  } })
  const storage = memoryStorage()
  await assert.rejects(approvePlan(client, storage, 'user-a', 'ses_1', 2), (error: unknown) => error instanceof BackendError && error.status === 503)
  assert.equal(storage.size(), 1, 'the key survives a failed attempt')
  const result = await approvePlan(client, storage, 'user-a', 'ses_1', 2)
  assert.equal(result.plan?.approvedRevision, 2)
  assert.equal(result.mode, 'build')
  assert.equal(storage.size(), 0)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.url, 'https://backend.example/sessions/ses_1/plan/approve')
    assert.equal(call.init.method, 'POST')
    assert.deepEqual(JSON.parse(String(call.init.body)), { revision: 2 })
  }
  const keys = calls.map((call) => (call.init.headers as Record<string, string>)['Idempotency-Key'])
  assert.equal(keys[0], keys[1], 'a retry replays the same command, never a second approval')
  assert.match(keys[0]!, /^[0-9a-f-]{36}$/)
})

test('a user edit is a PATCH fenced on the revision, limited to what a user may change', async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test-token', fetch: async (input, init) => {
    calls.push({ url: String(input), init: init! })
    return new Response(JSON.stringify({ plan: { ...plan, revision: 3, source: 'user', steps: [plan.steps[0], plan.steps[1], { ...plan.steps[2], status: 'skipped', note: 'Skipped by you' }], questions: [{ id: 'q1', text: 'Persist between reloads?', answer: 'Yes' }] } }), { status: 200 })
  } })
  const result = await editPlan(client, memoryStorage(), 'user-a', 'ses_1', 2, { steps: [{ id: 's3', status: 'skipped', note: 'Skipped by you' }], answers: [{ id: 'q1', answer: 'Yes' }] })
  assert.equal(result.plan.revision, 3)
  assert.equal(result.plan.approvedRevision, undefined)
  assert.equal(calls[0]!.url, 'https://backend.example/sessions/ses_1/plan')
  assert.equal(calls[0]!.init.method, 'PATCH')
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { revision: 2, steps: [{ id: 's3', status: 'skipped', note: 'Skipped by you' }], answers: [{ id: 'q1', answer: 'Yes' }] })
  // A user cannot claim a step is done; the agent proves that with evidence.
  await assert.rejects(editPlan(client, memoryStorage(), 'user-a', 'ses_1', 2, { steps: [{ id: 's3', status: 'done' as 'skipped' }] }))
  assert.equal(calls.length, 1)
})

test('a stale approval surfaces the server code so the page refreshes instead of alarming', async () => {
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test-token',
    fetch: async () => new Response(JSON.stringify({ error: { code: 'plan/stale-revision', message: 'The plan changed since you looked at it.' } }), { status: 409 }) })
  await assert.rejects(approvePlan(client, memoryStorage(), 'user-a', 'ses_1', 1), (error: unknown) => error instanceof BackendError && error.code === 'plan/stale-revision' && error.status === 409)
})
