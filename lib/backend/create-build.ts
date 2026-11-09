import { z } from 'zod'
import type { BackendClient } from './client'
import { attachmentRefsSchema, sameAttachments, type AttachmentRef } from './attachments'
import { computerSessionModeSchema, type ComputerSessionMode } from './session-modes'

const baseAttemptSchema = z.object({ uid: z.string().min(1), model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/), mode: computerSessionModeSchema,
  projectKey: z.string().uuid(), sessionKey: z.string().uuid(), projectId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
  attachments: attachmentRefsSchema.default([]),
  /** The organisation the project is created in; absent means the account's own workspace. */
  workspaceId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
})
const attemptSchema = z.union([
  baseAttemptSchema.extend({ entrypoint: z.undefined().optional(), prompt: z.string().trim().min(1).max(8000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/) }).strict(),
  baseAttemptSchema.extend({ entrypoint: z.literal('voice'), mode: z.literal('plan'), prompt: z.never().optional(), attachments: attachmentRefsSchema.max(0).default([]) }).strict(),
])
export type ProjectCreationRequest =
  | { entrypoint?: undefined; prompt: string; mode: ComputerSessionMode; attachments?: readonly AttachmentRef[]; workspaceId?: string }
  | { entrypoint: 'voice'; mode: 'plan'; prompt?: never; attachments?: never; workspaceId?: string }
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
  input: ProjectCreationRequest & { uid: string; model: string }) {
  const storageKey = `lotus-current-build:${input.uid}`
  const raw = storage.getItem(storageKey)
  const attachments = input.attachments ?? []
  let attempt = raw ? attemptSchema.parse(JSON.parse(raw)) : attemptSchema.parse({ ...input, attachments,
    projectKey: crypto.randomUUID(), sessionKey: crypto.randomUUID() })
  if (attempt.uid !== input.uid || attempt.workspaceId !== input.workspaceId || attempt.prompt !== input.prompt || attempt.model !== input.model || attempt.mode !== input.mode || attempt.entrypoint !== input.entrypoint || !sameAttachments(attempt.attachments, attachments)) {
    // The pending request is never carried out under another workspace: a build asked for in organisation A
    // is not retried from B, however alike the prompt.
    const where = attempt.workspaceId === undefined ? 'your personal workspace' : 'another workspace'
    throw new Error(`A previous build request in ${where} has an uncertain outcome. Return there and retry the same request, or discard that pending request before starting another.`)
  }
  storage.setItem(storageKey, JSON.stringify(attempt))
  if (!attempt.projectId) {
    // A project name is a display label; the full prompt belongs to the session.
    const name = input.entrypoint === 'voice' ? 'New project' : input.prompt.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100)
    const project = await client.createProject({ name, ...(attempt.workspaceId === undefined ? {} : { workspaceId: attempt.workspaceId }) }, attempt.projectKey)
    attempt = { ...attempt, projectId: project.id }
    storage.setItem(storageKey, JSON.stringify(attempt))
  }
  const session = attempt.entrypoint === 'voice'
    ? await client.createVoiceSession(attempt.projectId!, attempt.model, attempt.sessionKey)
    : await client.createSession(attempt.projectId!, { prompt: attempt.prompt, model: attempt.model, mode: attempt.mode, ...(attempt.attachments.length === 0 ? {} : { attachments: attempt.attachments }) }, attempt.sessionKey)
  storage.removeItem(storageKey)
  return session
}
