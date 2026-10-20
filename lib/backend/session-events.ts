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

/** A connection that stayed up this long is considered healthy, so its loss is not a repeated failure. */
export const HEALTHY_CONNECTION_MS = 30_000
/** The first drop reconnects quietly; only a second consecutive drop is shown to the user. */
const QUIET_RETRY_DELAY_MS = 300
const MAX_CONSECUTIVE_FAILURES = 6

export const STREAM_MESSAGES = {
  interrupted: 'Live connection interrupted. Reconnecting…',
  stopped: 'Live connection stopped after repeated interruptions. Retry the connection to resume.',
  unauthorized: 'Session access could not be verified. Sign in again or retry the connection.',
  failed: 'Live connection failed.',
} as const

/**
 * Follows a session's event stream, resuming from the last accepted event across reconnects.
 *
 * The server ends streams on purpose: when the bearer token reaches its expiry
 * (`token-expired`), when a reader falls behind (`slow-consumer`), and on deploys.
 * Those are rotations, not outages, so they reconnect immediately and silently.
 * The user is only told about a drop when the retry also fails, and reconnecting
 * clears the notice through `onConnected`.
 */
export async function followSessionEvents(client: BackendClient, sessionId: string, options: {
  signal: AbortSignal
  refreshToken: () => Promise<unknown>
  onEvent: (event: SessionEvent & { id: string }) => void | Promise<void>
  onError: (message: string) => void
  onConnected?: () => void
}, wait = pause, now: () => number = Date.now) {
  const { signal } = options
  let cursor: string | undefined
  let failures = 0
  while (!signal.aborted) {
    let closing: string | undefined
    const openedAt = now()
    try {
      await client.events(sessionId, { signal, after: cursor, onOpen: options.onConnected, onEvent: async (event) => {
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
        options.onError(STREAM_MESSAGES.unauthorized)
        return
      }
      if (closing === 'token-expired') {
        try { await options.refreshToken() }
        catch { options.onError(STREAM_MESSAGES.unauthorized); return }
        if (signal.aborted) return
        continue
      }
    } catch (reason) {
      if (signal.aborted) return
      if (reason instanceof BackendError && [401, 403, 404].includes(reason.status)) {
        options.onError(reason.message)
        return
      }
    }
    if (now() - openedAt >= HEALTHY_CONNECTION_MS) failures = 0
    failures += 1
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      options.onError(STREAM_MESSAGES.stopped)
      return
    }
    if (failures > 1) options.onError(STREAM_MESSAGES.interrupted)
    await wait(failures === 1 ? QUIET_RETRY_DELAY_MS : Math.min(30_000, 1000 * 2 ** (failures - 1)), signal)
  }
}
