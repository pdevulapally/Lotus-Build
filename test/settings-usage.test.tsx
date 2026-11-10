import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { accountSchema, usageSchema, sessionSchema, type BackendUsage } from '../lib/backend/client'
import { groupUsageMeters, meterProgress, usagePeriod } from '../lib/settings/usage'
import { modelLabel } from '../lib/backend/model-selection'
import { sessionModel, settingsSessionId } from '../lib/settings/models'
import { AccountUsage, SessionUsage, UsageMeter } from '../components/settings/usage-panel'
import { ModelsPanel } from '../components/settings/models-panel'

const meter: BackendUsage['meters'][number] = {
  meterKey: 'renamed-input', role: 'ai.input', label: 'Input tokens', unit: 'tokens', kind: 'COUNTER', resetPeriod: 'MONTHLY',
  consumed: 297048, reserved: 0, totalUsed: 297048, includedAllowance: 300000, hardLimit: 300000,
  overageEnabled: false, periodStart: '2026-11-01T00:00:00Z',
}
const usage = (meters: BackendUsage['meters']) => ({ uid: 'u', plan: { key: 'free', name: 'Free' }, meters })
const account = accountSchema.parse({ uid: 'u', email: 'demo@example.test', emailVerified: true, projectCount: 2,
  plan: { key: 'free', name: 'Free' }, capabilities: [], limits: [],
  models: [{ id: 'catalog-haiku', name: 'Claude Haiku 4.5', efforts: ['standard'], maxOutputTokens: 8192 }],
})
const session = sessionSchema.parse({ id: 's', projectId: 'p', status: 'IDLE', model: 'catalog-haiku', effort: 'standard', mode: 'auto', messageCount: 2, createdAt: '2026-11-10T00:00:00Z' })

test('usage preserves server roles, accepts future roles, and groups by role rather than meter keys or labels', () => {
  const value = usageSchema.parse(usage([
    meter,
    { ...meter, meterKey: 'raw-ai-looking', role: 'future.unknown' },
    { ...meter, meterKey: 'unified', role: 'ai.allowance', unit: 'credits' },
    { ...meter, meterKey: 'fallback', role: 'ai.fallback.input' },
    { ...meter, meterKey: 'workspace', role: 'sandbox.time', unit: 'seconds' },
    { ...meter, meterKey: 'old-response', role: undefined },
  ]))
  assert.equal(value.meters[0].role, 'ai.input')
  const groups = groupUsageMeters(value.meters)
  assert.deepEqual(groups.map((group) => [group.key, group.meters.map((row) => row.meterKey)]), [
    ['ai', ['renamed-input', 'unified']], ['fallback', ['fallback']], ['workspace', ['workspace']], ['other', ['raw-ai-looking', 'old-response']],
  ])
  assert.equal(groups.flatMap((group) => group.meters).length, 6)
})

test('account usage retains exact server amounts, units and reservations without making a shared balance', () => {
  const html = renderToStaticMarkup(createElement(AccountUsage, { usage: usage([
    meter, { ...meter, meterKey: 'output', role: 'ai.output', label: 'Output tokens', consumed: 22625, reserved: 8192, totalUsed: 30817, hardLimit: 30000 },
  ]) }))
  assert.match(html, /297,048 tokens/)
  assert.match(html, /30,817 tokens/)
  assert.match(html, /22,625 tokens used · 8,192 tokens reserved/)
  assert.match(html, /Limit reached/)
  assert.match(html, /including reservations/)
  assert.doesNotMatch(html, /327,865|Credits|left this cycle|99%/)
})

