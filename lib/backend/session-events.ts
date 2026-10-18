import { BackendError, type BackendClient, type SessionEvent } from './client'

function newer(left: string, right: string) {
  const [a, b] = left.split('-').map(BigInt); const [c, d] = right.split('-').map(BigInt)
  return a > c || (a === c && b > d)
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

export async function followSessionEvents(client: BackendClient, sessionId: string, options: {
  signal: AbortSignal
  refreshToken: () => Promise<unknown>
  onEvent: (event: SessionEvent & { id: string }) => void | Promise<void>
  onError: (message: string) => void
}, wait = pause) {
  const { signal } = options
  let cursor: string | undefined
  let failures = 0
  while (!signal.aborted) {
    let closing: string | undefined
    try {
      await client.events(sessionId, { signal, after: cursor, onEvent: async (event) => {
        if (signal.aborted) return
        if (event.type === 'stream.closing') { closing = String(event.data.reason); return }
        if (!event.id || (cursor && !newer(event.id, cursor))) return
        await options.onEvent({ ...event, id: event.id })
        if (signal.aborted) return
        cursor = event.id
        failures = 0
      } })
      if (signal.aborted) return
      if (closing === 'authorization-failed') {
        options.onError('Session access could not be verified. Sign in again or retry the connection.')
        return
      }
      if (closing === 'token-expired') await options.refreshToken()
      options.onError('Live connection interrupted. Reconnecting…')
    } catch (reason) {
      if (signal.aborted) return
      options.onError(reason instanceof Error ? reason.message : 'Live connection failed.')
      if (reason instanceof BackendError && [401, 403, 404].includes(reason.status)) return
    }
    if (++failures >= 5) {
      options.onError('Live connection stopped after repeated interruptions. Retry the connection to resume.')
      return
    }
    await wait(Math.min(30_000, 1000 * 2 ** failures), signal)
  }
}
