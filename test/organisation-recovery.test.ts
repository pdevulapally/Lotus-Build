import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'
import { describeSeatRecovery } from '../lib/settings/organisations'

const operation = { intent: 'i', stripeKey: 'seats:org-1:sub_1:3:i', generation: 2, placedAt: null }
const subscription = { planKey: 'teams', planName: 'Teams', status: 'ACTIVE', seats: 3, currentPeriodEnd: '2026-12-01T00:00:00.000Z', cancelAtPeriodEnd: false }

test('reconcileSeats posts to the organisation\'s reconcile route and validates each answer shape', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const answers = [
    { subscription, pending: null },
    { subscription, pending: { kind: 'checkout', seats: 3, url: 'https://checkout.test/cs_1', operation } },
    { subscription, pending: { kind: 'seats', seats: 3, review: 'key-expired', operation } },
  ]
  const client = new BackendClient({ origin: 'http://127.0.0.1:8080', token: async () => 't', fetch: (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(answers[calls.length - 1]), { status: 200, headers: { 'content-type': 'application/json' } }) }) as typeof fetch })
  for (const expected of answers) assert.deepEqual(await client.reconcileSeats('org1'), expected)
  assert.equal(calls[0]!.url, 'http://127.0.0.1:8080/organisations/org1/billing/seats/reconcile'); assert.equal(calls[0]!.init?.method, 'POST')
  assert.throws(() => client.reconcileSeats('../x'), 'an invalid organisation id is refused before any request')
})

test('the owner is told what the server found: resolved, an open payment to finish, or a named reason the change cannot be applied as it was', () => {
  assert.deepEqual(describeSeatRecovery({ subscription, pending: null }), { kind: 'resolved', message: 'Nothing is pending. The plan has 3 seats.' })
  assert.deepEqual(describeSeatRecovery({ subscription: null, pending: null }), { kind: 'resolved', message: 'Nothing is pending. This organisation has no plan.' })
  assert.deepEqual(describeSeatRecovery({ subscription, pending: { kind: 'checkout', seats: 3, url: 'https://checkout.test/cs_1', operation } }), { kind: 'checkout', message: 'A payment for 3 seats is still open.', url: 'https://checkout.test/cs_1' })
  const review = describeSeatRecovery({ subscription, pending: { kind: 'seats', seats: 3, review: 'subscription-replaced', operation } })
  assert.equal(review.kind, 'review'); assert.match(review.message, /replaced/); assert.match(review.message, /seats:org-1:sub_1:3:i/)
  assert.equal(describeSeatRecovery({ subscription, pending: { kind: 'seats', seats: 3, operation } }).kind, 'review')
})
