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

test('finishing a pending change reloads the organisation (its billing lives with it), not the personal account, then presents the outcome; nothing after a principal change', async () => {
  const { finishPendingSeatChange } = await import('../lib/settings/organisations')
  const log: string[] = []
  const deps = (reconcile: () => Promise<Parameters<typeof describeSeatRecovery>[0]>, live = () => true) => ({ reconcile, reloadOrganisation: async () => { log.push('reloadOrganisation') }, live, present: (o: ReturnType<typeof describeSeatRecovery>) => { log.push(`present:${o.kind}:${'url' in o ? o.url : ''}`) } })
  await finishPendingSeatChange(deps(async () => { log.push('reconcile'); return { subscription, pending: null } }))
  assert.deepEqual(log, ['reconcile', 'reloadOrganisation', 'present:resolved:'])
  log.length = 0
  await finishPendingSeatChange(deps(async () => ({ subscription, pending: { kind: 'checkout', seats: 3, url: 'https://checkout.test/cs_1', operation } })))
  assert.deepEqual(log, ['reloadOrganisation', 'present:checkout:https://checkout.test/cs_1'])
  log.length = 0
  let alive = true
  await finishPendingSeatChange(deps(async () => { alive = false; return { subscription, pending: null } }, () => alive))
  assert.deepEqual(log, [], 'a principal change after the reconcile stops everything')
})

test('the stored outcome is shown only to the principal who asked, on that organisation: an account switch or a workspace change hides it', async () => {
  const { visibleRecovery } = await import('../lib/settings/organisations')
  const outcome = { kind: 'checkout' as const, message: 'A payment for 3 seats is still open.', url: 'https://checkout.test/cs_1' }
  const stored = { principal: 'alice#1', organisationId: 'org1', outcome }
  assert.equal(visibleRecovery(stored, 'alice#1', 'org1'), outcome)
  assert.equal(visibleRecovery(stored, 'bob#2', 'org1'), null, 'never under another account')
  assert.equal(visibleRecovery(stored, 'alice#2', 'org1'), null, 'nor the same account signed in again')
  assert.equal(visibleRecovery(stored, 'alice#1', 'org2'), null, 'nor on another organisation')
  assert.equal(visibleRecovery(null, 'alice#1', 'org1'), null)
})

test('an open payment renders as an explicit new-tab link the owner clicks (no popup to be blocked); resolved and review outcomes render as the message with the check action', async () => {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { OrganisationPlanPage } = await import('../components/settings/organisation/plan-page')
  const organisation = { id: 'org1', name: 'Acme', slug: 'acme', role: 'owner' as const, memberCount: 3, seats: 3, createdAt: '2026-01-01T00:00:00.000Z' }
  const billing = { subscription, memberCount: 3, plans: [] }
  const render = (recovery: Parameters<typeof OrganisationPlanPage>[0]['recovery']) => renderToStaticMarkup(createElement(OrganisationPlanPage, { organisation, billing, busy: false, onCheckout: () => undefined, onChangeSeats: () => undefined, onManageBilling: () => undefined, onReconcile: () => undefined, recovery }))
  const open = render({ kind: 'checkout', message: 'A payment for 3 seats is still open.', url: 'https://checkout.test/cs_1' })
  assert.match(open, /href="https:\/\/checkout.test\/cs_1"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Continue payment</)
  assert.match(open, /A payment for 3 seats is still open\./)
  const resolved = render({ kind: 'resolved', message: 'Nothing is pending. The plan has 3 seats.' })
  assert.doesNotMatch(resolved, /Continue payment/); assert.match(resolved, /Nothing is pending/); assert.match(resolved, /Finish pending change/)
  const review = render({ kind: 'review', message: 'The plan this change was made against has since been replaced, so it cannot be applied as it was. Support can resolve it with reference k.' })
  assert.doesNotMatch(review, /Continue payment/); assert.match(review, /replaced/)
  assert.doesNotMatch(render(null), /Continue payment/)
})
