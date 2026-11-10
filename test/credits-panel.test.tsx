import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreditsPanel } from '../components/settings/credits-panel'
import type { CreditsController } from '../hooks/use-credits'

const initial: CreditsController = { data: null, purchase: null, loading: false, unavailable: false, busy: false, error: null, purchaseError: null, checkoutBlockedReason: null, canRecoverCheckout: false, recoverCheckout: async () => {}, refresh: async () => {}, checkout: async () => {} }
const data = { portalAvailable: false, pendingPurchaseId: null, purchasing: { enabled: true, reason: null }, wallet: { availableCredits: 12, reservedCredits: 3, bypassAvailableCredits: 0 }, offers: [{ id: 'small', version: 'v1', credits: 500, amountMinor: 1000, currency: 'usd', expirySeconds: 86400, pacingPolicy: 'respect' as const }] }
const render = (state: Partial<CreditsController>) => renderToStaticMarkup(createElement(CreditsPanel, { credits: { ...initial, ...state } }))

test('credits panel exposes commercial terms before an explicitly selected checkout', () => {
  const html = render({ data })
  assert.match(html, /500 credits/)
  assert.match(html, /USD.*10.00/)
  assert.match(html, /expire 1 day after payment/)
  assert.match(html, /The daily usage limit still applies/)
  assert.match(html, /not an automatic top-up/)
  assert.match(html, /disabled=""[^>]*>Continue to checkout/)
  assert.doesNotMatch(html, /checked=""/)
  assert.match(html, /min-h-11/)
  assert.match(html, /rounded-full/)
})
test('credits panel distinguishes unknown wallet, loading, errors and configured disabled sales', () => {
  assert.match(render({ loading: true }), /Loading on-demand usage/)
  assert.match(render({ error: 'Request failed' }), /role="alert"/)
  const unknown = render({ data: { ...data, wallet: null, purchasing: { enabled: false, reason: 'Not available for your plan.' }, offers: [] } })
  assert.match(unknown, /Credit balance is unavailable/)
  assert.match(unknown, /Not available for your plan/)
  assert.doesNotMatch(unknown, />0</)
  assert.doesNotMatch(unknown, /Continue to checkout/)
  const disabled = render({ data: { ...data, purchasing: { enabled: false, reason: null }, offers: [] } })
  assert.match(disabled, />12</)
  assert.match(disabled, /Top-ups are not available/)
})

test('return purchase states distinguish pending from verified paid and disclose bypass limits', () => {
  const purchase = { purchaseId: 'a'.repeat(64), credits: 500, revokedCredits: 0, expiresAt: 2000000000, status: 'pending' as const }
  assert.match(render({ data, purchase }), /Payment is not confirmed yet/)
  assert.doesNotMatch(render({ data, purchase }), /Payment confirmed for/)
  assert.match(render({ data, purchase: { ...purchase, status: 'paid' } }), /Payment confirmed for 500 credits/)
  assert.match(render({ data: { ...data, offers: [{ ...data.offers[0], pacingPolicy: 'bypass_paid', expirySeconds: null }] } }), /Credits do not expire.*Paid credits can cover usage beyond the daily allowance. Other limits still apply/)
})

test('undeployed credits service shows a clear unavailable state without invented balances or purchase controls', () => {
  const html = render({ unavailable: true })
  assert.match(html, /On-demand usage is not available yet/)
  assert.doesNotMatch(html, /Continue to checkout|Resume previous checkout|Available credits|>0<|role="alert"/)
})
