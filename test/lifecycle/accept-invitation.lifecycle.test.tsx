import assert from 'node:assert/strict'
import test from 'node:test'
import { StrictMode, act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider, useAuth } from '../../contexts/auth-context'
import AcceptInvitationPage from '../../app/invitations/accept/page'
import { SettingsDialogProvider } from '../../components/settings/settings-dialog'
import { auth } from '../support/stubs/firebase'
import { backend, gate } from '../support/stubs/backend-browser'
import { navigation, setInvitationQuery } from '../support/stubs/next-navigation'
import { resetAcceptances } from '../../lib/organisations/accept-invitation'
import { workspaceStorageKey } from '../../contexts/auth-context'

/**
 * The real `AuthProvider` and the real invitation page (through its `ProtectedRoute`), mounted with React DOM in a
 * jsdom document; only Firebase Auth, Next navigation and the backend client are doubles the test drives.
 */
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
/** Reaches the provider's workspace switch, as Settings or another tab would. */
const controls: { switchWorkspace?: (id: string) => Promise<void> } = {}
function Probe() { const { switchWorkspace } = useAuth(); controls.switchWorkspace = switchWorkspace; return null }
const tree = () => createElement(AuthProvider, null, createElement(SettingsDialogProvider, null, createElement(Probe), createElement(AcceptInvitationPage)))
/** A test that failed mid-way leaves its tree mounted; the next mount removes it so trees never share a document. */
const mounted: (() => Promise<void>)[] = []
const mount = async (strict = false) => {
  for (const leftover of mounted.splice(0)) await leftover()
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  const render = async () => { await act(async () => { root.render(strict ? createElement(StrictMode, null, tree()) : tree()) }) }
  await act(async () => { root = createRoot(container) }); await render()
  const unmount = async () => { await act(async () => root.unmount()); container.remove(); mounted.splice(mounted.indexOf(unmount), 1) }
  mounted.push(unmount)
  return { root, container, rerender: render, unmount }
}
const storedWorkspace = (uid: string) => window.localStorage.getItem(workspaceStorageKey(uid))
const unhandled: unknown[] = []
process.on('unhandledRejection', (reason) => { unhandled.push(reason) })
const openButton = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Open the organisation'))
const reset = () => { unhandled.length = 0; backend.reset(); resetAcceptances(); navigation.pushes.length = 0; setInvitationQuery('org1', 'a'.repeat(43)); window.localStorage.clear(); if (auth.currentUser) auth.signOut() }

test('normal acceptance: Alice signed in, the page accepts, refreshes her account and selects the organisation', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  assert.ok(backend.calls.includes('accept:org1:43'), backend.calls.join(','))
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.match(text(), /Acme/)
  assert.equal(storedWorkspace('alice'), 'org1', 'the organisation is selected for Alice')
  await page.unmount()
})

test('sign-out unmounts the page while Alice\'s acceptance is in flight, Bob signs in: the late completion selects, refreshes and reports nothing for Bob', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  assert.ok(backend.calls.includes('accept:org1:43'))
  await act(async () => { auth.signOut() }); await flush()   // ProtectedRoute unmounts the page's content on sign-out
  await act(async () => { auth.signIn('bob') }); await flush()
  // Bob's own page mounted its own attempt (second accept call); only Alice's first one resolves now.
  assert.equal(backend.acceptGates.length, 2, backend.calls.join(','))
  const callsBefore = backend.calls.length
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.equal(storedWorkspace('bob'), null, 'nothing selected for Bob by Alice\'s completion')
  assert.equal(storedWorkspace('alice'), null)
  assert.deepEqual(backend.calls.slice(callsBefore), [], 'no refresh was caused by the stale completion')
  assert.doesNotMatch(text(), /Acme/)
  // Bob's own acceptance then completes for Bob, under his principal.
  backend.acceptGates[1]!.open(); await flush(); await flush()
  assert.equal(storedWorkspace('bob'), 'org1')
  assert.match(text(), /Acme/)
  await page.unmount()
})

