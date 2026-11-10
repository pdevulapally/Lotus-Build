import assert from 'node:assert/strict'
import test from 'node:test'
import { billingCreditsSchema, creditCheckoutSchema, creditExpiry, creditPrice, creditPurchaseMessage, creditPurchaseSchema, type CreditOffer } from '../lib/billing/credits'
import { clearCreditOperation, openCreditCheckout, readCreditOperation } from '../lib/billing/credits-checkout'

const offer: CreditOffer = { id: 'small', version: 'v1', credits: 1000, amountMinor: 1500, currency: 'usd', expirySeconds: null, pacingPolicy: 'respect' }
const purchaseId = 'a'.repeat(64)
const response = { purchaseId, url: 'https://checkout.stripe.com/c/pay/demo', expiresAt: Math.floor(Date.now() / 1000) + 3600 }
function storage() { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) }, removeItem: (k: string) => { values.delete(k) } } }
function options() { return { uid: 'a', offer, storage: storage(), currentUid: () => 'a', isCurrent: () => true, create: async () => response, navigate: (_url: string) => {}, randomKey: () => 'operation-key-0001' } }

test('credits contract rejects invented/malformed commercial terms and preserves disabled balances', () => {
  const value = { portalAvailable: false, pendingPurchaseId: null, purchasing: { enabled: false, reason: null }, wallet: { availableCredits: 0, reservedCredits: 2, bypassAvailableCredits: 0 }, offers: [] }
  assert.deepEqual(billingCreditsSchema.parse(value), value)
  assert.equal(billingCreditsSchema.parse({ ...value, wallet: null }).wallet, null)
  assert.equal(billingCreditsSchema.safeParse({ ...value, offers: [{ ...offer, currency: null }] }).success, false)
  assert.equal(billingCreditsSchema.safeParse({ ...value, offers: [{ ...offer, amountMinor: -1 }] }).success, false)
  assert.equal(creditCheckoutSchema.safeParse({ ...response, url: 'https://checkout.stripe.com.evil.test/pay' }).success, false)
  assert.equal(creditCheckoutSchema.safeParse({ ...response, url: 'javascript:alert(1)' }).success, false)
  assert.equal(creditCheckoutSchema.parse({ ...response, url: null }).url, null)
})
test('commercial copy respects currency precision, expiry and authoritative status', () => {
  assert.equal(creditPrice(offer), 'USD 15.00')
  assert.equal(creditPrice({ ...offer, currency: 'jpy' }), 'JPY 1,500')
  assert.equal(creditExpiry(null), 'Credits do not expire.')
  assert.equal(creditExpiry(172800), 'Credits expire 2 days after payment.')
  const purchase = creditPurchaseSchema.parse({ purchaseId, status: 'pending', credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt })
  assert.match(creditPurchaseMessage(purchase), /not confirmed/)
  assert.match(creditPurchaseMessage({ ...purchase, status: 'paid' }), /Payment confirmed/)
})
test('uncertain retry preserves operation key across remount and scopes it to exact UID', async () => {
  const config = options(); const keys: string[] = []
  await assert.rejects(openCreditCheckout({ ...config, create: async (_input, key) => { keys.push(key); throw new Error('network lost') } }), /network lost/)
  assert.equal(readCreditOperation(config.storage, 'b'), null)
  await openCreditCheckout({ ...config, randomKey: () => 'a-different-key-0001', create: async (_input, key) => { keys.push(key); return response } })
  assert.deepEqual(keys, ['operation-key-0001', 'operation-key-0001'])
  assert.equal(readCreditOperation(config.storage, 'a')?.purchaseId, purchaseId)
  await assert.rejects(openCreditCheckout({ ...config, offer: { ...offer, version: 'v2' } }), /earlier checkout/)
  clearCreditOperation(config.storage, 'a', 'b'.repeat(64))
  assert.ok(readCreditOperation(config.storage, 'a'))
  clearCreditOperation(config.storage, 'a', purchaseId)
  assert.equal(readCreditOperation(config.storage, 'a'), null)
})
test('late checkout cannot navigate or leak URLs after account switch, sign-out or unmount', async () => {
  for (const next of ['b', undefined]) {
    let uid: string | undefined = 'a'; let navigated = false
    await assert.rejects(openCreditCheckout({ ...options(), currentUid: () => uid, create: async () => { uid = next; return response }, navigate: () => { navigated = true } }), /account or page changed/)
    assert.equal(navigated, false)
  }
  let active = true
  await assert.rejects(openCreditCheckout({ ...options(), isCurrent: () => active, create: async () => { active = false; return response } }), /account or page changed/)
})
test('null settled checkout and expired checkout never navigate; storage failures stop before POST', async () => {
  let called = false
  const config = options()
  assert.equal((await openCreditCheckout({ ...config, create: async () => ({ ...response, url: null }), navigate: () => { called = true } })).url, null)
  await assert.rejects(openCreditCheckout({ ...config, create: async () => ({ ...response, expiresAt: 1 }), navigate: () => { called = true } }), /expired/)
  assert.equal(called, false)
  await assert.rejects(openCreditCheckout({ ...options(), storage: { ...storage(), setItem: () => { throw new Error('Storage unavailable') } }, create: async () => { called = true; return response } }), /Storage unavailable/)
  assert.equal(called, false)
})

