import { z } from 'zod'

/**
 * One operation key per intended action, alive until the server confirms what the surface it
 * acts on now holds.
 *
 * The server records a mutation under its key only once it has succeeded (2xx); a refused or
 * failed request leaves no record, and an operation whose outcome is unknown (a timeout, a 5xx
 * after the payment provider accepted, a seat change still in progress) is recovered by the
 * server from the same key. So a retry of the same intended action — same plan, same seat
 * count, same cancel flag — sends the same key whatever the previous attempt returned.
 *
 * Intents are grouped by the surface they change (one subscription, one organisation's seats).
 * A confirmed success on a surface settles every unresolved intent on it: once Pro has been
 * confirmed, an earlier Business attempt whose answer was lost is superseded, and choosing
 * Business again is a new operation with a new key rather than a replay of the old one.
 */
export interface Intent { readonly surface: string; readonly action: string }

const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const surfaces = new Map<string, Map<string, string>>()

export const intentKey = ({ surface, action }: Intent): string => {
  const actions = surfaces.get(surface) ?? new Map<string, string>()
  surfaces.set(surface, actions)
  const existing = actions.get(action)
  if (existing !== undefined) return existing
  const key = keySchema.parse(crypto.randomUUID())
  actions.set(action, key)
  return key
}

/** The surface's state is now known: no intent on it is still unresolved. */
export const settleSurface = (surface: string): void => { surfaces.delete(surface) }

/** Runs one intended action under its key; only the server confirming the action settles the surface. */
export const withIntent = async <T>(intent: Intent, work: (key: string) => Promise<T>): Promise<T> => {
  const result = await work(intentKey(intent))
  settleSurface(intent.surface)
  return result
}

export const subscriptionIntent = (action: string): Intent => ({ surface: 'billing/subscription', action })
export const seatsIntent = (orgId: string, seats: number): Intent => ({ surface: `organisation/${orgId}/seats`, action: `seats:${seats}` })
