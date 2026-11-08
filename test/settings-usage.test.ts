import assert from 'node:assert/strict'
import test from 'node:test'
import { limitOf, resetLabel, usageOverview, usedFraction, usedOfLimit } from '../lib/settings/usage'

const meter = (meterKey: string, role: string | undefined, extra: Record<string, unknown> = {}) => ({
  meterKey, unit: 'tokens', label: meterKey, kind: 'COUNTER' as const, resetPeriod: 'MONTHLY' as const,
  consumed: 10, reserved: 0, totalUsed: 10, includedAllowance: 100, hardLimit: 100, overageEnabled: false,
  periodStart: '2026-11-01T00:00:00.000Z', role, ...extra,
})

test('the combined allowance is the headline, its daily pacing rides with it, and unspent token meters leave the list', () => {
  const overview = usageOverview({ meters: [
    meter('ai.tokens.input', 'ai.input'), meter('ai.tokens.output', 'ai.output'), meter('ai.unified', 'ai.allowance'),
    meter('ai.unified.daily', 'ai.pacing', { resetPeriod: 'DAILY' }), meter('ai.fallback.tokens.output', 'ai.fallback.output'),
    meter('sandbox.seconds', 'sandbox.time', { unit: 'seconds' }), meter('voice.seconds', undefined, { unit: 'seconds' }),
  ] })
  assert.equal(overview.ai?.monthly.meterKey, 'ai.unified')
  assert.equal(overview.ai?.daily?.meterKey, 'ai.unified.daily')
  assert.deepEqual(overview.rows.map((row) => row.meterKey), ['sandbox.seconds', 'voice.seconds'], 'a meter with no role is shown as itself')
})

test('without the combined meter the legacy output meter headlines, input stays a row, and a server without roles shows every meter', () => {
  const legacy = usageOverview({ meters: [meter('ai.tokens.input', 'ai.input'), meter('ai.tokens.output', 'ai.output'), meter('ai.fallback.tokens.input', 'ai.fallback.input')] })
  assert.equal(legacy.ai?.monthly.meterKey, 'ai.tokens.output')
  assert.equal(legacy.ai?.daily, undefined)
  assert.deepEqual(legacy.rows.map((row) => row.meterKey), ['ai.tokens.input'])
  const unlabelled = usageOverview({ meters: [meter('ai.tokens.output', undefined), meter('builds.started', undefined)] })
  assert.equal(unlabelled.ai, null)
  assert.equal(unlabelled.rows.length, 2)
})

test('limits and resets read from what the server reports, never a zero or a guess', () => {
  assert.equal(limitOf({ hardLimit: 0 }), null)
  assert.equal(limitOf({ hardLimit: 'unlimited' }), null)
  assert.equal(usedFraction({ hardLimit: 100, totalUsed: 250 }), 1)
  assert.equal(usedFraction({ hardLimit: 'unlimited', totalUsed: 5 }), null)
  assert.equal(resetLabel({ resetPeriod: 'MONTHLY', periodStart: '2026-11-01T00:00:00.000Z' }), 'Resets 1 Dec')
  assert.equal(resetLabel({ resetPeriod: 'DAILY', periodStart: '2026-11-08T00:00:00.000Z' }, new Date('2026-11-08T15:00:00Z')), 'Resets tomorrow')
  assert.equal(resetLabel({ resetPeriod: 'DAILY', periodStart: '2026-11-08T00:00:00.000Z' }, new Date('2026-11-10T15:00:00Z')), 'Resets 9 Nov')
  assert.equal(resetLabel({ resetPeriod: 'NEVER', periodStart: '2026-11-01T00:00:00.000Z' }), 'Does not reset')
  assert.equal(usedOfLimit({ unit: 'seconds', totalUsed: 1260, hardLimit: 3600 }), '21 min of 1 hour')
  assert.equal(usedOfLimit({ unit: 'bytes', totalUsed: 41_943_040, hardLimit: 104_857_600 }), '40 MB of 100 MB')
  assert.equal(usedOfLimit({ unit: 'tokens', totalUsed: 128_400, hardLimit: 300_000 }), '128,400 of 300K tokens')
  assert.equal(usedOfLimit({ unit: 'count', totalUsed: 7, hardLimit: 'unlimited' }), '7 used · Unlimited')
})
