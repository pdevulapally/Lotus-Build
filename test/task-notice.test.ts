import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendError, type BackendSession } from '../lib/backend/client'
import { selectTaskNotice } from '../lib/backend/task-notice'

const session: BackendSession = { id: 's', projectId: 'p', model: 'model', mode: 'build', effort: 'standard', status: 'FAILED', messageCount: 1, createdAt: '2026-11-11T00:00:00Z' }

test('one task notice takes the authoritative limit instead of duplicating local errors and recovery diagnostics', () => {
  const error = new BackendError(402, 'usage/limit-reached', 'Raw quota error', undefined, { label: 'Input tokens', unit: 'tokens', limit: 100, consumed: 100, reserved: 0 })
  const view = selectTaskNotice({ session: { ...session, error: error.message,
    fallback: { status: 'UNAVAILABLE', reason: 'The transcript is saved, but a durable workspace checkpoint is unavailable.', limitLabel: 'Input tokens', resumable: false, consent: false } }, requestError: error, streamError: 'Connection interrupted.' })
  assert.ok(view)
  assert.equal(view.title, 'Your usage limit is reached')
  assert.doesNotMatch(`${view.title} ${view.description ?? ''}`, /Raw quota error|durable workspace checkpoint|Connection interrupted/)
  assert.deepEqual(view.actions, ['upgrade'])
})

test('unstructured error text cannot invent an allowance or an upgrade action', () => {
  const view = selectTaskNotice({ session, requestError: 'An upstream service mentioned a token limit.' })
  assert.equal(view?.title, 'Your request couldn’t be completed')
  assert.equal(view?.kind, 'error')
  assert.deepEqual(view?.actions, [])
})

test('a configuration failure is not presented as a paid upgrade problem', () => {
  const view = selectTaskNotice({ session: { ...session, error: 'The selected provider is not configured.', fallback: {
    status: 'UNAVAILABLE', reason: 'No fallback was started.', resumable: false, consent: false,
  } } })
  assert.equal(view?.title, 'This request couldn’t finish')
  assert.deepEqual(view?.actions, [])
})

test('completed and running continuation states produce no stale notice and still allow real transport failures', () => {
  for (const status of ['RUNNING', 'COMPLETED'] as const) {
    const active = { ...session, status: 'RUNNING' as const, fallback: { status, reason: 'Continuation active.', resumable: false, consent: true } }
    assert.equal(selectTaskNotice({ session: active }), null)
    assert.deepEqual(selectTaskNotice({ session: active, streamError: 'Connection interrupted.' })?.actions, ['reconnect'])
  }
})
