'use client'

import { auth } from '@/lib/firebase'
import { BackendClient, BackendError } from './client'

/** The Firebase SDK handles sign-in; only the current backend owns application data. */
export function currentBackend(): BackendClient {
  const origin = process.env.NEXT_PUBLIC_BACKEND_URL
  if (!origin) throw new Error('Missing required public environment variable: NEXT_PUBLIC_BACKEND_URL')
  return new BackendClient({ origin, token: async (forceRefresh) => {
    const user = auth.currentUser
    if (!user) throw new BackendError(401, 'auth/missing-token', 'Sign in to continue.')
    return user.getIdToken(forceRefresh)
  } })
}
