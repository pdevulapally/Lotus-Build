'use client'

import type { BackendSessionUsage, BackendUsage } from '@/lib/backend/client'
import { quantityWithUnit } from '@/lib/plans/format'
import { groupUsageMeters, meterProgress, usagePeriod, type UsageMeter as Meter } from '@/lib/settings/usage'

export function UsageMeter({ meter }: { meter: Meter }) {
  const { limit, percent, atLimit } = meterProgress(meter)
  return (
    <section className="py-5 first:pt-0" aria-labelledby={`usage-${meter.meterKey}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={`usage-${meter.meterKey}`} className="text-sm font-medium">{meter.label}</h4>
        {atLimit && <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-warning-soft-foreground">{limit === 0 ? 'No allowance' : 'Limit reached'}</span>}
      </header>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 tabular-nums">
        <span className="text-xl font-semibold tracking-tight">{quantityWithUnit(meter.unit, meter.totalUsed)}</span>
        <span className="text-xs text-muted-foreground">{limit !== null ? `of ${quantityWithUnit(meter.unit, limit)}` : '· Unlimited'}</span>
      </p>
      {percent !== null && limit !== null && limit > 0 && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${meter.label} including reservations`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(meter.totalUsed, limit)} aria-valuetext={`${quantityWithUnit(meter.unit, meter.totalUsed)} of ${quantityWithUnit(meter.unit, limit)}, including ${quantityWithUnit(meter.unit, meter.reserved)} reserved`}>
          <span className={`block h-full rounded-full ${atLimit ? 'bg-warning-soft-foreground' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
        </span>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{usagePeriod(meter)}</p>
      <p className="mt-1 text-xs leading-relaxed tabular-nums text-muted-foreground">{quantityWithUnit(meter.unit, meter.consumed)} used · {quantityWithUnit(meter.unit, meter.reserved)} reserved</p>
    </section>
  )
}

export function AccountUsage({ usage }: { usage: BackendUsage | null }) {
  if (!usage) return <p className="text-sm text-muted-foreground">Usage is unavailable. Refresh to try again.</p>
  if (usage.meters.length === 0) return <p className="text-sm text-muted-foreground">No usage has been reported for your account yet.</p>
  const groups = groupUsageMeters(usage.meters)
  return (
    <section className="space-y-7" aria-label="Account usage">
      <p className="text-xs leading-relaxed text-muted-foreground">Totals include usage already recorded and reservations held for work in progress. Reservations can change when a task finishes. Different limits are not added together.</p>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`usage-group-${group.key}`}>
          <header className="mb-4">
            <h3 id={`usage-group-${group.key}`} className="text-sm font-semibold">{group.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
          </header>
          <section className="divide-y divide-border/60">{group.meters.map((meter) => <UsageMeter key={meter.meterKey} meter={meter} />)}</section>
        </section>
      ))}
    </section>
  )
}

export function SessionUsage({ usage, error, loading }: { usage: BackendSessionUsage | null; error: string | null; loading: boolean }) {
  if (error) return <p role="alert" className="text-sm text-destructive">Session usage could not be loaded. {error}</p>
  if (!usage) return <p role="status" className="text-sm text-muted-foreground">{loading ? 'Loading session usage…' : 'Session usage is unavailable. Refresh to try again.'}</p>
  return (
    <section aria-label="Session usage">
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">Usage reported for this session across its runs. Account limits apply across all your projects, so these figures will differ from your account totals.</p>
      {usage.meters.length === 0 ? <p className="text-sm text-muted-foreground">No usage has been reported for this session yet.</p> : (
        <section className="divide-y divide-border/60">
          {usage.meters.map((meter) => <dl key={meter.meterKey} className="py-4 first:pt-0">
            <dt className="text-sm font-medium">{meter.label}</dt>
            <dd className="mt-2 space-y-1 text-sm tabular-nums">
              <p>{quantityWithUnit(meter.unit, meter.settled)} used</p>
              <p className="text-xs text-muted-foreground">{quantityWithUnit(meter.unit, meter.open)} reserved for work in progress</p>
            </dd>
          </dl>)}
        </section>
      )}
    </section>
  )
}
