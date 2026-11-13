import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { BackendClient, sessionSchema, type BackendSession } from '../lib/backend/client'
import { continueSession, readPendingContinuation } from '../lib/backend/continue-session'
import { selectTaskNotice } from '../lib/backend/task-notice'

const session: BackendSession = { id: 's', projectId: 'p', status: 'IDLE', model: 'original-model', effort: 'standard', mode: 'build', messageCount: 1, createdAt: new Date().toISOString(),
  fallback: { status: 'AWAITING_CONSENT', reason: 'Premium allowance reached.', resumable: true, consent: false, checkpointId: 'version', offer: { accounting: 'shared', model: 'offered-model', effort: 'low' } } }

test('credit exhaustion offers the current paused task without suggesting a model switch', () => {
  const paused = { ...session, fallback: { status: 'AWAITING_CREDITS' as const, lane: 'premium' as const,
    reason: 'Add credits to continue.', resumable: true, consent: false, checkpointId: 'saved' } }
  assert.equal(sessionSchema.safeParse(paused).success, true)
  const notice = selectTaskNotice({ session: paused })
  assert.equal(notice?.actions[0], 'credits')
  assert.deepEqual(notice?.creditTask, { sessionId: 's', checkpointId: 'saved' })
  assert.equal(notice?.actions.includes('free'), false)
})
const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/task-notice.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function render(value: BackendSession) {
  const module = { exports: {} as { TaskNotice: React.ComponentType<Record<string, unknown>> } }
  const isolatedRequire = (id: string) => id === 'next/link' ? { __esModule: true, default: (props: Record<string, unknown>) => createElement('a', props) } : require(id)
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  return renderToStaticMarkup(createElement(module.exports.TaskNotice, { notice: selectTaskNotice({ session: value }), busy: false, onContinue: () => assert.fail('Rendering must never accept consent'), onCancel: () => {} }))
}

test('continuation UI names the offered model and requires explicit consent while preserving original retry', () => {
  const html = render(session)
  assert.match(html, /Your usage limit is reached/)
  assert.match(html, /Switch model/)
  assert.match(html, /offered-model/)
  assert.doesNotMatch(html, /via |then corrected/)
  assert.match(html, /Continue task/)
  assert.match(html, /Upgrade/)
  assert.match(html, /Cancel task/)
  const viaOpenRouter = render({ ...session, fallback: { ...session.fallback!, lane: 'fallback', offer: { accounting: 'shared', provider: 'nvidia', model: 'vendor/model', effort: 'low', estimatedInput: true } } })
  assert.match(viaOpenRouter, /vendor\/model via NVIDIA/)
  assert.doesNotMatch(viaOpenRouter, /then corrected/)
  const unavailable = render({ ...session, fallback: { status: 'UNAVAILABLE', reason: 'The configured fallback provider is not set up on this service.', resumable: true, consent: false } })
  assert.match(unavailable, /This request couldn\u2019t finish/)
  assert.doesNotMatch(unavailable, /Task paused/)
  assert.doesNotMatch(unavailable, /configured fallback provider/)
  assert.doesNotMatch(unavailable, /Switch model/)
  assert.match(unavailable, /Retry with original-model/)
})

test('temporary capacity and expired context have distinct actionable states', () => {
  const queued = render({ ...session, status: 'QUEUED', fallback: { ...session.fallback!, status: 'CAPACITY_WAIT', reason: 'Waiting for capacity.' } })
  assert.match(queued, /selected model is busy/); assert.match(queued, /retry automatically/); assert.doesNotMatch(queued, /Switch model/)
  const expired = render({ ...session, fallback: { ...session.fallback!, status: 'UNAVAILABLE', resumable: false, reason: 'Saved screenshot context expired. Fresh context is required.' } })
  assert.match(expired, /send a new message/); assert.doesNotMatch(expired, /Switch model|Retry with/)
  const expiry = new Date(Date.now() + 1000).toISOString()
  assert.match(render({ ...session, fallback: { ...session.fallback!, imageExpiresAt: expiry } }), /share a new screenshot/)
  const failed = render({ ...session, fallback: { status: 'UNAVAILABLE', reason: 'The free model could not finish this task.', resumable: false, consent: true, resetAt: new Date(Date.now() + 86_400_000).toISOString() } })
  assert.doesNotMatch(failed, /Allowance resets/)
  assert.equal(sessionSchema.safeParse({ ...session, fallback: { ...session.fallback, imageExpiresAt: 'invalid' } }).success, false)
})

