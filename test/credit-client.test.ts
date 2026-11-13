import assert from 'node:assert/strict'
import test from 'node:test'
import { BackendClient } from '../lib/backend/client'

const id = 'a'.repeat(64)
const summary = { portalAvailable: false, pendingPurchaseId: null, purchasing: { enabled: false, reason: 'Not enabled' }, wallet: null, offers: [] }
const checkout = { purchaseId: id, url: 'https://checkout.stripe.com/c/pay/test', expiresAt: 1795000000 }
const purchase = { purchaseId: id, status: 'pending', credits: 1000, revokedCredits: 0, expiresAt: 1795000000 }

test('credit API uses authenticated current routes and stable operation header', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const client = new BackendClient({ origin: 'https://backend.example.test', token: async () => 'test-token', fetch: async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json(String(url).endsWith('/checkout') ? checkout : String(url).includes('/purchases/') ? purchase : summary)
  } })
  const signal = new AbortController().signal
  assert.deepEqual(await client.billingCredits(signal), summary)
  assert.deepEqual(await client.creditCheckout({ offerId: 'offer', offerVersion: 'v1' }, 'fixed-operation-key'), checkout)
  assert.deepEqual(await client.creditPurchase(id, signal), purchase)
  assert.deepEqual(calls.map(c => c.url), ['https://backend.example.test/billing/credits', 'https://backend.example.test/billing/credits/checkout', `https://backend.example.test/billing/credits/purchases/${id}`])
  assert.equal(calls[1].init?.method, 'POST')
  assert.equal(calls[1].init?.body, JSON.stringify({ offerId: 'offer', offerVersion: 'v1' }))
  assert.equal((calls[1].init?.headers as Record<string, string>)['Idempotency-Key'], 'fixed-operation-key')
  for (const call of calls) { assert.equal(call.init?.cache, 'no-store'); assert.equal((call.init?.headers as Record<string,string>).Authorization, 'Bearer test-token') }
})

test('credit input validation stops malformed identities before network or mutation', async () => {
  let calls = 0
  const client = new BackendClient({ origin: 'https://backend.example.test', token: async () => 'token', fetch: async () => { calls++; return Response.json(checkout) } })
  assert.throws(() => client.creditPurchase('../someone-else'))
  assert.throws(() => client.creditCheckout({ offerId: 'bad/path', offerVersion: 'v1' }, 'fixed-operation-key'))
  await assert.rejects(client.creditCheckout({ offerId: 'offer', offerVersion: 'v1' }, 'short'))
  assert.equal(calls, 0)
})
