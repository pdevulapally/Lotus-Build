import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider } from '../../contexts/auth-context'
import AcceptInvitationPage from '../../app/invitations/accept/page'
import { auth } from '../support/stubs/firebase'
import { backend } from '../support/stubs/backend-browser'
import { navigation } from '../support/stubs/next-navigation'
import { workspaceStorageKey } from '../../contexts/auth-context'

/**
 * The real `AuthProvider` and the real invitation page (through its `ProtectedRoute`), mounted with React DOM in a
 * jsdom document; only Firebase Auth, Next navigation and the backend client are doubles the test drives.
 */
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
const mount = async () => {
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  await act(async () => { root = createRoot(container); root.render(createElement(AuthProvider, null, createElement(AcceptInvitationPage))) })
  return { root, container, unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}
const storedWorkspace = (uid: string) => window.localStorage.getItem(workspaceStorageKey(uid))
const reset = () => { backend.reset(); navigation.pushes.length = 0; window.localStorage.clear(); if (auth.currentUser) auth.signOut() }

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
