import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { BackendClient, sessionSchema, type BackendSession } from '../lib/backend/client'
import { continueSession, readPendingContinuation } from '../lib/backend/continue-session'

const session: BackendSession = { id: 's', projectId: 'p', status: 'IDLE', model: 'original-model', effort: 'standard', mode: 'build', messageCount: 1, createdAt: new Date().toISOString(),
  fallback: { status: 'AWAITING_CONSENT', reason: 'Premium allowance reached.', resumable: true, consent: false, checkpointId: 'version', offer: { model: 'offered-model', effort: 'low' } } }
const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/continuation-status.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function render(value: BackendSession) {
  const module = { exports: {} as { ContinuationStatus: React.ComponentType<Record<string, unknown>> } }
  const isolatedRequire = (id: string) => id === 'next/link' ? { __esModule: true, default: (props: Record<string, unknown>) => createElement('a', props) } : require(id)
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  return renderToStaticMarkup(createElement(module.exports.ContinuationStatus, { session: value, busy: false, onContinue: () => assert.fail('Rendering must never accept consent'), onCancel: () => {} }))
}

test('continuation UI names the offered model and requires explicit consent while preserving original retry', () => {
  const html = render(session)
  assert.match(html, /Continue with the free model: offered-model/)
  assert.match(html, /Retry with original-model/)
  assert.match(html, /View upgrade options/)
  assert.match(html, /Cancel task/)
})

test('temporary capacity and expired context have distinct actionable states', () => {
  const queued = render({ ...session, status: 'QUEUED', fallback: { ...session.fallback!, status: 'CAPACITY_WAIT', reason: 'Waiting for capacity.' } })
  assert.match(queued, /remains queued/); assert.doesNotMatch(queued, /Continue with the free model/)
  const expired = render({ ...session, fallback: { ...session.fallback!, status: 'UNAVAILABLE', resumable: false, reason: 'Saved screenshot context expired. Fresh context is required.' } })
  assert.match(expired, /Fresh context is required/); assert.doesNotMatch(expired, /Continue with the free model|Retry with/)
  const expiry = new Date(Date.now() + 1000).toISOString()
  assert.match(render({ ...session, fallback: { ...session.fallback!, imageExpiresAt: expiry } }), /Saved screenshot context expires/)
  assert.equal(sessionSchema.safeParse({ ...session, fallback: { ...session.fallback, imageExpiresAt: 'invalid' } }).success, false)
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
