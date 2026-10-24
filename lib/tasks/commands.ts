import { TaskApiError, type TaskClient } from './client'
import type { ApprovalDecision } from './contract'
/** Keep an uncertain mutation's identity until explicitly resolved. No tokens are stored. */
export type PendingCommand = { fingerprint: string; key: string }
export function commandIdentity(previous: PendingCommand | null, fingerprint: string, newKey = () => crypto.randomUUID()): PendingCommand {
  if (previous && previous.fingerprint !== fingerprint) throw new Error('Resolve the pending request before changing it.')
  return previous ?? { fingerprint, key: newKey() }
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export const pendingTaskCommandKey = (uid: string, sessionId: string | null) => `lotus-agent-command:${uid}:${sessionId ?? 'new'}`
export function readPendingCommand(storage: Storage, key: string): PendingCommand | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  const value = JSON.parse(raw)
  if (!value || typeof value.fingerprint !== 'string' || value.fingerprint.length > 100000 || typeof value.key !== 'string' || !value.key) throw new Error('The pending action could not be read. Do not repeat it with a new key.')
  return value
}
export async function runTaskCommand<T>(storage: Storage, uid: string, sessionId: string | null, fingerprint: string, execute: (key: string) => Promise<T>): Promise<T> {
  const storageKey = pendingTaskCommandKey(uid, sessionId)
  const previous = readPendingCommand(storage, storageKey)
  const pending = commandIdentity(previous, fingerprint)
  storage.setItem(storageKey, JSON.stringify(pending))
  try {
    const result = await execute(pending.key)
    storage.removeItem(storageKey)
    return result
  } catch (error) {
    // A first explicit rejection is definitive. A failed replay does not disprove an earlier commit.
    // Never clear previous uncertainty on auth failure, abort, conflict or server failure.
    const rejectedState = error instanceof TaskApiError && error.status === 409 && [
      'current run is still active', 'session must be idle before another turn',
      'no pending approval on this session', 'approval batch is no longer current',
      'interrupted execution requires reconciliation; start a new session',
    ].includes(error.message)
    if (!previous && error instanceof TaskApiError && ([400, 401, 403, 404, 422].includes(error.status) || rejectedState)) storage.removeItem(storageKey)
    throw error
  }
}

/** Replay the original operation, never reconstruct it from the currently visible form. */
export function replayPendingCommand(api: TaskClient, sessionId: string | null, pending: PendingCommand, signal?: AbortSignal) {
  const command: unknown = JSON.parse(pending.fingerprint)
  if (!Array.isArray(command)) throw new Error('The pending request is invalid.')
  if (command[0] === 'create' && sessionId === null && typeof command[1] === 'string' && (command[2] === 'code' || command[2] === 'desktop')) return api.create(command[1], command[2], pending.key, signal)
  if (command[1] !== sessionId || !sessionId) throw new Error('The pending request belongs to a different task.')
  if (command[0] === 'message' && typeof command[2] === 'string') return api.message(sessionId, command[2], pending.key, signal)
  if (command[0] === 'approve' && typeof command[2] === 'string' && Array.isArray(command[3]) && command[3].every(item => item && typeof item.call_id === 'string' && typeof item.approved === 'boolean')) return api.approve(sessionId, command[2], command[3] as ApprovalDecision[], pending.key, signal)
  throw new Error('The pending request is invalid. Do not repeat it with a new identity.')
}
