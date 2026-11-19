import { z } from 'zod'

export const projectId = z.string().regex(/^[a-f0-9]{32}$/)
export const privateProject = z.object({id: projectId, name: z.string()})
export const privatePage = z.object({projects: z.array(privateProject), next_cursor: projectId.nullable()})
export const runView = z.object({
  session: projectId, status: z.enum(['queued','running','clarification','completed','stopping','stopped','uncertain','blocked_budget','interrupted']),
  cursor: z.number().int().nonnegative(), events: z.array(z.object({
    sequence: z.number().int().positive(),
    kind: z.enum(['question','clarify','reply','correction','answer','stop_requested','stopped','uncertain','blocked_budget']),
    text: z.string().optional(),
  })),
})
export type Conversation = z.infer<typeof runView>
export type PrivateProject = z.infer<typeof privateProject>
export const ongoing = (s: Conversation['status']) => s === 'queued' || s === 'running' || s === 'stopping'

/** Reject gaps; ignore a poll superseded by a newer mutation response. */
export function applyEvents(previous: Conversation | null, next: Conversation): Conversation {
  const prior = previous?.session === next.session ? previous : null
  if (prior && next.cursor < prior.cursor) return prior
  const events = [...(prior?.events ?? [])]
  for (const event of next.events) {
    if (event.sequence <= events.length) continue
    if (event.sequence !== events.length + 1) throw new Error('Conversation changed. Reopen it to reload.')
    events.push(event)
  }
  if (next.cursor !== events.length) throw new Error('Conversation history is incomplete.')
  return {...next, events}
}