test('purchase errors including malformed callback IDs never hide owned wallet or portal state', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  const wallet = { portalAvailable: true, pendingPurchaseId: null, purchasing: { enabled: true, reason: null }, wallet: null, offers: [offer] }
  for (const failure of ['not found', 'malformed ID']) {
    const result = await readCreditsSnapshot({ readWallet: async () => wallet, readPurchase: () => { throw new Error(failure) }, readOperation: () => null, purchaseId: 'foreign-or-invalid' })
    assert.deepEqual(result.data, wallet)
    assert.equal(result.error, null)
    assert.match(result.purchaseError!, /Payment status could not be checked/)
    assert.equal(result.purchase, null)
  }
})
test('saved operation takes priority over stale callback, retired offers block only unresolved purchases', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  const config = { readWallet: async () => ({ portalAvailable: true, pendingPurchaseId: null, purchasing: { enabled: true, reason: null }, wallet: null, offers: [] }), readOperation: () => ({ key: 'operation-key-0001', offerId: offer.id, offerVersion: offer.version, purchaseId }), purchaseId: 'stale', readPurchase: async (id: string) => ({ purchaseId: id, status: 'pending' as const, credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt }) }
  const pending = await readCreditsSnapshot(config)
  assert.equal(pending.purchase?.purchaseId, purchaseId)
  assert.match(pending.checkoutBlockedReason!, /earlier payment/)
  const paid = await readCreditsSnapshot({ ...config, readPurchase: async id => ({ ...await config.readPurchase(id), status: 'paid' }) })
  assert.equal(paid.checkoutBlockedReason, null)
  const unknown = await readCreditsSnapshot({ ...config, readOperation: () => ({ key: 'operation-key-0001', offerId: offer.id, offerVersion: offer.version }), purchaseId: null })
  assert.match(unknown.checkoutBlockedReason!, /earlier checkout/)
})
test('storage failure does not hide balance and blocks a new payment; mismatched purchase response is rejected', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  const result = await readCreditsSnapshot({ readWallet: async () => ({ portalAvailable: true, pendingPurchaseId: null, purchasing: { enabled: false, reason: null }, wallet: null, offers: [] }), readOperation: () => { throw new Error('storage denied') }, purchaseId, readPurchase: async () => ({ purchaseId: 'b'.repeat(64), status: 'paid', credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt }) })
  assert.equal(result.data?.portalAvailable, true)
  assert.match(result.checkoutBlockedReason!, /browser storage/)
  assert.match(result.purchaseError!, /did not match/)
  assert.equal(result.purchase, null)
})

