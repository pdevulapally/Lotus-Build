import type { BackendSession } from '@/lib/backend/client'

export function settingsSessionId(pathname: string | null): string | null {
  return pathname?.match(/^\/computer\/([A-Za-z0-9_-]{1,128})\/?$/)?.[1] ?? null
}

/** An offered continuation is not active until the server confirms its lane and consent. */
export function sessionModel(session: BackendSession): { id: string; continuation: boolean } {
  const continuation = session.fallback?.lane === 'fallback' && session.fallback.consent === true && session.fallback.offer !== undefined
  return { id: continuation ? session.fallback!.offer!.model : session.model, continuation }
}
