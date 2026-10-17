type AuthAction = 'sign-in' | 'sign-up' | 'reset'

const messages: Readonly<Record<string, string>> = {
  'auth/invalid-api-key': 'Sign-in is unavailable because this site has an invalid Firebase web configuration.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Sign-in is unavailable because this site has an invalid Firebase web configuration.',
  'auth/unauthorized-domain': 'This site address is not authorized for Firebase sign-in. The site owner must check the authorized domains.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this Firebase project.',
  'auth/configuration-not-found': 'Firebase authentication is not configured for this project.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow popups for this site and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before sign-in finished. Try again when ready.',
  'auth/cancelled-popup-request': 'Another sign-in attempt interrupted this one. Try again once.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
  'auth/too-many-requests': 'Firebase temporarily limited sign-in attempts. Wait before trying again.',
  'auth/user-disabled': 'This account is disabled. Contact support.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password that meets the requirements shown below.',
  'auth/password-does-not-meet-requirements': 'Choose a password that meets the requirements shown below.',
  'auth/email-already-in-use': 'Could not create an account with these details. Try signing in or resetting your password.',
  'auth/account-exists-with-different-credential': 'Use the original sign-in method for this account.',
}

/** Display known provider codes, never raw provider messages, credentials or tokens. */
export function authErrorMessage(error: unknown, action: AuthAction = 'sign-in'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code : undefined
  if (code && Object.hasOwn(messages, code)) return `${messages[code]} (${code})`
  if (action === 'sign-in' && ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(code ?? '')) {
    return 'The email or password is incorrect. Check your details and try again.'
  }
  if (action === 'reset') return 'Could not send a reset link. Try again or contact support.'
  if (action === 'sign-up') return 'Could not create your account. Try again or contact support.'
  return 'Could not sign in. Try again or contact support.'
}
