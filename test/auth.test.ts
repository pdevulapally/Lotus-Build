import assert from 'node:assert/strict'
import test from 'node:test'
import { authErrorMessage } from '../lib/auth/errors'

test('auth UI distinguishes provider configuration failures without exposing raw error data', () => {
  const sensitiveMessage = 'email=private@example.test token=private-token apiKey=private-key'
  for (const code of ['auth/invalid-api-key', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/popup-blocked', 'auth/network-request-failed']) {
    const message = authErrorMessage({ code, message: sensitiveMessage })
    assert.ok(message.includes(code))
    assert.ok(!message.includes('private'))
    assert.ok(!message.includes('password is incorrect'))
  }
  for (const code of ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential']) {
    assert.equal(authErrorMessage({ code }), 'The email or password is incorrect. Check your details and try again.')
  }
  assert.equal(authErrorMessage(new Error(sensitiveMessage)), 'Could not sign in. Try again or contact support.')
  assert.equal(authErrorMessage({ code: sensitiveMessage }), 'Could not sign in. Try again or contact support.')
  assert.equal(authErrorMessage({ code: 'auth/user-not-found' }, 'reset'), 'Could not send a reset link. Try again or contact support.')
  assert.equal(authErrorMessage(null, 'sign-up'), 'Could not create your account. Try again or contact support.')
})


test('authentication redirects reject external destinations and sign-in loops', async () => {
  process.env.NEXT_PUBLIC_APP_URL ??= 'https://lotus.example'
  const { getSafeRedirectPath } = await import('../lib/auth/redirect')
  const fallback = '/tasks'
  for (const value of [undefined, null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/login', '/login?redirect=//evil.test', '/signup', '/signup?x=y']) {
    assert.equal(getSafeRedirectPath(value, fallback), fallback, String(value))
  }
  assert.equal(getSafeRedirectPath('/tasks?session=task_1#conversation', fallback), '/tasks?session=task_1#conversation')
  assert.equal(getSafeRedirectPath('/settings', fallback), '/settings')
})
