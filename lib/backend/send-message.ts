import { z } from 'zod'
import type { BackendClient } from './client'
const pendingSchema = z.object({ prompt: z.string().trim().min(1).max(8000), key: z.string().uuid(), mode: z.enum(['build', 'plan']).optional() }).strict()
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingMessageKey(uid: string, sessionId: string) { return `lotus-pending-message:${uid}:${sessionId}` }
/** The accepted write and a later history refresh are separate outcomes. */
export async function sendMessage(client: BackendClient, storage: Storage, uid: string, sessionId: string, prompt: string, mode?: 'build' | 'plan') {
  const storageKey = pendingMessageKey(uid, sessionId)
  const raw = storage.getItem(storageKey)
  const pending = pendingSchema.parse(raw ? JSON.parse(raw) : { prompt, key: crypto.randomUUID(), ...(mode === undefined ? {} : { mode }) })
  if (pending.prompt !== prompt.trim() || pending.mode !== mode) throw new Error('Retry or discard the pending message before sending different text or changing mode.')
  storage.setItem(storageKey, JSON.stringify(pending))
  const result = await client.sendMessage(sessionId, { prompt: pending.prompt, ...(pending.mode === undefined ? {} : { mode: pending.mode }) }, pending.key)
  storage.removeItem(storageKey)
  return result
}
