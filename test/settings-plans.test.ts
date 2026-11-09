import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { BackendAccount, BackendPlan, BackendSubscription } from '../lib/backend/client'
import { describeChangeCharge, longDate, planChoices, describeSubscriptionOutcome } from '../lib/settings/plans'

const plan = (key: string, rank: number, amountMinor?: number): BackendPlan => ({ key, name: key, rank, billing: { perSeat: false, minSeats: 1 }, capabilities: [], allowances: [],
  ...(amountMinor === undefined ? {} : { price: { amountMinor, currency: 'gbp', interval: 'month' } }) })
const plans = [plan('business', 3, 7200), plan('free', 1), plan('pro', 2, 2400)]
const account = (key: string) => ({ plan: { key, name: key } }) as BackendAccount
const subscription = (planKey: string): BackendSubscription => ({ planKey, status: 'ACTIVE', currentPeriodEnd: '2026-12-08T12:00:00.000Z', cancelAtPeriodEnd: false })

test('plans are ordered by rank and a free account is offered checkout, never an in-place change', () => {
  const choices = planChoices(plans, account('free'), null)
  assert.deepEqual(choices.map((choice) => [choice.plan.key, choice.relation]), [['free', 'current'], ['pro', 'subscribe'], ['business', 'subscribe']])
  assert.equal(choices[1]?.price?.amount, '£24')
})

test('a subscriber sees upgrade and downgrade by rank, and the free plan as letting the paid plan end', () => {
  assert.deepEqual(planChoices(plans, account('pro'), subscription('pro')).map((choice) => choice.relation), ['cancel', 'current', 'upgrade'])
  assert.deepEqual(planChoices(plans, account('business'), subscription('business')).map((choice) => choice.relation), ['cancel', 'downgrade', 'current'])
})

test('the change charge reads from Stripe\'s preview, never from a client computation', () => {
  assert.match(describeChangeCharge({ amountDueMinor: 4800, currency: 'gbp' }), /^Your next invoice is estimated at £48: the prorated difference/)
  assert.doesNotMatch(describeChangeCharge({ amountDueMinor: 4800, currency: 'gbp' }), /charged today/, 'create_prorations bills the difference on the next invoice; nothing is taken today')
  assert.match(describeChangeCharge({ amountDueMinor: 0, currency: 'gbp' }), /^Estimated: nothing more to pay/)
  assert.equal(longDate('2026-12-08T12:00:00.000Z'), '8 December 2026')
})

test('what the user is told after a change comes from the returned subscription, not the requested target', () => {
  const plans = [{ key: 'pro', name: 'Pro' }, { key: 'business', name: 'Business' }]
  const end = '2026-12-01T00:00:00.000Z'
  assert.equal(describeSubscriptionOutcome({ planKey: 'pro', cancelAtPeriodEnd: false, currentPeriodEnd: end }, plans), 'You are on Pro. It renews on 1 December 2026.')
  assert.match(describeSubscriptionOutcome({ planKey: 'pro', cancelAtPeriodEnd: true, currentPeriodEnd: end }, plans), /on Pro until 1 December 2026, when it ends/)
  assert.doesNotMatch(describeSubscriptionOutcome({ planKey: 'pro', cancelAtPeriodEnd: true, currentPeriodEnd: end }, plans), /renews/)
  assert.equal(describeSubscriptionOutcome({ planKey: 'unknown', cancelAtPeriodEnd: false, currentPeriodEnd: end }, null), 'You are on unknown. It renews on 1 December 2026.')
  assert.equal(describeSubscriptionOutcome(null, plans), 'You no longer have a paid plan.')
})
