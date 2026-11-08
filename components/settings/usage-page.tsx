import { RefreshCw } from 'lucide-react'
import type { BackendUsage } from '@/lib/backend/client'
import { formatAllowanceValue } from '@/lib/plans/format'
import { limitOf, resetLabel, usageOverview, usedFraction, usedOfLimit, type UsageMeter } from '@/lib/settings/usage'
import { Button } from '@/components/ui/button'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

function amount(meter: Pick<UsageMeter, 'unit'>, value: number): string {
  return formatAllowanceValue(meter.unit, value)
}

function Bar({ meter, height = 'h-1.5', label }: { meter: UsageMeter; height?: string; label: string }) {
  const limit = limitOf(meter)
  const fraction = usedFraction(meter)
  if (limit === null || fraction === null) return null
  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full bg-muted`}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(meter.totalUsed, limit)}
      aria-valuetext={`${meter.totalUsed.toLocaleString('en-GB')} of ${amount(meter, limit)}`}
    >
      <div className={`h-full rounded-full transition-[width] ${fraction >= 1 ? 'bg-warning-soft-foreground' : 'bg-primary'}`} style={{ width: `${fraction * 100}%` }} />
    </div>
  )
}

function atLimit(meter: UsageMeter): boolean {
  const limit = limitOf(meter)
  return limit !== null && meter.totalUsed >= limit
}

/** The one AI allowance, as a single figure and bar; the day's share underneath when the plan paces it. */
function AiAllowance({ monthly, daily, planName }: { monthly: UsageMeter; daily?: UsageMeter; planName: string }) {
  return (
    <section aria-labelledby="usage-ai" className="rounded-xl border border-border/70 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="usage-ai" className="text-sm font-semibold tracking-tight">AI usage</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{planName} plan · {resetLabel(monthly)}</p>
        </div>
        {atLimit(monthly) && <SettingsBadge tone="warning">Limit reached</SettingsBadge>}
      </div>
      <p className="mt-4 text-[26px] font-semibold tabular-nums tracking-tight">
        {monthly.totalUsed.toLocaleString('en-GB')}
        {limitOf(monthly) !== null && <span className="ml-1.5 text-sm font-normal text-muted-foreground">of {amount(monthly, limitOf(monthly)!)}</span>}
      </p>
      <div className="mt-3"><Bar meter={monthly} label="AI usage this month" /></div>
      {daily && (
        <div className="mt-5 border-t border-border/70 pt-4">
          <div className="flex items-baseline justify-between gap-4 text-[13px]">
            <p className="font-medium">Today</p>
            <p className="tabular-nums text-muted-foreground">{usedOfLimit(daily)}{atLimit(daily) ? ` · ${resetLabel(daily).toLowerCase()}` : ''}</p>
          </div>
          <div className="mt-2"><Bar meter={daily} height="h-1" label="AI usage today" /></div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Your month is spread across each day, so there is always something left for tomorrow.</p>
        </div>
      )}
    </section>
  )
}

export function UsagePage({ usage, busy, onRefresh }: { usage: BackendUsage | null; busy: boolean; onRefresh: () => void }) {
  if (usage === null) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm leading-relaxed text-muted-foreground">Usage is unavailable right now. Refresh to try again.</p>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRefresh}><RefreshCw aria-hidden="true" />Refresh</Button>
      </div>
    )
  }
  const overview = usageOverview(usage)
  if (overview.ai === null && overview.rows.length === 0) {
    return <p className="text-sm leading-relaxed text-muted-foreground">No usage has been recorded yet.</p>
  }
  return (
    <div>
      {overview.ai && <AiAllowance monthly={overview.ai.monthly} daily={overview.ai.daily} planName={usage.plan.name} />}
      {overview.rows.length > 0 && (
        <SettingsSection title="Other allowances">
          {overview.rows.map((meter) => (
            <SettingsRow key={meter.meterKey} label={meter.label} description={resetLabel(meter)}>
              <div className="w-full sm:w-56">
                <p className="flex items-center justify-end gap-2 text-[13px] tabular-nums text-muted-foreground">
                  {atLimit(meter) && <SettingsBadge tone="warning">Limit reached</SettingsBadge>}
                  {usedOfLimit(meter)}
                </p>
                <div className="mt-2"><Bar meter={meter} height="h-1" label={`${meter.label} usage`} /></div>
              </div>
            </SettingsRow>
          ))}
        </SettingsSection>
      )}
      <div className="pt-6">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRefresh}><RefreshCw aria-hidden="true" />Refresh usage</Button>
      </div>
    </div>
  )
}