test('server active intent recovers without local storage and wallet is read after credit reconciliation', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  const order: string[] = []; let settled = false
  const result = await readCreditsSnapshot({
    readOperation: () => null,
    readWallet: async () => { order.push('wallet'); return { portalAvailable: true, pendingPurchaseId: settled ? null : purchaseId, purchasing: { enabled: true, reason: null }, wallet: { availableCredits: settled ? 1000 : 0, reservedCredits: 0, bypassAvailableCredits: 0 }, offers: [offer] } },
    readPurchase: async id => { order.push('reconcile'); assert.equal(id, purchaseId); settled = true; return { purchaseId, status: 'paid', credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt } },
  })
  assert.deepEqual(order, ['wallet', 'reconcile', 'wallet'])
  assert.equal(result.data?.wallet?.availableCredits, 1000)
  assert.equal(result.purchase?.status, 'paid')
  assert.equal(result.checkoutBlockedReason, null)
})
test('server pending intent and failed lookup block new checkout without hiding wallet', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  const config = { readOperation: () => null, readWallet: async () => ({ portalAvailable: true, pendingPurchaseId: purchaseId, purchasing: { enabled: true, reason: null }, wallet: { availableCredits: 20, reservedCredits: 0, bypassAvailableCredits: 0 }, offers: [offer] }) }
  for (const fail of [false, true]) {
    const result = await readCreditsSnapshot({ ...config, readPurchase: async () => { if (fail) throw new Error('unavailable'); return { purchaseId, status: 'pending', credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt } } })
    assert.equal(result.data?.wallet?.availableCredits, 20)
    assert.ok(result.checkoutBlockedReason)
  }
})
test('failed wallet reread never pairs confirmed payment with a stale balance', async () => {
  const { readCreditsSnapshot } = await import('../lib/billing/credits-read')
  let reads = 0
  const result = await readCreditsSnapshot({ readOperation: () => null, purchaseId,
    readWallet: async () => { if (reads++) throw new Error('refresh failed'); return { portalAvailable: true, pendingPurchaseId: purchaseId, purchasing: { enabled: false, reason: null }, wallet: { availableCredits: 0, reservedCredits: 0, bypassAvailableCredits: 0 }, offers: [] } },
    readPurchase: async () => ({ purchaseId, status: 'paid', credits: 1000, revokedCredits: 0, expiresAt: response.expiresAt }),
  })
  assert.equal(result.purchase?.status, 'paid'); assert.equal(result.data, null); assert.equal(result.error, 'refresh failed')
})
test('Stripe charge display uses provider units rather than ISO presentation precision', () => {
  assert.equal(creditPrice({ ...offer, currency: 'isk', amountMinor: 500 }), 'ISK 5')
  assert.equal(creditPrice({ ...offer, currency: 'ugx', amountMinor: 500 }), 'UGX 5')
  assert.equal(creditPrice({ ...offer, currency: 'mga', amountMinor: 500 }), 'MGA 500')
  assert.equal(creditPrice({ ...offer, currency: 'huf', amountMinor: 1045 }), 'HUF 10.45')
  assert.equal(creditPrice({ ...offer, currency: 'twd', amountMinor: 1045 }), 'TWD 10.45')
  assert.equal(billingCreditsSchema.safeParse({ portalAvailable: true, pendingPurchaseId: null, purchasing: { enabled: false, reason: null }, wallet: { availableCredits: 0.5, reservedCredits: 0, bypassAvailableCredits: 0 }, offers: [] }).success, false)
})

test('all five Stripe three-decimal charge currencies display their true minor-unit amounts', () => {
  for (const currency of ['bhd', 'jod', 'kwd', 'omr', 'tnd']) assert.equal(creditPrice({ ...offer, currency, amountMinor: 5010 }), `${currency.toUpperCase()} 5.010`)
})
test('explicit previous-checkout recovery uses saved identity and never invents a new key', async () => {
  const config = options()
  let calls = 0
  await assert.rejects(openCreditCheckout({ ...config, requireExisting: true, create: async () => { calls++; return response } }), /saved checkout is unavailable/)
  assert.equal(calls, 0)
  await assert.rejects(openCreditCheckout({ ...config, create: async () => { throw new Error('network lost') } }))
  await openCreditCheckout({ ...config, requireExisting: true, create: async (_input, key) => { calls++; assert.equal(key, 'operation-key-0001'); return { ...response, url: null } } })
  assert.equal(calls, 1)
  assert.equal(readCreditOperation(config.storage, 'a')?.purchaseId, purchaseId)
})

test('definite purchase-pending rejection clears only the attempted unbound key, uncertain errors retain it', async () => {
  const config = options()
  const rejected = Object.assign(new Error('other purchase pending'), { code: 'credits/purchase-pending', status: 409, details: { purchaseId } })
  await assert.rejects(openCreditCheckout({ ...config, create: async () => { throw rejected } }), /other purchase pending/)
  assert.equal(readCreditOperation(config.storage, 'a'), null)
  await assert.rejects(openCreditCheckout({ ...config, create: async () => { throw Object.assign(new Error('server unavailable'), { code: 'credits/unavailable', status: 503 }) } }))
  assert.equal(readCreditOperation(config.storage, 'a')?.key, 'operation-key-0001')
  await openCreditCheckout({ ...config, create: async () => ({ ...response, url: null }) })
  await assert.rejects(openCreditCheckout({ ...config, create: async () => { throw rejected } }))
  assert.equal(readCreditOperation(config.storage, 'a')?.purchaseId, purchaseId)
})
