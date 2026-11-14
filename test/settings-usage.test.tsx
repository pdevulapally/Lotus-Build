import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { accountSchema, usageSchema, sessionSchema, type BackendUsage } from '../lib/backend/client'
import { groupUsageMeters, meterProgress, usagePeriod, usageReset, remainingAllowance } from '../lib/settings/usage'
import { modelLabel } from '../lib/backend/model-selection'
import { sessionModel, settingsSessionId } from '../lib/settings/models'
import { AccountUsage, SessionUsage, UsageMeter } from '../components/settings/usage-panel'

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
    { ...meter, meterKey: 'renamed-build-counter', role: 'build', label: 'Builds' },
  ]))
  assert.equal(value.meters[0].role, 'ai.input')
  const groups = groupUsageMeters(value.meters)
  assert.deepEqual(groups.map((group) => [group.key, group.meters.map((row) => row.meterKey)]), [
    ['ai', ['unified']], ['tokens', ['renamed-input']], ['fallback', ['fallback']], ['workspace', ['workspace']], ['other', ['raw-ai-looking', 'old-response']],
  ])
  assert.equal(groups.flatMap((group) => group.meters).length, 6)
})

test('account usage retains exact server amounts, units and reservations without making a shared balance', () => {
  const html = renderToStaticMarkup(createElement(AccountUsage, { usage: usage([
    meter, { ...meter, meterKey: 'output', role: 'ai.output', label: 'Output tokens', consumed: 22625, reserved: 8192, totalUsed: 30817, hardLimit: 30000 },
  ]) }))
  assert.match(html, /297,048 tokens/)
  assert.match(html, /30,817 tokens/)
  assert.match(html, /22,625 tokens/); assert.match(html, /8,192 tokens/)
  assert.match(html, /Limit reached/)
  assert.match(html, /including reservations/)
  assert.doesNotMatch(html, /327,865|Credits|left this cycle/)
})

test('zero, unlimited, missing and empty usage are distinct truthful states', () => {
  const zero = { ...meter, totalUsed: 0, consumed: 0, hardLimit: 0 }
  assert.deepEqual(meterProgress(zero), { limit: 0, percent: 0, atLimit: true })
  const zeroHtml = renderToStaticMarkup(createElement(UsageMeter, { meter: zero }))
  assert.match(zeroHtml, /No allowance/)
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

})

test('a proposed fallback does not become the displayed session model before consent', () => {
  const offered = { ...session, fallback: { status: 'AWAITING_CONSENT' as const, reason: 'Quota', resumable: true, consent: false, offer: { model: 'vendor/free-model', effort: 'low' as const } } }
  assert.deepEqual(sessionModel(offered), { id: 'catalog-haiku', continuation: false })
  const continued = { ...offered, fallback: { ...offered.fallback, consent: true, lane: 'fallback' as const, status: 'RUNNING' as const } }
  assert.deepEqual(sessionModel(continued), { id: 'vendor/free-model', continuation: true })

})

test('settings fetches session data only on a valid computer route, never from a project or account path', () => {
  assert.equal(settingsSessionId('/computer/s'), 's')
  assert.equal(settingsSessionId('/computer/s/'), 's')
  for (const path of ['/project/s', '/computer/s/edit', '/computer/%2e%2e', '/computer/', null]) assert.equal(settingsSessionId(path), null)
})


test('compact allowance shows remaining without summing meters and resets on UTC boundaries', () => {
  assert.equal(remainingAllowance(meter), '1% remaining')
  assert.equal(remainingAllowance({ ...meter, totalUsed: 299999 }), '<0.1% remaining')
  assert.equal(usageReset(meter), 'Resets 1 Dec 2026 at 00:00 UTC')
  assert.equal(usageReset({ ...meter, periodStart: '2026-12-01T00:00:00Z' }), 'Resets 1 Jan 2027 at 00:00 UTC')
  assert.equal(usageReset({ ...meter, resetPeriod: 'DAILY', periodStart: '2028-02-28T00:00:00Z' }), 'Resets 29 Feb 2028 at 00:00 UTC')
  assert.equal(usageReset({ ...meter, resetPeriod: 'NEVER' }), 'Does not reset')
  const html = renderToStaticMarkup(createElement(AccountUsage, { usage: usage([meter, { ...meter, meterKey: 'resource', role: 'storage', label: 'Storage' }]) }))
  assert.doesNotMatch(html, /Workspace|>Storage</)
  assert.doesNotMatch(html, /Each allowance is separate|Other usage<\/h4>/)
  assert.match(html, /astryx-progress-bar/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /Add credits|Auto.recharge|balance|AI models/)
})

