import { z } from 'zod'

export const taskStatusSchema = z.enum(['queued', 'running', 'awaiting_approval', 'idle', 'error', 'cancel_requested', 'cancelled'])
const callSchema = z.object({ id: z.string().min(1), name: z.string().min(1), input: z.record(z.string(), z.unknown()), risky: z.boolean() })
export const taskSessionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), kind: z.enum(['code', 'desktop']), status: taskStatusSchema,
  schema_version: z.literal(2), revision: z.number().int().nonnegative(), active_run_id: z.string().nullable(),
  created_at: z.string().optional(), updated_at: z.string().optional(),
  cancel_requested: z.boolean(), recovery_required: z.boolean(), error: z.string().nullable(),
  messages: z.array(z.record(z.string(), z.unknown())), plan: z.array(z.record(z.string(), z.unknown())).nullable(),
  pending_approval: z.object({ id: z.string().min(1), calls: z.array(callSchema) }).passthrough().nullable(),
})
export type TaskSession = z.infer<typeof taskSessionSchema>
export type TaskStatus = z.infer<typeof taskStatusSchema>
export type ApprovalDecision = { call_id: string; approved: boolean }
export const taskStatusLabels: Record<TaskStatus, string> = {
  queued: 'Waiting to start', running: 'Working', awaiting_approval: 'Your decision needed', idle: 'Ready for your next message',
  error: 'Needs attention', cancel_requested: 'Stopping safely', cancelled: 'Stopped',
}
export const isTaskWorkspacePath = (path: string) => path === '/tasks' || path.startsWith('/tasks/')
export const shouldPollTask = (task: TaskSession) => ['queued', 'running', 'cancel_requested'].includes(task.status)
export const canReplyToTask = (task: TaskSession) => task.status === 'idle' && !task.recovery_required
export const canCancelTask = (task: TaskSession) => !task.cancel_requested && !['cancelled', 'error'].includes(task.status)
export function messageText(message: Record<string, unknown>): string {
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''
  return message.content.filter((block): block is { type: string; text: string } => !!block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n\n')
}
export function approvalDecisions(task: TaskSession, choices: Record<string, boolean>): ApprovalDecision[] {
  const risky = task.pending_approval?.calls.filter(call => call.risky) ?? []
  if (!risky.length || risky.some(call => typeof choices[call.id] !== 'boolean')) throw new Error('Choose approve or deny for every requested action.')
  return risky.map(call => ({ call_id: call.id, approved: choices[call.id] }))
}
