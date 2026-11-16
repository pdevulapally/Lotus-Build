import assert from "node:assert/strict"
import test from "node:test"
import { requiresVerifiedEmail, verifiedEmailAccess } from "../lib/auth/verified-email-route"

test("public pages and signed-out visits do not require verified email", () => {
  for (const pathname of ["/", "/help", "/login", "/pricing", "/privacy", "/signup", "/terms", "/verify-email"]) {
    assert.equal(requiresVerifiedEmail(pathname, false), false, pathname)
  }
  for (const pathname of ["/help/article", "/pricing/plan", "/verify-email/step"]) {
    assert.equal(requiresVerifiedEmail(pathname, true), false, pathname)
  }
})

test("signed-in home and private workspaces require verified email", () => {
  assert.equal(requiresVerifiedEmail("/", true), true)
  for (const pathname of ["/computer/s1", "/project/p1", "/settings", "/welcome"]) {
    assert.equal(requiresVerifiedEmail(pathname, true), true, pathname)
  }
  assert.equal(requiresVerifiedEmail("/settings/account", true), true)
})

test('private pages stay closed while identity or the server account is unresolved', () => {
  for (const pathname of ['/', '/project/p1', '/computer/s1', '/settings']) {
    const input = { pathname, loading: true, userUid: null, account: null, accountError: null };
    assert.equal(verifiedEmailAccess(input), 'loading', pathname);
    assert.equal(verifiedEmailAccess({ ...input, loading: false, userUid: 'u' }), 'loading');
    assert.equal(verifiedEmailAccess({ ...input, loading: false, userUid: 'u', accountError: 'Network unavailable' }), 'error');
    assert.equal(verifiedEmailAccess({ ...input, loading: false, userUid: 'u', account: { uid: 'other', emailVerified: true } }), 'error');
  }
})

test('unverified password accounts must verify; already verified provider accounts proceed', () => {
  const input = { pathname: '/computer/s1', loading: false, userUid: 'u', accountError: null };
  assert.equal(verifiedEmailAccess({ ...input, account: { uid: 'u', emailVerified: false } }), 'verify');
  assert.equal(verifiedEmailAccess({ ...input, account: { uid: 'u', emailVerified: true } }), 'allow');
  assert.equal(verifiedEmailAccess({ ...input, account: { uid: 'u', emailVerified: true }, accountError: 'Account check failed' }), 'error');
})

test('verification and public pages remain available without a verified account', () => {
  for (const pathname of ['/verify-email', '/login', '/signup', '/help', '/privacy', '/terms']) {
    assert.equal(verifiedEmailAccess({ pathname, loading: true, userUid: null, account: null, accountError: null }), 'allow');
    assert.equal(verifiedEmailAccess({ pathname, loading: false, userUid: 'u', account: { uid: 'u', emailVerified: false }, accountError: null }), 'allow');
  }
})