test('Alice signs out and back in during her acceptance: the same uid under a new epoch is not the principal that started, so the stale completion selects nothing for the new session', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  await act(async () => { auth.signOut() }); await flush()
  await act(async () => { auth.signIn('alice') }); await flush()
  // The new session mounts a fresh attempt of its own (second accept call); the first one's completion must not act.
  assert.equal(backend.acceptGates.length, 2, backend.calls.join(','))
  const callsBefore = backend.calls.length
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), null, 'the stale completion selected nothing')
  assert.deepEqual(backend.calls.slice(callsBefore), [])
  assert.doesNotMatch(text(), /Acme/)
  backend.acceptGates[1]!.open(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1', 'the new session\'s own acceptance completes')
  await page.unmount()
})

test('StrictMode replays the effect (setup → cleanup → setup): the invitation is still submitted once and the outcome is shown', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(true); await flush()
  assert.equal(backend.calls.filter((c) => c.startsWith('accept:')).length, 1, backend.calls.join(','))
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.match(text(), /Acme/)
  assert.equal(storedWorkspace('alice'), 'org1')
  await page.unmount()
})

test('a new invitation in the query while the first is in flight starts its own operation; the first one\'s completion no longer reports into the page, the second\'s does', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  assert.deepEqual(backend.calls.filter((c) => c.startsWith('accept:')), ['accept:org1:43'])
  setInvitationQuery('org1', 'b'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2, 'the changed invitation is submitted as its own operation')
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.doesNotMatch(text(), /Acme/, 'the detached first operation does not report into the page')
  backend.acceptGates[1]!.open(); await flush(); await flush()
  assert.match(text(), /Acme/)
  await page.unmount()
})

test('the page moves from invitation A (Acme) to invitation B (Beta); B completes first, then A late: the visible result is Beta and A\'s late completion does not switch the workspace back', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  assert.deepEqual(backend.calls.filter((c) => c.startsWith('accept:')), ['accept:org1:43'])
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2)
  const callsBefore = backend.calls.length
  backend.acceptGates[1]!.open(); await flush(); await flush()            // B (Beta) completes first
  assert.match(text(), /Beta/); assert.equal(storedWorkspace('alice'), 'org2')
  const afterB = backend.calls.length
  backend.acceptGates[0]!.open(); await flush(); await flush()            // A (Acme) completes late
  assert.equal(storedWorkspace('alice'), 'org2', 'the detached operation must not switch the workspace back to Acme')
  assert.match(text(), /Beta/); assert.doesNotMatch(text(), /Acme/)
  assert.deepEqual(backend.calls.slice(afterB), [], 'no refresh or other side effect from the late completion')
  assert.ok(backend.calls.slice(callsBefore, afterB).some((c) => c.startsWith('me:')), 'B\'s own completion did refresh')
  await page.unmount()
})

test('A completes while the page is on B (detached); returning to A shows A\'s result without submitting again — success', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2)
  backend.acceptGates[0]!.open(); await flush(); await flush()            // A settles while detached
  assert.equal(storedWorkspace('alice'), null, 'no side effect while detached')
  const callsBefore = backend.calls.length
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2, 'returning to A does not submit the invitation again')
  assert.match(text(), /Acme/, 'A\'s recorded outcome is shown')
  await flush()
  assert.equal(storedWorkspace('alice'), 'org1', 'the returning page ran the owed refresh and selected Acme — the workspace is A, not left on Personal/B')
  assert.ok(backend.calls.slice(callsBefore).some((c) => c.startsWith('me:')), 'the returning page refreshed the account')
  navigation.pushes.length = 0
  const open = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Open the organisation'))
  assert.ok(open, 'Open the organisation is offered')
  await act(async () => { open!.click() }); await flush()
  assert.deepEqual(navigation.pushes, ['/'], 'Open the organisation goes to the workspace')
  assert.equal(storedWorkspace('alice'), 'org1', 'with Acme selected')
  await page.unmount()
})

