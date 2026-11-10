import { z } from 'zod'
import { BackendError, type BackendClient } from './client'
import { attachmentRefsSchema, sameAttachments, type AttachmentRef } from './attachments'
import { computerSessionModeSchema, type ComputerSessionMode } from './session-modes'
const pendingSchema = z.object({ prompt: z.string().trim().min(1).max(8000), key: z.string().uuid(), mode: computerSessionModeSchema.optional(), attachments: attachmentRefsSchema.default([]), inputResponse: z.object({ id: z.string().min(1), answer: z.string().min(1).max(8000) }).optional() }).strict()
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingMessageKey(uid: string, sessionId: string) { return `lotus-pending-message:${uid}:${sessionId}` }
export function readPendingMessage(storage: Storage, uid: string, sessionId: string) {
  const raw = storage.getItem(pendingMessageKey(uid, sessionId))
  return raw === null ? null : pendingSchema.parse(JSON.parse(raw))
}
/** These responses are rejected before acceptance, after the server checks the durable command receipt. */
export function isRejectedInputResponse(reason: unknown): boolean {
  return reason instanceof BackendError && reason.status === 409
    && (reason.code === 'session/input-stale' || reason.code === 'session/input-required')
}
/** The accepted write and a later history refresh are separate outcomes. */
export async function sendMessage(client: BackendClient, storage: Storage, uid: string, sessionId: string, prompt: string, mode?: ComputerSessionMode, attachments: readonly AttachmentRef[] = [], inputResponse?: { id: string; answer: string }) {
  const storageKey = pendingMessageKey(uid, sessionId)
  const raw = storage.getItem(storageKey)
  const pending = pendingSchema.parse(raw ? JSON.parse(raw) : { prompt, key: crypto.randomUUID(), attachments, ...(inputResponse === undefined ? {} : { inputResponse }), ...(mode === undefined ? {} : { mode }) })
  if (pending.prompt !== prompt.trim() || pending.mode !== mode || !sameAttachments(pending.attachments, attachments) || JSON.stringify(pending.inputResponse) !== JSON.stringify(inputResponse)) throw new Error('Retry the pending message before sending different text, attaching different images or changing mode.')
  const serialized = JSON.stringify(pending)
  storage.setItem(storageKey, serialized)
  // A response for this attempt must not clear another tab's newer command.
  const clearMatching = () => { if (storage.getItem(storageKey) === serialized) storage.removeItem(storageKey) }
  try {
    const result = await client.sendMessage(sessionId, { prompt: pending.prompt, ...(pending.inputResponse === undefined ? {} : { inputResponse: pending.inputResponse }), ...(pending.mode === undefined ? {} : { mode: pending.mode }), ...(pending.attachments.length === 0 ? {} : { attachments: pending.attachments }) }, pending.key)
    clearMatching()
    return result
  } catch (reason) {
    // Network failures, malformed responses, 5xx and other conflicts remain
    // uncertain. Keep their exact command identity for a safe retry.
    if (isRejectedInputResponse(reason)) clearMatching()
    throw reason
  }
}
