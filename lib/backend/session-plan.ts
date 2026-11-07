import { z } from 'zod'
import type { BackendClient, BackendSession, SessionEvent } from './client'

/** The server's plan contract (#70): one structured plan per session, every change a new revision. */
export const planStepStatuses = ['proposed', 'in_progress', 'done', 'skipped', 'blocked'] as const
export type PlanStepStatus = (typeof planStepStatuses)[number]

const text = (max: number) => z.string().max(max)
const planStepSchema = z.object({
  id: text(40), title: text(200), detail: text(2000).optional(), status: z.enum(planStepStatuses),
  note: text(500).optional(), evidence: z.array(text(200)).max(8).optional(),
})
const planQuestionSchema = z.object({ id: text(40), text: text(1000), answer: text(2000).optional() })
export const sessionPlanSchema = z.object({
  protocol: z.literal(1), revision: z.number().int().positive(), title: text(200), summary: text(2000),
  steps: z.array(planStepSchema).max(32), questions: z.array(planQuestionSchema).max(8),
  checks: z.array(text(500)).max(16), decisions: z.array(text(500)).max(16), risks: z.array(text(500)).max(16),
  approvedRevision: z.number().int().positive().optional(), source: z.enum(['agent', 'user']),
})
export type SessionPlan = z.infer<typeof sessionPlanSchema>
export type PlanStep = z.infer<typeof planStepSchema>

/** What a user may change: skip or restore a step, reword it, add a step, answer a question. Only the agent marks work done. */
export const planUpdateSchema = z.object({
  steps: z.array(z.object({ id: text(40), status: z.enum(['proposed', 'skipped']).optional(), title: text(200).optional(), detail: text(2000).optional(), note: text(500).optional() }).strict()).max(32).optional(),
  addSteps: z.array(z.object({ title: text(200), detail: text(2000).optional() }).strict()).max(32).optional(),
  answers: z.array(z.object({ id: text(40), answer: text(2000) }).strict()).max(8).optional(),
}).strict()
export type PlanUpdate = z.infer<typeof planUpdateSchema>

/** `session.plan_updated` carries the whole plan; an older revision arriving late never overwrites a newer one. */
export function applyPlanEvent(session: BackendSession | null, event: SessionEvent): BackendSession | null {
  if (!session || event.type !== 'session.plan_updated') return session
  const parsed = sessionPlanSchema.safeParse(event.data.plan)
  if (!parsed.success) return session
  if (session.plan !== undefined && parsed.data.revision <= session.plan.revision) return session
  return { ...session, plan: parsed.data }
}

const activeStatuses: ReadonlySet<BackendSession['status']> = new Set(['QUEUED', 'RUNNING'])

/** Mirrors the server's gate: approve/edit only between runs, with nothing else waiting on the user. */
export function planAvailability(session: BackendSession | null | undefined) {
  const plan = session?.plan
  if (!session || !plan) return { plan: undefined, canApprove: false, canEdit: false } as const
  const settled = !activeStatuses.has(session.status) && session.pendingInput === undefined && session.fallback === undefined
  return { plan, canApprove: settled && plan.approvedRevision !== plan.revision, canEdit: settled } as const
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export function pendingPlanKey(uid: string, sessionId: string, command: 'approve' | 'edit') { return `lotus-pending-plan-${command}:${uid}:${sessionId}` }

async function withStableKey<T>(storage: Storage, storageKey: string, send: (key: string) => Promise<T>) {
  const key = z.string().uuid().parse(storage.getItem(storageKey) ?? crypto.randomUUID())
  storage.setItem(storageKey, key)
  const result = await send(key)
  storage.removeItem(storageKey)
  return result
}

/** `revision` names the plan the user read, so a double click or a second tab can never approve something newer. */
export function approvePlan(client: BackendClient, storage: Storage, uid: string, sessionId: string, revision: number) {
  return withStableKey(storage, pendingPlanKey(uid, sessionId, 'approve'), (key) => client.approvePlan(sessionId, revision, key))
}

export function editPlan(client: BackendClient, storage: Storage, uid: string, sessionId: string, revision: number, update: PlanUpdate) {
  return withStableKey(storage, pendingPlanKey(uid, sessionId, 'edit'), (key) => client.editPlan(sessionId, revision, update, key))
}
