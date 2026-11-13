import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackendClient, billingSubscriptionSchema, accountSchema } from '../lib/backend/client'
import { subscriptionPrice, subscriptionStatus } from '../lib/billing/format'
import { BillingPanel, SubscriptionSummary } from '../components/settings/billing-panel'
import { BillingPortalAction, PaymentManagement } from '../components/billing/payment-management'

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

test('subscription prices use Stripe charge units for special and three-decimal currencies', () => {
  assert.match(subscriptionPrice({ ...subscription, price: { ...subscription.price, currency: 'isk', recurringSubtotalMinor: 500 } }), /5 every 3 months/)
  assert.match(subscriptionPrice({ ...subscription, price: { ...subscription.price, currency: 'ugx', recurringSubtotalMinor: 500 } }), /5 every 3 months/)
  assert.match(subscriptionPrice({ ...subscription, price: { ...subscription.price, currency: 'kwd', recurringSubtotalMinor: 5123 } }), /5\.123 every 3 months/)
})

test('subscription price details expose server tax and discount information without inventing invoice amounts', () => {
  for (const [taxBehavior, label] of [
    ['inclusive', 'Included in the base price'],
    ['exclusive', 'Added to the base price'],
    ['unspecified', 'See your invoice for tax details'],
  ] as const) {
    const html = renderToStaticMarkup(createElement(SubscriptionSummary, { account, summary: {
      subscription: { ...subscription, price: { ...subscription.price, taxBehavior } }, loading: false, error: null,
    } }))
    assert.ok(html.includes(label))
    assert.match(html, /Price details/)
    assert.match(html, /GBP/)
    assert.match(html, /Applied; see invoice for amounts/)
    assert.doesNotMatch(html, /next invoice|due now/i)
  }
})

test('payment management distinguishes absent billing customers from loading and unknown eligibility', () => {
  const portal = { available: true, loading: false, busy: false, onOpen: () => {} }
  const absent = renderToStaticMarkup(createElement(BillingPortalAction, { ...portal, available: false }))
  assert.match(absent, /do not have a Stripe billing account/)
  assert.doesNotMatch(absent, /<button/)
  const loading = renderToStaticMarkup(createElement(BillingPortalAction, { ...portal, available: undefined, loading: true }))
  assert.match(loading, /disabled/)
  assert.doesNotMatch(loading, /do not have a Stripe billing account/)
  const available = renderToStaticMarkup(createElement(PaymentManagement, { portal, noSubscription: false }))
  assert.match(available, /<h3[^>]*>Payment<\/h3>/)
  assert.match(available, /<h3[^>]*>Invoices<\/h3>/)
  assert.match(available, /View available invoices/)
  assert.match(available, /Opening billing does not change your plan/)
  assert.doesNotMatch(available, /no active paid subscription|No payment method/)
})

test('settings billing includes the full subscription, payment and credit experience without leaving the modal', () => {
  const credits: Parameters<typeof BillingPanel>[0]['credits'] = {
    data: null, purchase: null, loading: false, unavailable: false, busy: false, error: null,
    purchaseError: null, checkoutBlockedReason: null, awaitingPayment: false, canRecoverCheckout: false,
    recoverCheckout: async () => {}, refresh: async () => {}, checkout: async () => {},
  }
  const html = renderToStaticMarkup(createElement(BillingPanel, {
    account, summary: { subscription, loading: false, error: null }, credits,
    portal: { available: true, loading: false, busy: false, onOpen: () => {} },
    onOpenCredits: () => {}, onClose: () => {},
  }))
  assert.match(html, /Free plan/)
  assert.match(html, /<h3[^>]*>Payment<\/h3>/)
  assert.match(html, /<h3[^>]*>Invoices<\/h3>/)
  assert.match(html, /plan changes or cancellation/)
  assert.match(html, /Adjust plan/)
  assert.match(html, /Manage payments/)
  assert.match(html, /View invoices/)
  assert.match(html, /Available credits/)
  assert.match(html, /View credit options/)
  assert.doesNotMatch(html, /href="\/account\/billing/)
  assert.doesNotMatch(html, /Mastercard|4986|Download PDF|<table/)
})

test('closing settings invalidates a pending Stripe portal without redirecting', async () => {
  const { openBillingPortal } = await import('../lib/billing/open-portal')
  let open = true
  let resolve!: (value: { url: string }) => void
  let navigated = false
  const pending = openBillingPortal({ uid: 'a', currentUid: () => 'a', isCurrent: () => open,
    create: () => new Promise(done => { resolve = done }), navigate: () => { navigated = true },
  })
  open = false
  resolve({ url: 'https://billing.stripe.com/p/session_fixture' })
  await pending
  assert.equal(navigated, false)
})