test('zero, unlimited, missing and empty usage are distinct truthful states', () => {
  const zero = { ...meter, totalUsed: 0, consumed: 0, hardLimit: 0 }
  assert.deepEqual(meterProgress(zero), { limit: 0, percent: 0, atLimit: true })
  const zeroHtml = renderToStaticMarkup(createElement(UsageMeter, { meter: zero }))
  assert.match(zeroHtml, /No allowance/); assert.match(zeroHtml, /of 0 tokens/)
  assert.doesNotMatch(zeroHtml, /Unlimited|NaN|Infinity|role="progressbar"/)
  const unlimitedHtml = renderToStaticMarkup(createElement(UsageMeter, { meter: { ...meter, hardLimit: 'unlimited' } }))
  assert.match(unlimitedHtml, /Unlimited/); assert.doesNotMatch(unlimitedHtml, /role="progressbar"/)
  assert.match(renderToStaticMarkup(createElement(AccountUsage, { usage: null })), /unavailable/)
  assert.match(renderToStaticMarkup(createElement(AccountUsage, { usage: usage([]) })), /No usage has been reported/)
})

test('reset boundaries use the server period in UTC and lifetime usage does not invent a reset date', () => {
  assert.equal(usagePeriod(meter), 'Resets monthly · Period started 1 Nov 2026 (UTC)')
  assert.equal(usagePeriod({ ...meter, resetPeriod: 'NEVER' }), 'Does not reset')
})

test('session totals remain separate from account limits and empty data does not claim zero usage', () => {
  const html = renderToStaticMarkup(createElement(SessionUsage, { usage: { sessionId: 's', meters: [{ meterKey: 'i', label: 'Input tokens', unit: 'tokens', settled: 10000, open: 8192 }] }, error: null, loading: false }))
  assert.match(html, /10,000 tokens/); assert.match(html, /8,192 tokens/)
  assert.match(html, /across its runs/); assert.doesNotMatch(html, /300,000|progressbar/)
  const empty = renderToStaticMarkup(createElement(SessionUsage, { usage: { sessionId: 's', meters: [] }, error: null, loading: false }))
  assert.match(empty, /No usage has been reported/); assert.doesNotMatch(empty, /0 tokens/)
  const failure = renderToStaticMarkup(createElement(SessionUsage, { usage: null, error: 'Service unavailable.', loading: false }))
  assert.match(failure, /role="alert"/); assert.doesNotMatch(failure, /0 tokens/)
})

test('current and catalogue model labels agree without inventing a model name or an account default', () => {
  assert.equal(modelLabel(account.models, 'catalog-haiku'), 'Claude Haiku 4.5')
  assert.equal(modelLabel(account.models, 'removed-model'), 'removed-model')
  const html = renderToStaticMarkup(createElement(ModelsPanel, { account, sessionId: 's', session, error: null, loading: false }))
  assert.equal((html.match(/Claude Haiku 4.5/g) ?? []).length, 2)
  assert.match(html, /Available for new sessions/); assert.match(html, /separate from your account allowance/)
  assert.doesNotMatch(html, /Sonnet|default model/i)
})

test('a proposed fallback does not become the displayed session model before consent', () => {
  const offered = { ...session, fallback: { status: 'AWAITING_CONSENT' as const, reason: 'Quota', resumable: true, consent: false, offer: { model: 'vendor/free-model', effort: 'low' as const } } }
  assert.deepEqual(sessionModel(offered), { id: 'catalog-haiku', continuation: false })
  const continued = { ...offered, fallback: { ...offered.fallback, consent: true, lane: 'fallback' as const, status: 'RUNNING' as const } }
  assert.deepEqual(sessionModel(continued), { id: 'vendor/free-model', continuation: true })
  const html = renderToStaticMarkup(createElement(ModelsPanel, { account, sessionId: 's', session: continued, error: null, loading: false }))
  assert.match(html, /vendor\/free-model/); assert.match(html, /Original selection: .*Claude Haiku 4.5/)
})

test('settings fetches session data only on a valid computer route, never from a project or account path', () => {
  assert.equal(settingsSessionId('/computer/s'), 's')
  assert.equal(settingsSessionId('/computer/s/'), 's')
  for (const path of ['/project/s', '/computer/s/edit', '/computer/%2e%2e', '/computer/', null]) assert.equal(settingsSessionId(path), null)
})
