'use client'
import { auth } from '@/lib/firebase'
import { TaskClient } from './client'

/** Captures identity so an account switch cannot send a previous user's action. */
export function currentTaskBackend(expectedUid: string): import('./client').TaskClient {
  const origin = process.env.NEXT_PUBLIC_AGENT_BACKEND_URL
  if (!origin) throw new Error('The new agent workspace is not configured yet.')
  const identity = auth.currentUser
  if (!identity || identity.uid !== expectedUid) throw new Error('Your account changed. Reopen this workspace.')
  return new TaskClient({ origin, token: async () => {
    if (!identity || auth.currentUser?.uid !== identity.uid) throw new Error('Your account changed. Reopen this workspace.')
    const token = await identity.getIdToken()
    if (auth.currentUser?.uid !== identity.uid) throw new Error('Your account changed. Reopen this workspace.')
    return token
  } })
}