test('A fails while detached; returning to A shows the failure, not a spinner, and does not resubmit', async () => {
  reset(); auth.signIn('alice'); backend.acceptFailures.add('a'.repeat(43))
  const page = await mount(); await flush()
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush()
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2)
  assert.match(text(), /expired or been withdrawn/)
  assert.doesNotMatch(text(), /Checking your invitation/)
  assert.equal(storedWorkspace('alice'), null, 'a failure owes no selection')
  await page.unmount()
})

test('returning to A before its owed refresh has answered: the page says joined but Open the organisation is withheld (disabled, no navigation); it opens once the workspace is confirmed', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush()            // A settles while detached
  backend.meGate = gate()                                                  // the returning page's refresh is slow
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush()
  assert.match(text(), /You’re in Acme/); assert.match(text(), /Setting up the organisation/)
  const open = openButton(); assert.ok(open, 'the action is shown'); assert.equal(open.disabled, true, 'but withheld until the workspace is ready')
  navigation.pushes.length = 0
  await act(async () => { open.click() }); await flush()
  assert.deepEqual(navigation.pushes, [], 'clicking early navigates nowhere'); assert.equal(storedWorkspace('alice'), null, 'and selects nothing')
  backend.meGate.open(); backend.meGate = undefined; await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1'); assert.match(text(), /now your selected workspace/)
  assert.equal(openButton()!.disabled, false)
  await act(async () => { openButton()!.click() }); await flush()
  assert.deepEqual(navigation.pushes, ['/'])
  assert.equal(backend.acceptGates.length, 2, 'one submission throughout'); assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('the owed refresh fails: joined is shown with the failure and no way into a wrong workspace; Try again repeats only the refresh and selection, never the invitation', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush()
  backend.meFailures.add('alice')
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush(); await flush()
  assert.match(text(), /You’re in Acme/); assert.match(text(), /could not be opened as your workspace: Your account could not be loaded right now/)
  assert.equal(openButton(), undefined, 'no Open while the workspace is not ready'); assert.equal(storedWorkspace('alice'), null)
  const accepts = backend.calls.filter((c) => c.startsWith('accept:')).length
  const retry = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again')); assert.ok(retry)
  await act(async () => { retry.click() }); await flush(); await flush()
  assert.equal(backend.calls.filter((c) => c.startsWith('accept:')).length, accepts, 'the token is not sent again')
  assert.equal(storedWorkspace('alice'), 'org1', 'the retry made the workspace ready'); assert.match(text(), /now your selected workspace/)
  assert.equal(openButton()!.disabled, false); assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('the selection fails (the refreshed account does not list the organisation): told truthfully, nothing navigates, and Try again recovers once the membership is there', async () => {
  reset(); auth.signIn('alice'); backend.missingWorkspaces.add('org1')
  const page = await mount(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush(); await flush()
  assert.match(text(), /You’re in Acme/); assert.match(text(), /could not be opened as your workspace: That workspace is not available to this account/)
  assert.equal(openButton(), undefined); assert.equal(storedWorkspace('alice'), null); assert.deepEqual(navigation.pushes, [])
  backend.missingWorkspaces.clear()
  const retry = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again')); assert.ok(retry)
  await act(async () => { retry.click() }); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1'); assert.equal(backend.acceptGates.length, 1, 'one submission'); assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('A becomes ready, B becomes ready, back to A: readiness is confirmed again for A — Acme is selected, Open goes there — with one submission per invitation', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1'); assert.equal(openButton()!.disabled, false)
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender(); await flush()
  backend.acceptGates[1]!.open(); await flush(); await flush(); await flush()
  assert.match(text(), /You’re in Beta/); assert.equal(storedWorkspace('alice'), 'org2', 'Beta is selected now')
  const callsBefore = backend.calls.length
  backend.meGate = gate()                                                  // the return's refresh is slow: the cached A answer is visible before the confirmation lands
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush()
  assert.match(text(), /You’re in Acme/); assert.match(text(), /Setting up the organisation/)
  const early = openButton(); assert.ok(early); assert.equal(early.disabled, true, 'history is not readiness: Open is withheld until Acme is confirmed selected')
  assert.equal(storedWorkspace('alice'), 'org2', 'Beta stays selected until Acme is confirmed')
  navigation.pushes.length = 0; await act(async () => { early.click() }); await flush()
  assert.deepEqual(navigation.pushes, [], 'nothing navigates into Beta')
  backend.meGate.open(); backend.meGate = undefined; await flush(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1', 'returning to A re-selects Acme')
  assert.ok(backend.calls.slice(callsBefore).some((c) => c.startsWith('me:')), 'the return refreshed the account')
  assert.deepEqual(backend.calls.filter((c) => c.startsWith('accept:')), ['accept:org1:43', 'accept:org2:43'], 'each invitation was submitted exactly once')
  assert.equal(openButton()!.disabled, false)
  navigation.pushes.length = 0
  await act(async () => { openButton()!.click() }); await flush()
  assert.deepEqual(navigation.pushes, ['/']); assert.equal(storedWorkspace('alice'), 'org1', 'Open leads to Acme, not Beta')
  assert.deepEqual(unhandled, [])
  await page.unmount()
})

test('A is ready, the same page moves to a pending B: B shows pending at once — nothing of A is shown or clickable under B\'s URL — and B\'s own answer then takes over', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush(); await flush()
  assert.match(text(), /You’re in Acme/); assert.equal(openButton()!.disabled, false)
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender()
  assert.match(text(), /Checking your invitation/, 'B is pending from the first render under its URL')
  assert.doesNotMatch(text(), /Acme|Open the organisation/, 'A\'s result and action are not shown for B')
  assert.equal(openButton(), undefined, 'nothing to click early')
  await flush(); assert.equal(backend.acceptGates.length, 2, 'B is submitted once, A never again')
  backend.acceptGates[1]!.open(); await flush(); await flush(); await flush()
  assert.match(text(), /You’re in Beta/); assert.equal(storedWorkspace('alice'), 'org2'); assert.deepEqual(navigation.pushes, [])
  await page.unmount()
})

test('A failed, the same page moves to a pending B: the stale failure is not shown under B', async () => {
  reset(); auth.signIn('alice'); backend.acceptFailures.add('a'.repeat(43))
  const page = await mount(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.match(text(), /expired or been withdrawn/)
  setInvitationQuery('org2', 'b'.repeat(43)); await page.rerender()
  assert.match(text(), /Checking your invitation/); assert.doesNotMatch(text(), /expired or been withdrawn/)
  await page.unmount()
})

test('the selection moves elsewhere while the page stays open (Settings, another tab): the page says so truthfully, offers Switch to Acme, and switching back needs no resubmission', async () => {
  reset(); auth.signIn('alice')
  const page = await mount(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1'); assert.equal(openButton()!.disabled, false)
  await act(async () => { await controls.switchWorkspace!('org2') }); await flush()
  assert.match(text(), /your selected workspace is Beta now/); assert.equal(openButton(), undefined, 'Open is not offered for a workspace that is not selected')
  assert.doesNotMatch(text(), /Setting up the organisation/, 'not a stuck pending state')
  const back = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Switch to Acme')); assert.ok(back, 'an explicit way back is offered')
  await act(async () => { back.click() }); await flush(); await flush(); await flush()
  assert.equal(storedWorkspace('alice'), 'org1', 'switched back'); assert.equal(openButton()!.disabled, false); assert.match(text(), /now your selected workspace/)
  assert.equal(backend.acceptGates.length, 1, 'the token was never sent again'); assert.deepEqual(navigation.pushes, []); assert.deepEqual(unhandled, [])
  await page.unmount()
})
