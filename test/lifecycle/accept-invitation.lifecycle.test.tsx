import assert from 'node:assert/strict'
import test from 'node:test'
import { StrictMode, act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider } from '../../contexts/auth-context'
import AcceptInvitationPage from '../../app/invitations/accept/page'
import { SettingsDialogProvider } from '../../components/settings/settings-dialog'
import { auth } from '../support/stubs/firebase'
import { backend } from '../support/stubs/backend-browser'
import { navigation, setInvitationQuery } from '../support/stubs/next-navigation'
import { resetAcceptances } from '../../lib/organisations/accept-invitation'
import { workspaceStorageKey } from '../../contexts/auth-context'

/**
 * The real `AuthProvider` and the real invitation page (through its `ProtectedRoute`), mounted with React DOM in a
 * jsdom document; only Firebase Auth, Next navigation and the backend client are doubles the test drives.
 */
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
const tree = () => createElement(AuthProvider, null, createElement(SettingsDialogProvider, null, createElement(AcceptInvitationPage)))
const mount = async (strict = false) => {
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  const render = async () => { await act(async () => { root.render(strict ? createElement(StrictMode, null, tree()) : tree()) }) }
  await act(async () => { root = createRoot(container) }); await render()
  return { root, container, rerender: render, unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}
const storedWorkspace = (uid: string) => window.localStorage.getItem(workspaceStorageKey(uid))
const reset = () => { backend.reset(); resetAcceptances(); navigation.pushes.length = 0; setInvitationQuery('org1', 'a'.repeat(43)); window.localStorage.clear(); if (auth.currentUser) auth.signOut() }

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
  setInvitationQuery('org1', 'a'.repeat(43)); await page.rerender(); await flush()
  assert.equal(backend.acceptGates.length, 2, 'returning to A does not submit the invitation again')
  assert.match(text(), /Acme/, 'A\'s recorded outcome is shown')
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
  await page.unmount()
})
