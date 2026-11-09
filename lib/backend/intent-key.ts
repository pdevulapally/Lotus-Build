import { z } from 'zod'

/**
 * One operation key per intended action, kept until that action is known to have happened.
 *
 * The server records a mutation under its key only once it has succeeded (2xx); a refused or
 * failed request leaves no record, and an operation whose outcome is unknown (a timeout, a 5xx
 * after the payment provider accepted, a seat change still in progress) is recovered by the
 * server from the same key. So a retry of the same intended action — same plan, same seat
 * count, same cancel flag — must send the same key whatever the previous attempt returned, and
 * only a confirmed success settles it. Asking for something else is a new intent with its own key.
 */
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const keys = new Map<string, string>()

export const intentKey = (intent: string): string => {
  const existing = keys.get(intent)
  if (existing !== undefined) return existing
  const key = keySchema.parse(crypto.randomUUID())
  keys.set(intent, key)
  return key
}

export const settleIntent = (intent: string): void => { keys.delete(intent) }

/** Runs one intended action under its key; the key is settled only when the server confirms the action. */
export const withIntent = async <T>(intent: string, work: (key: string) => Promise<T>): Promise<T> => {
  const result = await work(intentKey(intent))
  settleIntent(intent)
  return result
}
