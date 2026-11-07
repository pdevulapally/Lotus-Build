import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DeliveryCard } from '../components/computer/delivery-card'
import { applyDeliveryEvent, deliverySchema, type Delivery } from '../lib/backend/delivery'
import type { BackendSession } from '../lib/backend/client'

const delivery: Delivery = {
  id: 'delivery-1', provider: 'github', repository: 'octo/app', title: 'Add autonomous delivery monitoring',
  branch: 'lotusbuild/delivery-monitor', baseBranch: 'main', pullRequestNumber: 12,
  pullRequestUrl: 'https://github.com/octo/app/pull/12', headSha: 'a'.repeat(40),
  status: 'CHECKS_PENDING', checksPassed: 2, checksTotal: 3, failedChecks: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

test('delivery card is one calm conversation surface with customer-facing status and links', () => {
  const html = renderToStaticMarkup(<DeliveryCard delivery={delivery} />)
  assert.match(html, /Checks are running/)
  assert.match(html, /2\/3 passed/)
  assert.match(html, /#12/)
  assert.match(html, /Add autonomous delivery monitoring/)
  assert.match(html, /main ← lotusbuild\/delivery-monitor/)
  assert.match(html, /octo\/app/)
  assert.match(html, /href="https:\/\/github.com\/octo\/app\/pull\/12"/)
  assert.doesNotMatch(html, /worker|lease|poll|SHA/)
})

test('failure detail stays compact until expanded and live deployment gets its verified link', () => {
  const failed = renderToStaticMarkup(<DeliveryCard delivery={{ ...delivery, status: 'REPAIRING', failedChecks: ['Typecheck', 'Unit tests'] }} />)
  assert.match(failed, /fixing a failed check/i)
  assert.match(failed, /2 failed/)
  assert.doesNotMatch(failed, /Typecheck/)

  const live = renderToStaticMarkup(<DeliveryCard delivery={{
    ...delivery, status: 'LIVE', checksPassed: 3, environmentUrl: 'https://app.example.test',
  }} />)
  assert.match(live, />Live</)
  assert.match(live, /merged revision is live/)
  assert.match(live, /href="https:\/\/app.example.test"/)
})

test('delivery event updates whole state and rejects stale or malformed updates', () => {
  const session = { id: 's1', delivery } as unknown as BackendSession
  const newer = { ...delivery, status: 'READY_TO_MERGE' as const, updatedAt: '2026-01-01T00:01:00.000Z' }
  assert.equal(applyDeliveryEvent(session, { type: 'delivery.updated', data: { delivery: newer } })?.delivery?.status, 'READY_TO_MERGE')
  assert.equal(applyDeliveryEvent({ ...session, delivery: newer }, { type: 'delivery.updated', data: { delivery } })?.delivery, newer)
  assert.equal(applyDeliveryEvent(session, { type: 'delivery.updated', data: { delivery: { bogus: true } } }), session)
})

test('delivery contract refuses unsafe or invented provider state', () => {
  assert.equal(deliverySchema.safeParse({ ...delivery, pullRequestUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(deliverySchema.safeParse({ ...delivery, status: 'MAYBE_LIVE' }).success, false)
  assert.equal(deliverySchema.safeParse({ ...delivery, failedChecks: Array.from({ length: 21 }, (_, index) => `check-${index}`) }).success, false)
})
