import { z } from 'zod'
import { creditCheckoutSchema, creditTaskSchema, type CreditCheckout, type CreditOffer, type CreditTask } from './credits'

const operationSchema = z.object({ key: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/), offerId: z.string(), offerVersion: z.string(), purchaseId: z.string().regex(/^[a-f0-9]{64}$/).optional(), continuation: creditTaskSchema.optional() })
export type CreditOperation = z.infer<typeof operationSchema>
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
const storageKey = (uid: string) => `lotus.credit-checkout.v1:${encodeURIComponent(uid)}`
export function readCreditOperation(storage: Storage, uid: string): CreditOperation | null {
  const raw = storage.getItem(storageKey(uid))
  if (raw === null) return null
  return operationSchema.parse(JSON.parse(raw))
}
export function clearCreditOperation(storage: Storage, uid: string, purchaseId: string) {
  const operation = readCreditOperation(storage, uid)
  if (operation?.purchaseId === purchaseId) storage.removeItem(storageKey(uid))
}
/** Persist before POST. Uncertain errors retain the same identity, even after remount/reload. */
export async function openCreditCheckout(options: {
  uid: string; offer: Pick<CreditOffer, 'id' | 'version'>; requireExisting?: boolean; storage: Storage; currentUid: () => string | undefined; isCurrent: () => boolean;
  continuation?: CreditTask;
  create: (input: { offerId: string; offerVersion: string; continuation?: CreditTask }, key: string) => Promise<CreditCheckout>;
  navigate: (url: string) => void; randomKey?: () => string;
}) {
  const ensureIdentity = () => { if (options.currentUid() !== options.uid || !options.isCurrent()) throw new Error('Your account or page changed. Reopen billing before trying again.') }
  ensureIdentity()
  let operation = readCreditOperation(options.storage, options.uid)
  if (operation && (operation.offerId !== options.offer.id || operation.offerVersion !== options.offer.version)) throw new Error('An earlier checkout must be checked before choosing a different top-up.')
  if (operation && !options.requireExisting && (operation.continuation?.sessionId !== options.continuation?.sessionId ||
    operation.continuation?.checkpointId !== options.continuation?.checkpointId)) throw new Error('Finish your earlier checkout before choosing another task.')
  if (!operation && options.requireExisting) throw new Error('The saved checkout is unavailable. Refresh before starting another payment.')
  if (!operation) {
    operation = { key: (options.randomKey ?? (() => crypto.randomUUID()))(), offerId: options.offer.id, offerVersion: options.offer.version,
      ...(options.continuation === undefined ? {} : { continuation: creditTaskSchema.parse(options.continuation) }) }
    options.storage.setItem(storageKey(options.uid), JSON.stringify(operation))
  }
  let result: CreditCheckout
  try {
    result = creditCheckoutSchema.parse(await options.create({ offerId: operation.offerId, offerVersion: operation.offerVersion,
      ...(operation.continuation === undefined ? {} : { continuation: operation.continuation }) }, operation.key))
  } catch (error) {
    // This specific server rejection precedes creation of the attempted intent.
    // Network errors and all other responses keep the key for uncertain retries.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'credits/purchase-pending' && 'status' in error && error.status === 409) {
      const current = readCreditOperation(options.storage, options.uid)
      if (current?.key === operation.key && !current.purchaseId) options.storage.removeItem(storageKey(options.uid))
    }
    throw error
  }
  ensureIdentity()
  options.storage.setItem(storageKey(options.uid), JSON.stringify({ ...operation, purchaseId: result.purchaseId }))
  if (result.url === null) return result
  if (result.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('This checkout has expired. Refresh its payment status before trying again.')
  ensureIdentity()
  options.navigate(result.url)
  return result
}
