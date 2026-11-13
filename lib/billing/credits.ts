import { z } from 'zod'
import { formatStripeAmount, stripeChargeDigits } from './currency'

const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const quantity = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
export const creditTaskSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  checkpointId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
}).strict()
export type CreditTask = z.infer<typeof creditTaskSchema>
export const creditOfferSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), version: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  credits: positive, amountMinor: positive, currency: z.string().regex(/^[a-z]{3}$/),
  expirySeconds: z.null(),
  expiryCalendarMonths: z.never().optional(),
  pacingPolicy: z.enum(['respect', 'bypass_paid']),
  customAmountMinor: positive.optional(),
})
const customCreditPricingSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), version: creditOfferSchema.shape.version,
  currency: creditOfferSchema.shape.currency, minAmountMinor: positive, maxAmountMinor: positive,
  stepAmountMinor: positive, creditsPerStep: positive, pacingPolicy: creditOfferSchema.shape.pacingPolicy,
}).refine(value => value.minAmountMinor <= value.maxAmountMinor && value.minAmountMinor % value.stepAmountMinor === 0 &&
  value.maxAmountMinor % value.stepAmountMinor === 0 &&
  BigInt(value.maxAmountMinor / value.stepAmountMinor) * BigInt(value.creditsPerStep) <= BigInt(Number.MAX_SAFE_INTEGER), 'Invalid custom top-up configuration.')
export const billingCreditsSchema = z.object({
  portalAvailable: z.boolean(), pendingPurchaseId: z.string().regex(/^[a-f0-9]{64}$/).nullable(), purchasing: z.object({ enabled: z.boolean(), reason: z.string().nullable() }),
  wallet: z.object({ availableCredits: quantity, reservedCredits: quantity, bypassAvailableCredits: quantity }).nullable(), offers: z.array(creditOfferSchema),
  customTopUp: customCreditPricingSchema.optional(),
})
export const creditCheckoutSchema = z.object({
  purchaseId: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password && !u.port }, 'Invalid Stripe checkout URL').nullable(),
  expiresAt: positive,
})
export const creditPurchaseSchema = z.object({
  purchaseId: z.string().regex(/^[a-f0-9]{64}$/), status: z.enum(['pending', 'paid', 'expired', 'refunded', 'disputed']),
  credits: quantity, revokedCredits: quantity, expiresAt: positive,
  continuation: z.object({ sessionId: creditTaskSchema.shape.sessionId,
    status: z.enum(['queued', 'active', 'finished', 'blocked']) }).optional(),
})
export type CreditOffer = z.infer<typeof creditOfferSchema>
export type BillingCredits = z.infer<typeof billingCreditsSchema>
export type CreditPurchase = z.infer<typeof creditPurchaseSchema>
export type CreditCheckout = z.infer<typeof creditCheckoutSchema>
export type CreditChoice = Pick<CreditOffer, 'id' | 'version' | 'customAmountMinor'>
export type CustomCreditPricing = z.infer<typeof customCreditPricingSchema>

/** Parse the entered currency amount exactly; never round floating-point money. */
export function customAmountMinor(value: string, currency: string): number | null {
  const digits = stripeChargeDigits(currency)
  if (value.length > 20 || !new RegExp(`^\\d+${digits ? `(?:\\.\\d{1,${digits}})?` : ''}$`).test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  const amount = BigInt(whole!) * BigInt(10 ** digits) + BigInt(fraction.padEnd(digits, '0') || '0')
  return amount > BigInt(0) && amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null
}

export function customCreditOffer(pricing: CustomCreditPricing | undefined, amountMinor: number | null): CreditOffer | null {
  if (!pricing || amountMinor === null || !Number.isSafeInteger(amountMinor) || amountMinor < pricing.minAmountMinor ||
    amountMinor > pricing.maxAmountMinor || amountMinor % pricing.stepAmountMinor !== 0) return null
  const credits = BigInt(amountMinor / pricing.stepAmountMinor) * BigInt(pricing.creditsPerStep)
  if (credits > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return { id:`${pricing.id}-${amountMinor}`, version:pricing.version, credits:Number(credits), amountMinor,
    currency:pricing.currency, expirySeconds:null, pacingPolicy:pricing.pacingPolicy, customAmountMinor:amountMinor }
}

export function creditChoiceAvailable(data: BillingCredits | null, choice: CreditChoice): boolean {
  if (choice.customAmountMinor !== undefined) {
    const offer = customCreditOffer(data?.customTopUp, choice.customAmountMinor)
    return offer?.id === choice.id && offer?.version === choice.version
  }
  return data?.offers.some(offer => offer.id === choice.id && offer.version === choice.version) === true
}

export function creditPrice(offer: CreditOffer) {
  return formatStripeAmount(offer.amountMinor, offer.currency, { currencyDisplay: 'code' })
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

