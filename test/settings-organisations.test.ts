import assert from 'node:assert/strict'
import test from 'node:test'
import { can, formatSeatPrice, formatSeatsTotal, minimumSeats, organisationWorkspaces } from '../lib/settings/organisations'
import { accountSchema } from '../lib/backend/client'

test('what each role may do matches the server rules', () => {
  assert.equal(can('owner', 'delete'), true)
  assert.equal(can('admin', 'delete'), false)
  assert.equal(can('admin', 'manageBilling'), false)
  assert.equal(can('admin', 'viewBilling'), true)
  assert.equal(can('member', 'invite'), false)
  assert.equal(can('member', 'leave'), true)
  assert.equal(can('owner', 'leave'), false)
})

test('seats never go below the members already present or the plan floor', () => {
  assert.equal(minimumSeats(2, 1), 2)
  assert.equal(minimumSeats(2, 5), 5)
})

test('per-seat prices read as a customer would say them', () => {
  const price = { amountMinor: 4000, currency: 'gbp', interval: 'month' }
  assert.equal(formatSeatPrice(price), '£40 per seat / month')
  assert.equal(formatSeatsTotal(price, 3), '£120 / month for 3 seats')
  assert.equal(formatSeatsTotal({ ...price, amountMinor: 4050 }, 1), '£40.50 / month for 1 seat')
})

test('servers before organisations still parse: no workspaces, plans per account', () => {
  const account = accountSchema.parse({ uid: 'u1', email: 'a@b.co', emailVerified: true, projectCount: 0, plan: { key: 'free', name: 'Free' }, capabilities: [], limits: [], models: [] })
  assert.deepEqual(account.workspaces, [])
  assert.deepEqual(organisationWorkspaces([{ id: 'u1', kind: 'personal', name: 'Personal', slug: null, role: 'owner' }, { id: 'o1', kind: 'organisation', name: 'Acme', slug: 'acme', role: 'admin' }]).map((w) => w.id), ['o1'])
})
