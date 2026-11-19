'use client'

import { auth } from '@/lib/firebase'
import { BackendClient, BackendError } from './client'

let cached: {identity: typeof auth.currentUser; origin: string; client: BackendClient} | undefined

export function syncBackendIdentity() {
  if (cached && cached.identity !== auth.currentUser) {
    cached.client.close()
    cached = undefined
  } else cached?.client.queries.invalidate()
}

/** The Firebase SDK handles sign-in; only the current backend owns application data. */
export function currentBackend(): BackendClient {
  const origin = process.env.NEXT_PUBLIC_BACKEND_URL
  if (!origin) throw new Error('Missing required public environment variable: NEXT_PUBLIC_BACKEND_URL')
  const identity = auth.currentUser
  if (cached?.origin === origin && cached.identity === identity) return cached.client
  cached?.client.close()
  const client = new BackendClient({ origin, owner: identity?.uid, token: async (forceRefresh) => {
    if (!identity) throw new BackendError(401, 'auth/missing-token', 'Sign in to continue.')
    const ensureIdentity = () => {
      if (auth.currentUser !== identity) throw new BackendError(401, 'auth/account-changed', 'Your signed-in account changed. Reopen this page before retrying.')
    }
    ensureIdentity()
    const token = await identity.getIdToken(forceRefresh)
    ensureIdentity()
    return token
  } })
  cached = {identity, origin, client}
  return client
}
