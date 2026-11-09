import assert from 'node:assert/strict'
import test from 'node:test'
import '../support/app-url'
import { getSafeRedirectPath } from '../../lib/auth/redirect'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider, workspaceStorageKey } from '../../contexts/auth-context'
import AcceptInvitationPage from '../../app/invitations/accept/page'
import { SettingsDialogProvider } from '../../components/settings/settings-dialog'
import { auth } from '../support/stubs/firebase'
import { backend } from '../support/stubs/backend-browser'
import { navigation, setInvitationQuery } from '../support/stubs/next-navigation'
import { resetAcceptances } from '../../lib/organisations/accept-invitation'

/**
 * A signed-out person opens an invitation link. The real page's `ProtectedRoute` sends them to sign in; what the
 * login page will do with that destination is the real `getSafeRedirectPath`; after signing in the same page
 * accepts and switches. Firebase auth, Next navigation and the backend client are the doubles.
 */
const invite = `/invitations/accept?organisation=org1&token=${'a'.repeat(43)}`
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) }) }
const text = () => document.body.textContent ?? ''
const mount = async () => {
  const container = document.body.appendChild(document.createElement('div'))
  let root!: Root
  await act(async () => { root = createRoot(container); root.render(createElement(AuthProvider, null, createElement(SettingsDialogProvider, null, createElement(AcceptInvitationPage)))) })
  return { unmount: async () => { await act(async () => root.unmount()); container.remove() } }
}
const reset = () => { backend.reset(); resetAcceptances(); navigation.pushes.length = 0; setInvitationQuery('org1', 'a'.repeat(43)); window.localStorage.clear(); if (auth.currentUser) auth.signOut(); window.history.replaceState(null, '', invite) }

test('signed out: the page sends the person to sign in with the invitation (organisation and token) kept in the destination; the sign-in redirect check keeps it whole and same-origin; after signing in the same page accepts and switches to the organisation', async () => {
  reset()
  const page = await mount(); await flush()
  assert.equal(navigation.pushes.length, 1, 'one redirect to sign in'); const [login] = navigation.pushes
  assert.ok(login!.startsWith('/login?redirect='), login)
  const carried = decodeURIComponent(login!.slice('/login?redirect='.length))
  assert.equal(carried, invite, 'the full invitation path and query travel with the redirect')
  assert.equal(getSafeRedirectPath(carried), invite, 'the login page will return exactly there: query intact, no origin')
  assert.deepEqual(backend.calls.filter((c) => c.startsWith('accept:')), [], 'nothing is accepted while signed out')
  // The login page's own behaviour after sign-in is `router.push(redirect)`: the person lands back on this page, signed in.
  await act(async () => { auth.signIn('alice') }); await flush(); await flush()
  assert.equal(backend.acceptGates.length, 1, 'the invitation is submitted once, for the signed-in account')
  backend.acceptGates[0]!.open(); await flush(); await flush(); await flush()
  assert.match(text(), /You’re in Acme/); assert.match(text(), /now your selected workspace/)
  assert.equal(window.localStorage.getItem(workspaceStorageKey('alice')), 'org1', 'the organisation is the selected workspace for the account that accepted')
  await page.unmount()
})

test('a tampered sign-in destination never leaves the app: other origins, protocol-relative, scheme, backslash and login loops all fall back to home; a benign invitation destination passes unchanged', () => {
  for (const hostile of ['https://evil.example' + invite, '//evil.example' + invite, 'javascript:alert(1)', '/\\evil.example', '/login?redirect=' + encodeURIComponent(invite), 'invitations/accept?organisation=org1']) {
    assert.equal(getSafeRedirectPath(hostile), '/', hostile)
  }
  assert.equal(getSafeRedirectPath(invite + '&utm=mail'), invite + '&utm=mail')
})

test('a withdrawn or expired invitation after sign-in: the server\'s refusal is shown, nothing is selected, and the token is not retried', async () => {
  reset(); backend.acceptFailures.add('a'.repeat(43))
  const page = await mount(); await flush()
  await act(async () => { auth.signIn('alice') }); await flush(); await flush()
  backend.acceptGates[0]!.open(); await flush(); await flush()
  assert.match(text(), /expired or been withdrawn/)
  assert.equal(window.localStorage.getItem(workspaceStorageKey('alice')), null); assert.equal(backend.acceptGates.length, 1)
  await page.unmount()
})
