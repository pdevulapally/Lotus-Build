import { z } from 'zod'
import type { BackendClient } from './client'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export type ContinuationCommand = Parameters<BackendClient['continueSession']>[1]
const pendingSchema = z.object({ checkpointId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), lane: z.enum(['premium', 'fallback']),
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/), effort: z.enum(['low', 'standard', 'high', 'xhigh']), key: z.string().uuid() }).strict()
const storageKey = (uid: string, sessionId: string) => `lotus-pending-continuation:${uid}:${sessionId}`
export function readPendingContinuation(storage: Storage, uid: string, sessionId: string) {
  const raw = storage.getItem(storageKey(uid, sessionId))
  return raw === null ? null : pendingSchema.parse(JSON.parse(raw))
}
export async function continueSession(client: BackendClient, storage: Storage, uid: string, sessionId: string, command: ContinuationCommand) {
  const prior = readPendingContinuation(storage, uid, sessionId)
  const pending = prior ?? pendingSchema.parse({ ...command, key: crypto.randomUUID() })
  const { key, ...original } = pending
  if (original.checkpointId !== command.checkpointId || original.model !== command.model || original.lane !== command.lane || original.effort !== command.effort) throw new Error('Reconcile the pending continuation before choosing another model or task version.')
  storage.setItem(storageKey(uid, sessionId), JSON.stringify(pending))
  const result = await client.continueSession(sessionId, original, key)
  storage.removeItem(storageKey(uid, sessionId))
  return result
}
