import type { BackendClient } from './client'

export class MissingProjectSessionError extends Error {
  constructor() {
    super('This project has no saved workspace yet.')
    this.name = 'MissingProjectSessionError'
  }
}

export async function projectSessionPath(
  client: Pick<BackendClient, 'sessions'>,
  project: { id: string; kind?: string },
  signal?: AbortSignal,
): Promise<string> {
  const sessionId = project.kind === 'computer'
    ? project.id
    : (await client.sessions(project.id, signal)).sessions[0]?.id
  if (!sessionId) throw new MissingProjectSessionError()
  return `/computer/${encodeURIComponent(sessionId)}`
}
