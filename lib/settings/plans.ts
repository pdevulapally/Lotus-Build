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
  // Per-seat plans are bought by an organisation, never by an account; the server refuses them here.
  const ordered = plans.filter((plan) => !plan.billing.perSeat).sort((a, b) => a.rank - b.rank)
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

/**
 * Stripe's preview as the customer reads it. The change is prorated (`create_prorations`): the
 * difference for the rest of the period becomes a line on the next invoice, not a charge taken
 * now, and the preview total is that invoice as it stands — renewal included — not a locked quote.
 */
export function describeChangeCharge(preview: { amountDueMinor: number; currency: string }): string {
  if (preview.amountDueMinor <= 0) return 'Estimated: nothing more to pay. Unused time on your current plan is credited to your next invoice, which is settled when it is issued.'
  const { amount } = formatPlanPrice({ amountMinor: preview.amountDueMinor, currency: preview.currency, interval: 'month' })
  return `Your next invoice is estimated at ${amount}: the prorated difference for the rest of this billing period, then the new plan's price. The final figure is set when the invoice is issued.`
}

/** What the server says the subscription now is, after a change — never what was asked for. */
export function describeSubscriptionOutcome(
  subscription: { planKey: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string } | null,
  plans: readonly { key: string; name: string }[] | null,
): string {
  if (subscription === null) return 'You no longer have a paid plan.'
  const name = plans?.find((plan) => plan.key === subscription.planKey)?.name ?? subscription.planKey
  const end = longDate(subscription.currentPeriodEnd)
  return subscription.cancelAtPeriodEnd
    ? `You are on ${name} until ${end}, when it ends. You keep everything it includes until then.`
    : `You are on ${name}. It renews on ${end}.`
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
}
