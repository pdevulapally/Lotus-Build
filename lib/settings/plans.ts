import type { BackendAccount, BackendPlan, BackendSubscription } from '@/lib/backend/client'
import { formatPlanPrice } from '@/lib/plans/format'

/**
 * What choosing a plan would do for this account. Derived from the server's
 * plans, the account's plan and the live subscription; nothing is stored.
 *
 * - `current`: the plan the account is on.
 * - `subscribe`: no subscription yet, so a paid plan goes through checkout.
 * - `upgrade` / `downgrade`: an existing subscription changes price in place.
 * - `cancel`: the free plan for a subscriber means letting the paid plan end.
 */
export type PlanRelation = 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'cancel'

export interface PlanChoice {
  readonly plan: BackendPlan
  readonly relation: PlanRelation
  readonly price: { amount: string; interval: string } | null
}

export function planChoices(plans: readonly BackendPlan[], account: BackendAccount, subscription: BackendSubscription | null): readonly PlanChoice[] {
  const ordered = [...plans].sort((a, b) => a.rank - b.rank)
  const current = ordered.find((plan) => plan.key === account.plan.key)
  return ordered.map((plan) => ({
    plan,
    price: plan.price ? formatPlanPrice(plan.price) : null,
    relation: plan.key === account.plan.key ? 'current'
      : subscription === null ? (plan.price ? 'subscribe' : 'current')
        : !plan.price ? 'cancel'
          : current === undefined || plan.rank > current.rank ? 'upgrade' : 'downgrade',
  }))
}

export const relationLabels: Readonly<Record<Exclude<PlanRelation, 'current'>, string>> = {
  subscribe: 'Choose', upgrade: 'Upgrade', downgrade: 'Downgrade', cancel: 'Switch at renewal',
}

/** Stripe's preview amount as the customer reads it: a charge today, or nothing to pay now. */
export function describeChangeCharge(preview: { amountDueMinor: number; currency: string }): string {
  if (preview.amountDueMinor <= 0) return 'Nothing to pay today. Unused time on your current plan is credited to your next invoice.'
  const { amount } = formatPlanPrice({ amountMinor: preview.amountDueMinor, currency: preview.currency, interval: 'month' })
  return `${amount} is charged today for the rest of this billing period. Your next invoice is at the new plan's price.`
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}
