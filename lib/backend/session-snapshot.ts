import type { BackendClient, BackendProject, BackendSession } from './client'

/** Durable lifecycle events confirm these statuses before the next snapshot. */
export const sessionEventStatus: Readonly<Partial<Record<string, BackendSession['status']>>> = {
  'session.queued': 'QUEUED', 'session.running': 'RUNNING', 'session.idle': 'IDLE', 'session.failed': 'FAILED',
}

/** History and the queue must not delay the session → project dependency. */
export async function loadSessionSnapshot(client: BackendClient, id: string, signal: AbortSignal,
  onOwned?: (session: BackendSession, project: BackendProject) => void) {
  const parent = client.session(id, signal).then(async (session) => {
    if (session.id !== id) throw new Error('The server returned a mismatched session.')
    const project = await client.project(session.projectId, signal)
    if (project.id !== session.projectId) throw new Error('The server returned a mismatched project.')
    if (!signal.aborted) onOwned?.(session, project)
    return { session, project }
  })
  const [owned, history, waiting] = await Promise.all([parent, client.messages(id, signal), client.queuedMessages(id, signal)])
  return { ...owned, messages: history.messages, queued: waiting.queuedMessages }
}
