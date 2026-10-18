import { z } from 'zod'
import type { BackendClient } from './client'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingCancelKey(uid: string, sessionId: string) { return `lotus-pending-cancel:${uid}:${sessionId}` }

export async function cancelSession(client: BackendClient, storage: Storage, uid: string, sessionId: string) {
  const storageKey = pendingCancelKey(uid, sessionId)
  const raw = storage.getItem(storageKey)
  const key = z.string().uuid().parse(raw ?? crypto.randomUUID())
  storage.setItem(storageKey, key)
  const result = await client.cancel(sessionId, key)
  storage.removeItem(storageKey)
  return result
}
