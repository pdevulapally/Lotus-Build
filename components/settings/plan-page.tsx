import { Check, CreditCard } from 'lucide-react'
import type { BackendAccount, BackendPlan, BackendSubscription, BackendUsage } from '@/lib/backend/client'
import { formatAllowanceValue } from '@/lib/plans/format'
import { longDate, planChoices, relationLabels } from '@/lib/settings/plans'
import { usageOverview } from '@/lib/settings/usage'
import { Button } from '@/components/ui/button'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

export interface PlanPageProps {
  account: BackendAccount
  usage: BackendUsage | null
  plans: readonly BackendPlan[] | null
  subscription: BackendSubscription | null | undefined
  busy: boolean
  onSubscribe: (plan: BackendPlan) => void
  onChangePlan: (plan: BackendPlan, relation: 'upgrade' | 'downgrade') => void
  onSetCancellation: (cancelAtPeriodEnd: boolean) => void
  onManageBilling: () => void
}

export function PlanPage({ account, usage, plans, subscription, busy, onSubscribe, onChangePlan, onSetCancellation, onManageBilling }: PlanPageProps) {
  // What the plan includes is read from the same meters the Usage page shows, so the two never disagree.
  const included = usage === null ? [] : (() => {
    const overview = usageOverview(usage)
    return [...(overview.ai ? [overview.ai.monthly, ...(overview.ai.daily ? [overview.ai.daily] : [])] : []), ...overview.rows]
      .filter((meter) => typeof meter.includedAllowance === 'number' ? meter.includedAllowance > 0 : true)
  })()
  const live = subscription ?? null
  const renewal = live === null ? null : live.cancelAtPeriodEnd
    ? `Your ${account.plan.name} plan ends on ${longDate(live.currentPeriodEnd)}.`
    : `Renews on ${longDate(live.currentPeriodEnd)}.`
  return (
    <div>
      <SettingsSection title="Your plan">
        <SettingsRow label={account.plan.name} description={renewal ?? (account.subscriptionStatus ? `Subscription ${account.subscriptionStatus.toLowerCase().replace(/_/g, ' ')}.` : 'Included with every account.')}>
          {live !== null && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onSetCancellation(!live.cancelAtPeriodEnd)}>
              {live.cancelAtPeriodEnd ? 'Resume plan' : 'Cancel at renewal'}
            </Button>
          )}
          <Button type="button" size="sm" variant={live === null ? 'outline' : 'ghost'} disabled={busy} onClick={onManageBilling}><CreditCard aria-hidden="true" />Invoices &amp; payment</Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Change plan">
        {plans === null || subscription === undefined ? (
          <p className="py-3 text-sm text-muted-foreground">Loading plans…</p>
        ) : planChoices(plans, account, live).map(({ plan, relation, price }) => (
          <SettingsRow key={plan.key} label={plan.name} description={price ? `${price.amount} ${price.interval}` : 'Free'}>
            {relation === 'current' ? (
              <SettingsBadge><Check className="size-3" aria-hidden="true" />Current</SettingsBadge>
            ) : relation === 'cancel' ? (
              live !== null && !live.cancelAtPeriodEnd && (
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onSetCancellation(true)}>{relationLabels.cancel}</Button>
              )
            ) : (
              <Button type="button" size="sm" variant={relation === 'downgrade' ? 'outline' : 'default'} disabled={busy}
                onClick={() => relation === 'subscribe' ? onSubscribe(plan) : onChangePlan(plan, relation)}>
                {relationLabels[relation]}
              </Button>
            )}
          </SettingsRow>
        ))}
      </SettingsSection>

      {included.length > 0 && (
        <SettingsSection title="What your plan includes">
          {included.map((meter) => (
            <SettingsRow key={meter.meterKey} label={meter.label}>
              <span className="tabular-nums text-muted-foreground">
                {meter.includedAllowance === 'unlimited' ? 'Unlimited' : `${formatAllowanceValue(meter.unit, meter.includedAllowance)}${meter.resetPeriod === 'DAILY' ? ' a day' : meter.resetPeriod === 'MONTHLY' ? ' a month' : ''}`}
              </span>
            </SettingsRow>
          ))}
        </SettingsSection>
      )}
    </div>
  )
}
