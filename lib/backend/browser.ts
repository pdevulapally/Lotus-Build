'use client'

import { auth } from '@/lib/firebase'
import { BackendClient, BackendError } from './client'

/** The Firebase SDK handles sign-in; only the current backend owns application data. */
export function currentBackend(): BackendClient {
  const origin = process.env.NEXT_PUBLIC_BACKEND_URL
  if (!origin) throw new Error('Missing required public environment variable: NEXT_PUBLIC_BACKEND_URL')
  const identity = auth.currentUser
  return new BackendClient({ origin, token: async (forceRefresh) => {
    if (!identity) throw new BackendError(401, 'auth/missing-token', 'Sign in to continue.')
    const ensureIdentity = () => {
      if (auth.currentUser?.uid !== identity.uid) throw new BackendError(401, 'auth/account-changed', 'Your signed-in account changed. Reopen this page before retrying.')
    }
    ensureIdentity()
    const token = await identity.getIdToken(forceRefresh)
    ensureIdentity()
    return token
  } })
}
