import { z } from 'zod'
import type { BackendClient } from './client'
import { attachmentRefsSchema, sameAttachments, type AttachmentRef } from './attachments'
const pendingSchema = z.object({ prompt: z.string().trim().min(1).max(8000), key: z.string().uuid(), mode: z.enum(['build', 'plan']).optional(), attachments: attachmentRefsSchema.default([]) }).strict()
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingMessageKey(uid: string, sessionId: string) { return `lotus-pending-message:${uid}:${sessionId}` }
/** The accepted write and a later history refresh are separate outcomes. */
export async function sendMessage(client: BackendClient, storage: Storage, uid: string, sessionId: string, prompt: string, mode?: 'build' | 'plan', attachments: readonly AttachmentRef[] = []) {
  const storageKey = pendingMessageKey(uid, sessionId)
  const raw = storage.getItem(storageKey)
  const pending = pendingSchema.parse(raw ? JSON.parse(raw) : { prompt, key: crypto.randomUUID(), attachments, ...(mode === undefined ? {} : { mode }) })
  if (pending.prompt !== prompt.trim() || pending.mode !== mode || !sameAttachments(pending.attachments, attachments)) throw new Error('Retry or discard the pending message before sending different text, attaching different images or changing mode.')
  storage.setItem(storageKey, JSON.stringify(pending))
  const result = await client.sendMessage(sessionId, { prompt: pending.prompt, ...(pending.mode === undefined ? {} : { mode: pending.mode }), ...(pending.attachments.length === 0 ? {} : { attachments: pending.attachments }) }, pending.key)
  storage.removeItem(storageKey)
  return result
}
