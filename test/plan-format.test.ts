import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { describeAllowance, featuredPlanKey, formatAllowanceValue, formatPlanPrice } from '../lib/plans/format'

test('allowance units read as humans say them', () => {
  assert.equal(formatAllowanceValue('tokens', 1_200_000), '1.2M tokens')
  assert.equal(formatAllowanceValue('tokens', 30_000), '30K tokens')
  assert.equal(formatAllowanceValue('seconds', 36_000), '10 hours')
  assert.equal(formatAllowanceValue('seconds', 3_600), '1 hour')
  assert.equal(formatAllowanceValue('bytes', 5_368_709_120), '5 GB')
  assert.equal(formatAllowanceValue('count', 3), '3')
  assert.equal(formatAllowanceValue('widgets', 2), '2 widgets')
})

test('a ceiling is only shown when the limit exceeds the included amount', () => {
  assert.deepEqual(describeAllowance({ key: 'a', label: 'Builds', unit: 'count', included: 10, limit: 10 }), { included: '10' })
  assert.deepEqual(describeAllowance({ key: 'a', label: 'Builds', unit: 'count', included: 200, limit: 400 }), { included: '200', ceiling: 'up to 400' })
})

test('prices drop trailing zero pence and name the interval', () => {
  assert.deepEqual(formatPlanPrice({ amountMinor: 2400, currency: 'gbp', interval: 'month' }), { amount: '£24', interval: 'per month' })
  assert.deepEqual(formatPlanPrice({ amountMinor: 2450, currency: 'gbp', interval: 'year' }), { amount: '£24.50', interval: 'per year' })
})

test('the featured plan is the middle paid tier, or the only paid tier', () => {
  const plan = (key: string, rank: number, priced: boolean) => ({ key, name: key, rank, capabilities: [], allowances: [], ...(priced ? { price: { amountMinor: 100, currency: 'gbp', interval: 'month' as const } } : {}) })
  assert.equal(featuredPlanKey([plan('free', 0, false), plan('pro', 1, true), plan('business', 2, true)]), 'pro')
  assert.equal(featuredPlanKey([plan('free', 0, false), plan('pro', 1, true), plan('business', 2, true), plan('scale', 3, true)]), 'business')
  assert.equal(featuredPlanKey([plan('free', 0, false)]), undefined)
})
