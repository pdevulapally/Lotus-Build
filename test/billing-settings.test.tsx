import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackendClient, billingSubscriptionSchema, accountSchema } from '../lib/backend/client'
import { subscriptionPrice, subscriptionStatus } from '../lib/billing/format'
import { SubscriptionSummary } from '../components/settings/billing-panel'

const subscription = billingSubscriptionSchema.parse({ subscription: {
  planKey: 'pro', planName: 'Pro', status: 'ACTIVE', stripeStatus: 'active',
  currentPeriodStart: '2026-10-20T00:00:00Z', currentPeriodEnd: '2026-11-20T00:00:00Z',
  cancelAtPeriodEnd: false, cancelAt: null, collectionPaused: false,
  price: { amountMinor: 1500, recurringSubtotalMinor: 3000, currency: 'gbp', interval: 'month', intervalCount: 3, quantity: 2, taxBehavior: 'inclusive' }, discountsApplied: true,
} }).subscription!
const account = accountSchema.parse({ uid: 'u', email: 'demo@example.test', emailVerified: true, projectCount: 2,
  plan: { key: 'free', name: 'Free' }, capabilities: [], limits: [], models: [],
})

test('billing summary is a private authenticated read, not a portal or checkout mutation', async () => {
  let calls = 0
  const controller = new AbortController()
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'account-token', fetch: async (url, init) => {
    calls++
    assert.equal(url, 'https://backend.example/billing/subscription')
    assert.equal(init?.method, 'GET'); assert.equal(init?.cache, 'no-store')
    assert.equal(init?.signal, controller.signal); assert.equal(init?.body, undefined)
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer account-token')
    return Response.json({ subscription })
  } })
  assert.deepEqual(await client.billingSubscription(controller.signal), { subscription })
  assert.equal(calls, 1)
})

test('missing subscription is distinct from a failed or malformed response', async () => {
  const create = (value: unknown, status = 200) => new BackendClient({ origin: 'https://backend.example', token: async () => 'token', fetch: async () => Response.json(value, { status }) })
  assert.deepEqual(await create({ subscription: null }).billingSubscription(), { subscription: null })
  await assert.rejects(create({ subscription: {} }).billingSubscription(), /unexpected response/)
  await assert.rejects(create({ error: { code: 'billing/unavailable', message: 'Stripe unavailable' } }, 502).billingSubscription(), /Stripe unavailable/)
})

test('actual quantity and interval determine price; no next invoice or due-now promise', () => {
  assert.equal(subscriptionPrice(subscription), '£30 every 3 months')
  assert.equal(subscriptionPrice({ ...subscription, price: { ...subscription.price, currency: 'jpy', recurringSubtotalMinor: 3000, intervalCount: 1 } }), 'JP¥3,000 per month')
  assert.equal(subscriptionStatus({ ...subscription, stripeStatus: 'unpaid' }), 'Unpaid')
  assert.equal(subscriptionStatus({ ...subscription, collectionPaused: true }), 'Payment collection paused')
  const html = renderToStaticMarkup(createElement(SubscriptionSummary, { account, summary: { subscription, loading: false, error: null } }))
  assert.match(html, /£30 every 3 months/); assert.match(html, /Billed subscription/)
  assert.match(html, /20 Nov 2026/); assert.match(html, /taxes, discounts, credits or prorations/)
  assert.match(html, /resets separately/); assert.doesNotMatch(html, /due now|next invoice|before taxes/i)
})

test('billing states preserve the portal fallback and never invent free subscription data', () => {
  const render = (summary: Parameters<typeof SubscriptionSummary>[0]['summary']) => renderToStaticMarkup(createElement(SubscriptionSummary, { account, summary }))
  assert.match(render({ subscription: null, loading: true, error: null }), /Loading subscription/)
  assert.match(render({ subscription: null, loading: false, error: null }), /No active paid subscription/)
  const unavailable = render({ subscription: null, loading: false, error: 'Unavailable' })
  assert.match(unavailable, /still open Stripe billing/); assert.doesNotMatch(unavailable, /No active|£0|\$0/)
  const cancelled = render({ subscription: { ...subscription, cancelAtPeriodEnd: true }, loading: false, error: null })
  assert.match(cancelled, /Scheduled cancellation/)
})

test('a delayed portal URL cannot redirect after sign-out or an account switch', async () => {
  const { openBillingPortal } = await import('../lib/billing/open-portal')
  for (const changed of [undefined, 'account-b']) {
    let uid: string | undefined = 'account-a'
    let resolve!: (value: { url: string }) => void
    let navigated = false
    const pending = openBillingPortal({ uid: 'account-a', currentUid: () => uid, isCurrent: () => true,
      create: () => new Promise((done) => { resolve = done }), navigate: () => { navigated = true } })
    uid = changed
    resolve({ url: 'https://billing.stripe.com/p/session_fixture' })
    await assert.rejects(pending, /account changed/)
    assert.equal(navigated, false)
  }
})

test('portal opens only for the still-current request and authenticated account', async () => {
  const { openBillingPortal } = await import('../lib/billing/open-portal')
  let created = 0, navigated = 0
  const options = { uid: 'a', currentUid: () => 'a', isCurrent: () => true,
    create: async () => { created++; return { url: 'https://billing.stripe.com/p/session_fixture' } }, navigate: () => { navigated++ } }
  await openBillingPortal(options)
  assert.equal(created, 1); assert.equal(navigated, 1)
  await openBillingPortal({ ...options, isCurrent: () => false })
  assert.equal(navigated, 1)
  await assert.rejects(openBillingPortal({ ...options, currentUid: () => 'b' }), /account changed/)
  assert.equal(created, 2)
})
