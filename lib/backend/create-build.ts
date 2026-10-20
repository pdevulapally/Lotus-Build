import { z } from 'zod'
import type { BackendClient } from './client'
import { attachmentRefsSchema, sameAttachments, type AttachmentRef } from './attachments'

const attemptSchema = z.object({ uid: z.string().min(1), prompt: z.string().trim().min(1).max(8000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/), model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/), mode: z.enum(['build', 'plan']),
  projectKey: z.string().uuid(), sessionKey: z.string().uuid(), projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  attachments: attachmentRefsSchema.default([]),
})
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingBuild(storage: Storage, uid: string) {
  const raw = storage.getItem(`lotus-current-build:${uid}`)
  if (raw === null) return null
  const attempt = attemptSchema.parse(JSON.parse(raw))
  if (attempt.uid !== uid) throw new Error('Pending build belongs to a different account.')
  return attempt
}

/** Resume the same two-step operation after reload or a lost response; never silently create a second project. */
export async function createBuild(client: BackendClient, storage: Storage,
  input: { uid: string; prompt: string; model: string; mode: 'build' | 'plan'; attachments?: readonly AttachmentRef[] }) {
  const storageKey = `lotus-current-build:${input.uid}`
  const raw = storage.getItem(storageKey)
  const attachments = input.attachments ?? []
  let attempt = raw ? attemptSchema.parse(JSON.parse(raw)) : attemptSchema.parse({ ...input, attachments,
    projectKey: crypto.randomUUID(), sessionKey: crypto.randomUUID() })
  if (attempt.uid !== input.uid || attempt.prompt !== input.prompt || attempt.model !== input.model || attempt.mode !== input.mode || !sameAttachments(attempt.attachments, attachments)) {
    throw new Error('A previous build request has an uncertain outcome. Retry the same request, or discard that pending request before starting another.')
  }
  storage.setItem(storageKey, JSON.stringify(attempt))
  if (!attempt.projectId) {
    // A project name is a display label; the full prompt belongs to the session.
    const name = input.prompt.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100)
    const project = await client.createProject({ name }, attempt.projectKey)
    attempt = { ...attempt, projectId: project.id }
    storage.setItem(storageKey, JSON.stringify(attempt))
  }
  const session = await client.createSession(attempt.projectId!, { prompt: input.prompt, model: input.model, mode: input.mode, ...(attempt.attachments.length === 0 ? {} : { attachments: attempt.attachments }) }, attempt.sessionKey)
  storage.removeItem(storageKey)
  return session
}
