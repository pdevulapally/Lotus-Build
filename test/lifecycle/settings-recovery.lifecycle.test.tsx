import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider, useAuth, workspaceStorageKey } from '../../contexts/auth-context'
import { SettingsDialog, SettingsDialogProvider } from '../../components/settings/settings-dialog'
import { auth } from '../support/stubs/firebase'
import { backend, gate } from '../support/stubs/backend-browser'

/**
 * The real Settings dialog (AuthProvider, SettingsDialogProvider, SettingsDialog on the organisation's Plan & billing
 * page) under jsdom; only Firebase auth, Next navigation and the backend client are doubles.
 */
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
const continueLink = () => document.body.querySelector('a[target="_blank"]') as HTMLAnchorElement | null
const buttonNamed = (label: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
const click = async (label: string) => { const b = buttonNamed(label); assert.ok(b, `button "${label}" rendered`); await act(async () => { b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }) }
const openCheckout = { subscription: { planKey: 'teams', planName: 'Teams', status: 'ACTIVE', seats: 3, currentPeriodEnd: '2026-12-01T00:00:00.000Z', cancelAtPeriodEnd: false }, pending: { kind: 'checkout', seats: 3, url: 'https://checkout.test/cs_1', operation: { intent: 'i', stripeKey: 'k', generation: 1, placedAt: null } } }

/** React's `act` wraps render errors in an AggregateError whose message is empty; name the causes. */
const unwrap = (reason: unknown): never => { throw new Error(reason instanceof AggregateError ? reason.errors.map((e) => (e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 4).join('\n')}` : String(e))).join('\n---\n') : String(reason)) }
/** Reaches the provider's workspace switch, as the Settings switcher would. */
const controls: { switchWorkspace?: (id: string) => Promise<void> } = {}
function Probe() { const { switchWorkspace } = useAuth(); controls.switchWorkspace = switchWorkspace; return null }
const mount = async () => {
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  try { await act(async () => { root = createRoot(container); root.render(createElement(AuthProvider, null, createElement(SettingsDialogProvider, null, createElement(Probe), createElement(SettingsDialog, { open: true, onOpenChange: () => undefined, initialPage: 'org-plan' })))) }) } catch (reason) { unwrap(reason) }
  await flush(); await flush()
  // The organisation pages exist once the organisation has loaded; open Plan & billing the way a person does.
  if (!text().includes('Finish pending change')) await click('Plan & billing')
  await flush()
  return { unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}
const reset = (uid = 'alice', org = 'org1') => { backend.reset(); window.localStorage.clear(); window.localStorage.setItem(workspaceStorageKey(uid), org); if (auth.currentUser) auth.signOut() }

test('click Finish pending change → the organisation reloads → the Continue payment link is there, clickable, for this organisation; a plain reload keeps it; an account switch removes it', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush(); await flush()
  assert.match(text(), /Finish pending change/)
  backend.reconcileAnswer = openCheckout
  await click('Finish pending change'); await flush()
  const reloadsBefore = backend.calls.filter((c) => c === 'organisation:org1').length
  backend.reconcileGate.open(); await flush(); await flush(); await flush()
  assert.ok(backend.calls.filter((c) => c === 'organisation:org1').length > reloadsBefore, 'the organisation was reloaded after reconciling')
  const link = continueLink()
  assert.ok(link, 'Continue payment link rendered after the reload'); assert.equal(link.href, 'https://checkout.test/cs_1'); assert.equal(link.rel, 'noopener noreferrer'); assert.match(link.textContent ?? '', /Continue payment/)
  assert.match(text(), /A payment for 3 seats is still open/)
  // Bob signs in: Alice's link is gone.
  await act(async () => { auth.signOut() }); await flush()
  await act(async () => { auth.signIn('bob') }); window.localStorage.setItem(workspaceStorageKey('bob'), 'org1'); await flush(); await flush()
  assert.equal(continueLink(), null, 'never shown under another account')
  await page.unmount()
})

test('resolved and review answers show the message with the check action and no link; no popup is opened', async () => {
  reset(); auth.signIn('alice')
  const opened: string[] = []; const original = window.open; window.open = ((url: string) => { opened.push(url); return null }) as typeof window.open
  const page = await mount(); await flush(); await flush()
  backend.reconcileAnswer = { subscription: openCheckout.subscription, pending: null }
  await click('Finish pending change'); backend.reconcileGate.open(); await flush(); await flush(); await flush()
  assert.match(text(), /Nothing is pending\. The plan has 3 seats\./); assert.equal(continueLink(), null); assert.match(text(), /Finish pending change/)
  backend.reconcileGate = gate()
  backend.reconcileAnswer = { subscription: openCheckout.subscription, pending: { kind: 'seats', seats: 3, review: 'key-expired', operation: { intent: 'i', stripeKey: 'seats:k', generation: 1, placedAt: null } } }
  await click('Finish pending change'); backend.reconcileGate.open(); await flush(); await flush(); await flush()
  assert.match(text(), /older than Stripe will honour/); assert.match(text(), /seats:k/); assert.equal(continueLink(), null)
  backend.reconcileGate = gate(); backend.reconcileAnswer = openCheckout
  await click('Finish pending change'); backend.reconcileGate.open(); await flush(); await flush(); await flush()
  assert.ok(continueLink()); assert.deepEqual(opened, [], 'no window.open: the link is the action')
  window.open = original
  await page.unmount()
})

test('switching organisation A → B: nothing of A is shown while B loads; B\'s late failure shows no seats; B\'s success shows B; a late A answer never lands under B', async () => {
  reset(); auth.signIn('alice')
  backend.billingGates.set('org1', gate()); backend.billingGates.set('org2', gate())
  const page = await mount(); await flush()
  backend.billingGates.get('org1')!.open(); await flush(); await flush()
  assert.match(text(), /3 paid seats|3 seats/, 'A (Acme) billing shown')
  backend.billingGates.set('org1', gate())                                    // A's next answer will be late
  await act(async () => { await controls.switchWorkspace!('org2') }); await flush()
  assert.doesNotMatch(text(), /3 paid seats|3 seats/, 'A\'s seats are not shown while B loads')
  assert.doesNotMatch(text(), /Finish pending change/, 'A\'s billing actions are not offered under B')
  backend.billingGates.get('org1')!.open(); await flush(); await flush()     // late A answer
  assert.doesNotMatch(text(), /3 paid seats|3 seats/, 'the late A answer does not land under B')
  backend.billingFailures.add('org2'); backend.billingGates.get('org2')!.open(); await flush(); await flush()
  assert.doesNotMatch(text(), /5 paid seats|5 seats|3 paid seats/, 'a failed B fetch shows no seats at all')
  await page.unmount()
})

test('switching A → B then B\'s billing succeeds: B\'s seats and actions appear, none of A\'s', async () => {
  reset(); auth.signIn('alice')
  backend.billingGates.set('org2', gate())
  const page = await mount(); await flush(); await flush()
  await act(async () => { await controls.switchWorkspace!('org2') }); await flush()
  assert.doesNotMatch(text(), /3 paid seats|3 seats/)
  backend.billingGates.get('org2')!.open(); await flush(); await flush()
  assert.match(text(), /5 paid seats|5 seats/); assert.doesNotMatch(text(), /3 paid seats/)
  assert.match(text(), /Finish pending change/)
  await page.unmount()
})
