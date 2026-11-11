import { z } from 'zod'
import { formatStripeAmount } from './currency'

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const quantity = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const creditOfferSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), version: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  credits: positive, amountMinor: positive, currency: z.string().regex(/^[a-z]{3}$/),
  expirySeconds: positive.max(315360000).nullable(),
  expiryCalendarMonths: positive.max(120).optional(),
  pacingPolicy: z.enum(['respect', 'bypass_paid']),
}).refine(offer => offer.expiryCalendarMonths === undefined || offer.expirySeconds === null, {
  message: 'Calendar-month expiry requires null expirySeconds.', path: ['expiryCalendarMonths'],
})
export const billingCreditsSchema = z.object({
  portalAvailable: z.boolean(), pendingPurchaseId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), purchasing: z.object({ enabled: z.boolean(), reason: z.string().nullable() }),
  wallet: z.object({ availableCredits: quantity, reservedCredits: quantity, bypassAvailableCredits: quantity }).nullable(), offers: z.array(creditOfferSchema),
})
export const creditCheckoutSchema = z.object({
  purchaseId: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password && !u.port }, 'Invalid Stripe checkout URL').nullable(),
  expiresAt: positive,
})
export const creditPurchaseSchema = z.object({
  purchaseId: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(['pending', 'paid', 'expired', 'refunded', 'disputed']),
  credits: quantity, revokedCredits: quantity, expiresAt: positive,
})
export type CreditOffer = z.infer<typeof creditOfferSchema>
export type BillingCredits = z.infer<typeof billingCreditsSchema>
export type CreditPurchase = z.infer<typeof creditPurchaseSchema>
export type CreditCheckout = z.infer<typeof creditCheckoutSchema>

export function creditPrice(offer: CreditOffer) {
  return formatStripeAmount(offer.amountMinor, offer.currency, { currencyDisplay: 'code' })
}

export function creditExpiry(offer: Pick<CreditOffer, 'expirySeconds' | 'expiryCalendarMonths'>) {
  const { expirySeconds: seconds, expiryCalendarMonths: months } = offer
  if (months !== undefined) return `Credits expire ${months.toLocaleString('en-GB')} calendar month${months === 1 ? '' : 's'} after payment (UTC). Month-end dates use the last day of the month when needed.`
  if (seconds === null) return 'Credits do not expire.'
  for (const [unit, divisor] of [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]] as const) {
    if (seconds % divisor === 0) { const count = seconds / divisor; return `Credits expire ${count.toLocaleString('en-GB')} ${unit}${count === 1 ? '' : 's'} after payment.` }
  }
  return 'Credit expiry is unavailable.'
}
export function creditPurchaseMessage(purchase: CreditPurchase) {
  switch (purchase.status) {
    case 'paid': return `Payment confirmed for ${purchase.credits.toLocaleString('en-GB')} credits.`
    case 'pending': return 'Payment is not confirmed yet. Refresh to check again before starting another purchase.'
    case 'expired': return 'This checkout expired. No payment was confirmed for it.'
    case 'refunded': return `Payment refunded. ${purchase.revokedCredits.toLocaleString('en-GB')} credits revoked.`
    case 'disputed': return 'This payment is disputed. Credits may be unavailable.'
  }
}

