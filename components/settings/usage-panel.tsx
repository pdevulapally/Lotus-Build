'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { BackendSessionUsage, BackendUsage } from '@/lib/backend/client'
import { quantityWithUnit } from '@/lib/plans/format'
import { groupUsageMeters, meterProgress, planMeterUsage, remainingAllowance, usageReset, type UsageMeter as Meter } from '@/lib/settings/usage'

export function UsageMeter({ meter }: { meter: Meter }) {
  const { limit, percent, atLimit } = meterProgress(meter)
  const plan = planMeterUsage(meter)
  const hasPaidUsage = meter.prepaidConsumed !== undefined || meter.prepaidReserved !== undefined
  return <section className="grid grid-cols-1 gap-x-5 py-4 first:pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_7rem]" aria-label={meter.label}>
    <header className="flex flex-wrap items-baseline justify-between gap-2 text-sm md:contents">
      <h4 className="font-medium md:col-start-1 md:row-start-1">{meter.label}</h4>
      <p className={`text-sm tabular-nums md:col-start-3 md:row-start-1 md:text-right ${atLimit ? 'text-warning-soft-foreground' : 'text-muted-foreground'}`}>{remainingAllowance(meter)}</p>
    </header>
    {percent !== null && limit !== null && limit > 0 && <span className="mt-3 block h-1.5 md:col-start-2 md:row-start-1 md:mt-0 md:self-center overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${meter.label} including reservations`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(plan.totalUsed, limit)} aria-valuetext={`${quantityWithUnit(meter.unit, plan.totalUsed)} of ${quantityWithUnit(meter.unit, limit)}, including ${quantityWithUnit(meter.unit, plan.reserved)} reserved`}>
      <span className={`block h-full rounded-full ${atLimit ? 'bg-warning-soft-foreground' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
    </span>}
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground md:col-start-1 md:row-start-2">{usageReset(meter)}</p>
    <details className="group mt-2 text-xs text-muted-foreground md:col-span-2 md:col-start-2 md:row-start-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">View details</span><span className="hidden group-open:inline">Hide details</span><span className="sr-only"> for {meter.label}</span><ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 pb-2 tabular-nums">
        <dt>{hasPaidUsage ? 'Plan used' : 'Used'}</dt><dd className="text-right text-foreground">{quantityWithUnit(meter.unit, plan.consumed)}</dd>
        <dt>{hasPaidUsage ? 'Plan reserved' : 'Reserved'}</dt><dd className="text-right text-foreground">{quantityWithUnit(meter.unit, plan.reserved)}</dd>
        <dt>Limit</dt><dd className="text-right text-foreground">{limit === null ? 'Unlimited' : quantityWithUnit(meter.unit, limit)}</dd>
        {limit !== null && <><dt>Remaining</dt><dd className="text-right text-foreground">{quantityWithUnit(meter.unit, Math.max(0, limit - plan.totalUsed))}</dd></>}
        {hasPaidUsage && <><dt>Paid credits used</dt><dd className="text-right text-foreground">{quantityWithUnit(meter.unit, meter.prepaidConsumed ?? 0)}</dd><dt>Paid credits reserved</dt><dd className="text-right text-foreground">{quantityWithUnit(meter.unit, meter.prepaidReserved ?? 0)}</dd></>}
      </dl>
      <p className="pb-2 leading-relaxed">Reservations hold space for work in progress and may change when it finishes.</p>
    </details>
  </section>
}


export function AccountUsage({ usage, onNavigate, showManagePlan = true, onDemand }: { usage: BackendUsage | null; onNavigate?: () => void; showManagePlan?: boolean; onDemand?: ReactNode }) {
  if (!usage) return <section className="space-y-5"><p className="text-sm text-muted-foreground">Usage is unavailable. Refresh to try again.</p>{onDemand}</section>
  if (usage.meters.length === 0) return <section className="space-y-5"><p className="text-sm text-muted-foreground">No usage has been reported for your account yet.</p>{onDemand}</section>
  const groups = groupUsageMeters(usage.meters)
  const primary = groups.find((group) => group.key === 'ai')
  const other = groups.filter((group) => group.key !== 'ai')
  return <section className="space-y-5" aria-label="Account usage">
    <header className="flex flex-wrap items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold">{usage.plan.name} plan allowance</h3>
      {showManagePlan && <Link href="/account/billing" onClick={onNavigate} className="text-xs text-muted-foreground underline underline-offset-4">Manage plan</Link>}
    </header>
    {primary ? <section aria-label="AI allowance">
      {primary.meters.map((meter) => <UsageMeter key={meter.meterKey} meter={meter} />)}
      {primary.meters.length > 1 && <p className="text-xs leading-relaxed text-muted-foreground">Each allowance is separate. Remaining usage includes reservations for work in progress.</p>}
    </section> : <p className="text-sm text-muted-foreground">An AI allowance summary is not available for this account. View reported usage below.</p>}
    {onDemand}
    {other.length > 0 && <section className="border-t border-border/60 pt-5" aria-label="Other usage">
      <h3 className="text-sm font-semibold">Other usage</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Workspace and additional allowances. Choose View details for exact usage and reservations.</p>
      <section className="mt-5 space-y-5">
        {other.map((group) => <section key={group.key} aria-label={group.title}>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.key === 'other' ? 'Additional allowances' : group.title}</h4>
          {group.meters.map((meter) => <UsageMeter key={meter.meterKey} meter={meter} />)}
        </section>)}
      </section>
    </section>}
  </section>
}

export function SessionUsage({ usage, error, loading }: { usage: BackendSessionUsage | null; error: string | null; loading: boolean }) {
  if (error) return <p role="alert" className="text-sm text-destructive">Session usage could not be loaded. {error}</p>
  if (!usage) return <p role="status" className="text-sm text-muted-foreground">{loading ? 'Loading session usage…' : 'Session usage is unavailable. Refresh to try again.'}</p>
  return <section aria-label="Session usage">
    <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Usage for this session across its runs, including earlier billing periods. Account allowances apply across all projects.</p>
    {usage.meters.length === 0 ? <p className="text-sm text-muted-foreground">No usage has been reported for this session yet.</p> : <section className="divide-y divide-border/60">
      {usage.meters.map((meter) => <dl key={meter.meterKey} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
        <dt>{meter.label}</dt>
        <dd className="tabular-nums"><p>{quantityWithUnit(meter.unit, meter.settled)} used</p><p className="mt-1 text-xs text-muted-foreground">{quantityWithUnit(meter.unit, meter.open)} reserved</p></dd>
      </dl>)}
    </section>}
  </section>
}
