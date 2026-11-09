import { z } from 'zod'

/**
 * One operation key per intended action, alive until the server confirms what the surface it
 * acts on now holds — and kept across page loads, for one signed-in account only.
 *
 * The server records a mutation under its key only once it has succeeded (2xx); a refused or
 * failed request leaves no record, and an operation whose outcome is unknown (a timeout, a 5xx
 * after the payment provider accepted, a seat change still in progress) is recovered by the
 * server from the same key: a seat change pins the organisation under its key, and only a retry
 * carrying that key may follow the pinned operation. A retry with another key is refused while
 * the pin stands unless the provider already holds the pinned quantity, so a key lost to a
 * reload could strand the action — hence the key lives in storage scoped to the account.
 *
 * Intents are grouped by the surface they change (one subscription, one organisation's seats),
 * and each key remembers the generation it was minted in. A confirmed success settles every
 * intent on its surface minted up to its own generation — once Pro has been confirmed, an earlier
 * Business attempt whose answer was lost is superseded, and choosing Business again is a new
 * operation — but never a newer one still unresolved: an action asked after it keeps its key,
 * whatever lands late.
 */
export interface Intent { readonly surface: string; readonly action: string }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
export interface IntentScope { readonly uid: string; readonly storage: Storage }

const keySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)
const entrySchema = z.object({ key: keySchema, generation: z.number().int().nonnegative() }).strict()
const recordSchema = z.object({ uid: z.string().min(1), next: z.number().int().nonnegative(), surfaces: z.record(z.string(), z.record(z.string(), entrySchema)) }).strict()
type IntentRecord = z.infer<typeof recordSchema>

const storageKey = (uid: string) => `lotus-intents:${uid}`

const read = ({ uid, storage }: IntentScope): IntentRecord => {
  try {
    const parsed = recordSchema.safeParse(JSON.parse(storage.getItem(storageKey(uid)) ?? ''))
    if (parsed.success && parsed.data.uid === uid) return parsed.data
  } catch {}
  return { uid, next: 0, surfaces: {} }
}

const write = ({ uid, storage }: IntentScope, record: IntentRecord): void => {
  if (Object.keys(record.surfaces).length === 0) storage.removeItem(storageKey(uid))
  else storage.setItem(storageKey(uid), JSON.stringify(record))
}

export const clearIntents = (storage: Storage, uid: string): void => { storage.removeItem(storageKey(uid)) }

export const intentStore = (scope: IntentScope) => {
  if (scope.uid.length === 0) throw new Error('Intents belong to a signed-in account.')
  const entry = ({ surface, action }: Intent): { key: string; generation: number } => {
    const record = read(scope)
    const existing = record.surfaces[surface]?.[action]
    if (existing !== undefined) return existing
    const minted = { key: keySchema.parse(crypto.randomUUID()), generation: record.next }
    write(scope, { ...record, next: record.next + 1, surfaces: { ...record.surfaces, [surface]: { ...record.surfaces[surface], [action]: minted } } })
    return minted
  }
  const key = (intent: Intent): string => entry(intent).key
  /** The surface's state as of `generation` is now known: nothing asked up to then is still unresolved. */
  const settle = (surface: string, generation: number): void => {
    const record = read(scope)
    const remaining = Object.entries(record.surfaces[surface] ?? {}).filter(([, each]) => each.generation > generation)
    const { [surface]: _settled, ...surfaces } = record.surfaces
    write(scope, { ...record, surfaces: remaining.length === 0 ? surfaces : { ...surfaces, [surface]: Object.fromEntries(remaining) } })
  }
  /** Runs one intended action under its key; only the server confirming the action settles the surface up to it. */
  const run = async <T>(intent: Intent, work: (key: string) => Promise<T>): Promise<T> => {
    const own = entry(intent)
    const result = await work(own.key)
    settle(intent.surface, own.generation)
    return result
  }
  return { key, settle, run }
}
export type IntentStore = ReturnType<typeof intentStore>

export const subscriptionIntent = (action: string): Intent => ({ surface: 'billing/subscription', action })
export const seatsIntent = (orgId: string, seats: number): Intent => ({ surface: `organisation/${orgId}/seats`, action: `seats:${seats}` })