test('failed continuations show a plain-language notice without raw diagnostics', () => {
  const reason = 'The transcript is saved, but a durable workspace checkpoint is unavailable for this task. No model was switched.'
  const error = 'The Free plan allows 300000 tokens of Input tokens, and 300000 tokens of that is already used or held.'
  const limited = render({ ...session, status: 'FAILED', error, fallback: { status: 'UNAVAILABLE', reason, resumable: false, consent: false, limitLabel: 'Input tokens', resetAt: '2026-12-01T00:00:00Z' } })
  assert.match(limited, /<h2[^>]*>Your usage limit is reached<\/h2>/)
  assert.doesNotMatch(limited, /The Free plan allows|durable workspace checkpoint/)
  assert.match(limited, /Allowance resets/)
  assert.doesNotMatch(limited, /Task paused|Retry with/)
  const failed = render({ ...session, status: 'FAILED', error: 'The workspace storage limit was reached.', fallback: { status: 'UNAVAILABLE', reason, resumable: false, consent: false } })
  assert.match(failed, /This request couldn\u2019t finish/)
  assert.doesNotMatch(failed, /Input tokens limit reached|Allowance resets/)
  const shared = render({ ...session, fallback: { status: 'SHARED_LIMIT', reason: 'No more execution capacity is available for this account.', limitLabel: 'Concurrent tasks', resumable: false, consent: true } })
  assert.match(shared, /<h2[^>]*>Your usage limit is reached<\/h2>/)
})

test('a lost continuation acknowledgement survives a new client and retries only its original command identity', async () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  const command = { checkpointId: 'version', lane: 'fallback' as const, model: 'offered-model', effort: 'low' as const }
  const requests: { key: string | null, body: string }[] = []
  let lost = true
  const client = () => new BackendClient({ origin: 'https://api.example.test', token: async () => 'token', fetch: async (_input, init) => {
    requests.push({ key: new Headers(init?.headers).get('Idempotency-Key'), body: String(init?.body) })
    if (lost) throw new Error('Connection lost after acceptance')
    return Response.json({ ...session, status: 'QUEUED' })
  } })
  await assert.rejects(continueSession(client(), storage, 'u', 's', command))
  assert.ok(readPendingContinuation(storage, 'u', 's'))
  assert.equal(readPendingContinuation(storage, 'other', 's'), null)
  await assert.rejects(continueSession(client(), storage, 'u', 's', { ...command, model: 'different' }), /Reconcile/)
  assert.equal(requests.length, 1)
  lost = false
  assert.equal((await continueSession(client(), storage, 'u', 's', command)).status, 'QUEUED')
  assert.deepEqual(requests[0], requests[1]); assert.equal(values.size, 0)
})

test('raw request and connection errors never become user-facing copy', () => {
  const diagnostic = 'provider/overloaded HTTP 503 Traceback: secret technical details'
  for (const input of [{ requestError: diagnostic }, { streamError: diagnostic }, { fileError: diagnostic }]) {
    const notice = selectTaskNotice({ session: null, ...input })
    assert.ok(notice?.title)
    assert.doesNotMatch(JSON.stringify(notice), /provider\/overloaded|HTTP 503|Traceback/)
  }
  assert.deepEqual(selectTaskNotice({ session: null, streamError: diagnostic })?.actions, ['reconnect'])
  assert.deepEqual(selectTaskNotice({ session: null, fileError: diagnostic })?.actions, ['refresh'])
  const html = render({ ...session, status: 'FAILED', error: diagnostic, fallback: undefined })
  assert.doesNotMatch(html, /Task paused|text-destructive|HTTP 503|Traceback|Retry with/)
  assert.match(html, /role="alert"/)
})
