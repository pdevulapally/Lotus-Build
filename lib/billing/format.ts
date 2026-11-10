import type { BackendSubscription } from '@/lib/backend/client'
import { formatPlanPrice } from '@/lib/plans/format'

export function subscriptionPrice(subscription: BackendSubscription) {
  const { price } = subscription
  const { amount } = formatPlanPrice({ ...price, amountMinor: price.recurringSubtotalMinor })
  const interval = price.intervalCount === 1 ? `per ${price.interval}` : `every ${price.intervalCount} ${price.interval}s`
  return `${amount} ${interval}`
}
export function billingDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}
export function subscriptionStatus(subscription: BackendSubscription) {
  if (subscription.collectionPaused) return 'Payment collection paused'
  const labels = { incomplete: 'Payment incomplete', incomplete_expired: 'Payment expired', trialing: 'Trial', active: 'Active', past_due: 'Payment overdue', canceled: 'Cancelled', unpaid: 'Unpaid', paused: 'Paused' }
  return labels[subscription.stripeStatus]
}
