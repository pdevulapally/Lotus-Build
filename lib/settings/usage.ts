import type { BackendUsage } from '@/lib/backend/client'
import { formatAllowanceValue } from '@/lib/plans/format'

export type UsageMeter = BackendUsage['meters'][number]

/**
 * What the Usage page shows: one AI allowance as the headline (the combined
 * meter when the server runs it, else the legacy output meter), its daily
 * pacing when the plan has one, and every other allowance as a row. Decided by
 * the role the server gives each meter, never by its key.
 */
export interface UsageOverview {
  readonly ai: { readonly monthly: UsageMeter; readonly daily?: UsageMeter } | null
  readonly rows: readonly UsageMeter[]
}

const aiRoles = ['ai.allowance', 'ai.pacing', 'ai.input', 'ai.output', 'ai.fallback.input', 'ai.fallback.output']

export function usageOverview(usage: Pick<BackendUsage, 'meters'>): UsageOverview {
  const byRole = (role: string) => usage.meters.find((meter) => meter.role === role)
  const combined = byRole('ai.allowance')
  const monthly = combined ?? byRole('ai.output')
  if (monthly === undefined) return { ai: null, rows: usage.meters }
  // Under the combined allowance the legacy and fallback token meters are not spent, so they are not shown;
  // under the legacy meters only the headline output meter and the bounded fallback lane leave the list.
  const hidden = new Set(combined !== undefined ? aiRoles : ['ai.output', 'ai.fallback.input', 'ai.fallback.output'])
  const daily = combined !== undefined ? byRole('ai.pacing') : undefined
  return {
    ai: { monthly, ...(daily === undefined ? {} : { daily }) },
    rows: usage.meters.filter((meter) => !hidden.has(meter.role ?? '')),
  }
}

/**
 * "Used of limit" in one unit: durations and sizes read as the limit does ("21 min of 1 hour",
 * "40 MB of 100 MB"); counted things keep the exact figure against a rounded limit ("128,400 of 300K tokens").
 */
export function usedOfLimit(meter: Pick<UsageMeter, 'unit' | 'totalUsed' | 'hardLimit'>): string {
  const limit = limitOf(meter)
  const exact = meter.unit === 'tokens' || meter.unit === 'count'
  const used = exact ? meter.totalUsed.toLocaleString('en-GB') : formatAllowanceValue(meter.unit, meter.totalUsed)
  if (limit !== null) return `${used} of ${formatAllowanceValue(meter.unit, limit)}`
  return `${exact ? formatAllowanceValue(meter.unit, meter.totalUsed) : used} used${meter.hardLimit === 'unlimited' ? ' · Unlimited' : ''}`
}

/** A numeric limit draws a bar; "unlimited" is stated by the server, and a zero is neither. */
export function limitOf(meter: Pick<UsageMeter, 'hardLimit'>): number | null {
  return typeof meter.hardLimit === 'number' && meter.hardLimit > 0 ? meter.hardLimit : null
}

export function usedFraction(meter: Pick<UsageMeter, 'hardLimit' | 'totalUsed'>): number | null {
  const limit = limitOf(meter)
  return limit === null ? null : Math.min(meter.totalUsed / limit, 1)
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** When the allowance comes back, from the window the server reports; windows are UTC, as the server counts them. */
export function resetLabel(meter: Pick<UsageMeter, 'resetPeriod' | 'periodStart'>, now: Date = new Date()): string {
  const start = new Date(meter.periodStart)
  switch (meter.resetPeriod) {
    case 'DAILY': {
      const end = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1)
      return end - now.getTime() <= 24 * 60 * 60 * 1000 && end > now.getTime() ? 'Resets tomorrow' : `Resets ${dayMonth.format(end)}`
    }
    case 'MONTHLY': return `Resets ${dayMonth.format(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))}`
    default: return 'Does not reset'
  }
}
