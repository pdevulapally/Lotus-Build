import { CreditCard } from 'lucide-react'
import type { BackendAccount, BackendUsage } from '@/lib/backend/client'
import { formatAllowanceValue } from '@/lib/plans/format'
import { usageOverview } from '@/lib/settings/usage'
import { Button } from '@/components/ui/button'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

export function PlanPage({ account, usage, busy, onManageBilling, onComparePlans }: {
  account: BackendAccount
  usage: BackendUsage | null
  busy: boolean
  onManageBilling: () => void
  onComparePlans: () => void
}) {
  // What the plan includes is read from the same meters the Usage page shows, so the two never disagree.
  const included = usage === null ? [] : (() => {
    const overview = usageOverview(usage)
    return [...(overview.ai ? [overview.ai.monthly, ...(overview.ai.daily ? [overview.ai.daily] : [])] : []), ...overview.rows]
      .filter((meter) => typeof meter.includedAllowance === 'number' ? meter.includedAllowance > 0 : true)
  })()
  return (
    <div>
      <SettingsSection title="Plan">
        <SettingsRow label="Current plan" description={account.subscriptionStatus ? `Subscription ${account.subscriptionStatus.toLowerCase().replace(/_/g, ' ')}.` : undefined}>
          <SettingsBadge>{account.plan.name}</SettingsBadge>
          <Button type="button" size="sm" variant="outline" onClick={onComparePlans}>Compare plans</Button>
        </SettingsRow>
        <SettingsRow label="Billing" description="Invoices, payment method and your subscription, in the billing portal.">
          <Button type="button" size="sm" disabled={busy} onClick={onManageBilling}><CreditCard aria-hidden="true" />Manage billing</Button>
        </SettingsRow>
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