test('prepaid usage is separate from included allowance and cannot be counted twice', () => {
  const paid = { ...meter, consumed: 1100, reserved: 200, totalUsed: 1300, hardLimit: 1000, prepaidConsumed: 300, prepaidReserved: 100 }
  const parsed = usageSchema.parse(usage([paid])).meters[0]
  assert.equal(parsed.prepaidConsumed, 300)
  assert.deepEqual(meterProgress(parsed), { limit: 1000, percent: 90, atLimit: false })
  assert.equal(remainingAllowance(parsed), '10% remaining')
  const html = renderToStaticMarkup(createElement(AccountUsage, { usage: usage([parsed]) }))
  assert.match(html, /Plan used/); assert.match(html, /800 tokens/)
  assert.match(html, /Paid credits used/); assert.match(html, /300 tokens/)
  assert.match(html, /Paid credits reserved/)
  assert.equal(usageSchema.safeParse(usage([{ ...paid, prepaidConsumed: 1101 }])).success, false)
})

test('shared usage leads with pacing before the monthly pool, with old model counters kept as details', () => {
  const shared = { ...meter, meterKey: 'shared', role: 'ai.allowance', label: 'AI credits', unit: 'credits' }
  const daily = { ...shared, meterKey: 'daily', role: 'ai.pacing', label: 'Daily AI usage', resetPeriod: 'DAILY' as const }
  const weekly = { ...shared, meterKey: 'weekly', role: 'ai.pacing', label: 'Weekly AI usage', resetPeriod: 'WEEKLY' as const }
  const html = renderToStaticMarkup(createElement(AccountUsage, {
    usage: usage([meter, shared, daily, weekly,
      { ...meter, meterKey: 'previous', role: 'ai.fallback.input', label: 'Previous input' },
      { ...meter, meterKey: 'storage', role: 'storage', label: 'Storage' },
      { ...meter, meterKey: 'web-concurrency', role: 'sandbox.concurrency', label: 'Concurrent web sandboxes' },
      { ...meter, meterKey: 'mobile-concurrency', role: 'sandbox.concurrency', label: 'Concurrent mobile sandboxes' },
      { ...meter, meterKey: 'build-counter', role: 'build', label: 'Builds' },
    ]),
    onDemand: createElement('section', { 'aria-label': 'Purchased credits' }, 'Purchased credits'),
  }))
  assert.match(html, /One AI allowance across models, voice and projects/)
  assert.match(html, /Every window applies to the same allowance/)
  assert.match(html, /Usage details/)
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 1)
  assert.doesNotMatch(html, /View details for|View model usage details/)
  assert.doesNotMatch(html, /Builds/)
  assert.doesNotMatch(html, /Concurrent web sandboxes|Concurrent mobile sandboxes/)
  assert.match(html, /Previous model usage/)
  assert.doesNotMatch(html, /Each allowance is separate|View details for Input tokens|View details for Previous input/)
  assert.match(html, /Daily AI allowance/)
  assert.match(html, /Weekly AI allowance/)
  assert.match(html, /Monthly AI allowance/)
  assert.doesNotMatch(html, />AI credits</)
  assert.doesNotMatch(html, />Daily AI usage</)
  assert.ok(html.indexOf('Daily AI allowance') < html.indexOf('Weekly AI allowance'))
  assert.ok(html.indexOf('Weekly AI allowance') < html.indexOf('Monthly AI allowance'))
  assert.ok(html.indexOf('Monthly AI allowance') < html.indexOf('Purchased credits'))
  assert.doesNotMatch(html, />Storage</)
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 3)
})


test('session usage errors do not expose server diagnostics', () => {
  const html = renderToStaticMarkup(createElement(SessionUsage, { usage: null, error: 'Internal database diagnostic', loading: false }))
  assert.match(html, /Refresh to try again/)
  assert.doesNotMatch(html, /Internal database diagnostic/)
})
