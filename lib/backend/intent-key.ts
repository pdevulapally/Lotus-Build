import { z } from 'zod'

/**
 * One operation key per intended action. A user who confirms "move to Business" and retries after an
 * uncertain failure is still asking for that one change, so the same key is sent and the server treats
 * it as one mutation; asking for something else (another plan, a different seat count, resume instead of
 * cancel) is a new intent and gets a fresh key. A key is forgotten once its action has a definite answer.
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

/** Runs one intended action under its key: a definite answer (success, or a refusal) settles the intent; an uncertain failure keeps the key for the retry. */
export const withIntent = async <T>(intent: string, work: (key: string) => Promise<T>, definite: (reason: unknown) => boolean): Promise<T> => {
  const key = intentKey(intent)
  try {
    const result = await work(key)
    settleIntent(intent)
    return result
  } catch (reason) {
    if (definite(reason)) settleIntent(intent)
    throw reason
  }
}
