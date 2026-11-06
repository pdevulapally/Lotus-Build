import { z } from 'zod'
import type { BackendClient } from './client'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingCancelKey(uid: string, sessionId: string) { return `lotus-pending-cancel:${uid}:${sessionId}` }

/** `execution` names the run the user is looking at, so a Stop can never land on a run that started after it. */
export async function cancelSession(client: BackendClient, storage: Storage, uid: string, sessionId: string, execution?: number) {
  const storageKey = pendingCancelKey(uid, sessionId)
  const raw = storage.getItem(storageKey)
  const key = z.string().uuid().parse(raw ?? crypto.randomUUID())
  storage.setItem(storageKey, key)
  const result = await client.cancel(sessionId, key, execution)
  storage.removeItem(storageKey)
  return result
}
