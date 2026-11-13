import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreditsPanel } from '../components/settings/credits-panel'
import { CreditBalance } from '../components/billing/credit-balance'
import { billingCreditsSchema } from '../lib/billing/credits'
import type { CreditsController } from '../hooks/use-credits'

const initial: CreditsController = { data: null, purchase: null, loading: false, unavailable: false, busy: false, error: null, purchaseError: null, checkoutBlockedReason: null, canRecoverCheckout: false, recoverCheckout: async () => {}, refresh: async () => {}, checkout: async () => {} }
const data = { portalAvailable: false, pendingPurchaseId: null, purchasing: { enabled: true, reason: null }, wallet: { availableCredits: 12, reservedCredits: 3, bypassAvailableCredits: 0 }, offers: [{ id: 'small', version: 'v1', credits: 500, amountMinor: 1000, currency: 'usd', expirySeconds: null, pacingPolicy: 'respect' as const }] }
const render = (state: Partial<CreditsController>) => renderToStaticMarkup(createElement(CreditsPanel, { credits: { ...initial, ...state } }))

test('purchase UI uses friendly states and shows a verified route back to the task', () => {
  const html = render({ data, error: 'SECRET_STACK_TRACE', purchaseError: 'INTERNAL_PAYMENT_ID', purchase: {
    purchaseId: 'a'.repeat(64), status: 'paid', credits: 500, revokedCredits: 0, expiresAt: 2000000000,
    continuation: { sessionId: 'saved-task', status: 'queued' },
  } })
  assert.doesNotMatch(html, /SECRET_STACK_TRACE|INTERNAL_PAYMENT_ID/)
  assert.match(html, /Try again/)
  assert.match(html, /Your task is continuing/)
  assert.match(html, /View task/)
  assert.match(html, /\/computer\/saved-task/)
})

test('credits panel exposes commercial terms before an explicitly selected checkout', () => {
  const html = render({ data })
  assert.match(html, /500 credits/)
  assert.match(html, /USD.*10.00/)
  assert.match(html, /Credits never expire/)
  assert.match(html, /The daily usage limit still applies/)
  assert.match(html, /not an automatic top-up/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Continue to checkout/)
  assert.doesNotMatch(html, /checked=""/)
  assert.match(html, /astryx-radio-list/)
  assert.match(html, /astryx-button/)
})
test('credits panel distinguishes unknown wallet, loading, errors and configured disabled sales', () => {
  assert.match(render({ loading: true }), /Loading on-demand usage/)
  assert.match(render({ error: 'Request failed' }), /role="alert"/)
  const unknown = render({ data: { ...data, wallet: null, purchasing: { enabled: false, reason: 'Not available for your plan.' }, offers: [] } })
  assert.match(unknown, /Credit balance is unavailable/)
  assert.match(unknown, /temporarily unavailable/)
  assert.doesNotMatch(unknown, /Not available for your plan/)
  assert.doesNotMatch(unknown, />0</)
  assert.doesNotMatch(unknown, /Continue to checkout/)
  const disabled = render({ data: { ...data, purchasing: { enabled: false, reason: null }, offers: [] } })
  assert.match(disabled, />12</)
  assert.match(disabled, /temporarily unavailable/)
})

test('return purchase states distinguish pending from verified paid and disclose bypass limits', () => {
  const purchase = { purchaseId: 'a'.repeat(64), credits: 500, revokedCredits: 0, expiresAt: 2000000000, status: 'pending' as const }
  assert.match(render({ data, purchase }), /Payment is not confirmed yet/)
  assert.doesNotMatch(render({ data, purchase }), /Payment confirmed for/)
  assert.match(render({ data, purchase: { ...purchase, status: 'paid' } }), /Payment confirmed for 500 credits/)
  assert.match(render({ data: { ...data, offers: [{ ...data.offers[0], pacingPolicy: 'bypass_paid', expirySeconds: null }] } }), /Paid credits can cover usage beyond the daily allowance. Other limits still apply/)
})

test('missing credits service offers a retry without invented balances or purchase controls', () => {
  const html = render({ unavailable: true })
  assert.match(html, /Top-ups couldn’t be loaded/)
  assert.match(html, /Try again/)
  assert.doesNotMatch(html, /Continue to checkout|Resume previous checkout|Available credits|>0<|role="alert"/)
})

test('top-up content stays compact with one balance and no nested credit cards', () => {
  const html = render({ data })
  assert.equal((html.match(/Available credits/g) ?? []).length, 1)
  assert.match(html, /3 in progress/)
  assert.doesNotMatch(html, /astryx-card|View credit options|<h3[^>]*>Credits<\/h3>/)
  const disabled = render({ data: { ...data, purchasing: { enabled: false, reason: null }, offers: [] } })
  assert.match(disabled, /Top-ups are temporarily unavailable/)
  assert.match(disabled, /Try again/)
  assert.doesNotMatch(disabled, /Continue to checkout/)
})


test('credit packs disclose no expiry once before checkout', () => {
  const parsed = billingCreditsSchema.parse(data)
  const html = render({ data: parsed })
  assert.equal((html.match(/Credits never expire/g) ?? []).length, 1)
  assert.doesNotMatch(html, /calendar months|Credits expire|days after payment/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Continue to checkout/)
})

test('pack choices show server prices and share their usage terms once', () => {
  const html = render({ data: { ...data, offers: [data.offers[0], { ...data.offers[0], id: 'large', credits: 1500, amountMinor: 2500 }] } })
  assert.match(html, /500 credits/)
  assert.match(html, /1,500 credits/)
  assert.match(html, /USD.*25.00/)
  assert.equal((html.match(/The daily usage limit still applies/g) ?? []).length, 1)
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2)
  assert.doesNotMatch(html, /checked=""/)
})

test('usage and billing expose an eligible Buy credits entry point without inventing unknown balances', () => {
  const balance = (state: Partial<CreditsController>) => renderToStaticMarkup(createElement(CreditBalance, { credits: { ...initial, ...state } }))
  const enabled = balance({ data })
  assert.match(enabled, /Buy credits/)
  assert.match(enabled, /href="\/account\/billing#on-demand"/)
  assert.match(enabled, />12</)
  assert.match(enabled, />3 reserved for work in progress</)
  const unknown = balance({ data: { ...data, wallet: null, purchasing: { enabled: false, reason: 'Not available.' }, offers: [] } })
  assert.match(unknown, /Credit balance is unavailable/)
  assert.match(unknown, /View credit options/)
  assert.doesNotMatch(unknown, /Buy credits|>0</)
  const loading = balance({ loading: true })
  assert.match(loading, /Loading credit balance/)
  assert.doesNotMatch(loading, />0</)
})


test('custom amount option is driven by server configuration alongside preset packs', () => {
  const customTopUp={id:'custom',version:'v1',currency:'gbp',minAmountMinor:500,maxAmountMinor:50000,stepAmountMinor:100,creditsPerStep:100000,pacingPolicy:'bypass_paid' as const};
  const html=render({data:{...data,customTopUp}});
  assert.match(html,/Custom amount/);
  assert.match(html,/Choose how much to add/);
  assert.doesNotMatch(render({data}),/Custom amount/);
  assert.match(html,/Credits never expire/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Continue to checkout/);
});
