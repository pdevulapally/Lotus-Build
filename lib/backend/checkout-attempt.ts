import { z } from 'zod'

const checkoutAttemptSchema = z.object({
  uid: z.string().min(1),
  planKey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  url: z.url().refine((value) => {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com'
      && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443')
  }),
}).strict()

export type CheckoutAttempt = z.infer<typeof checkoutAttemptSchema>
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

const keyFor = (uid: string) => `lotus-checkout-attempt:${uid}`

export function saveCheckoutAttempt(storage: Storage, attempt: CheckoutAttempt): void {
  const validated = checkoutAttemptSchema.parse(attempt)
  storage.setItem(keyFor(validated.uid), JSON.stringify(validated))
}

export function readCheckoutAttempt(storage: Storage, uid: string): CheckoutAttempt | null {
  try {
    const raw = storage.getItem(keyFor(uid))
    if (!raw) return null
    const parsed = checkoutAttemptSchema.safeParse(JSON.parse(raw))
    return parsed.success && parsed.data.uid === uid ? parsed.data : null
  } catch {
    return null
  }
}

export function clearCheckoutAttempt(storage: Storage, uid: string): void {
  storage.removeItem(keyFor(uid))
}
