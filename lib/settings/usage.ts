import type { BackendUsage } from '@/lib/backend/client'

export type UsageMeter = BackendUsage['meters'][number]
export type UsageGroup = { key: string; title: string; description: string; meters: UsageMeter[] }

const groups = [
  { key: 'ai', title: 'AI usage', description: 'Your shared AI allowance across projects and models.', roles: ['ai.allowance', 'ai.pacing'] },
  { key: 'tokens', title: 'Model usage details', description: 'Token usage reported for your account.', roles: ['ai.input', 'ai.output'] },
  { key: 'fallback', title: 'Previous model usage', description: 'Usage recorded before models shared one credit balance.', roles: ['ai.fallback.input', 'ai.fallback.output'] },
  { key: 'workspace', title: 'Workspace', description: 'Your storage and workspace resources.', roles: ['sandbox.time', 'sandbox.concurrency', 'storage'] },
] as const

/** Only the server's semantic role groups a meter. Unknown/older responses remain visible. Never sum unlike meters. */
export function groupUsageMeters(reportedMeters: readonly UsageMeter[]): UsageGroup[] {
  const meters = reportedMeters.filter(meter => meter.role !== 'build')
  const assigned = new Set<string>()
  const result: UsageGroup[] = groups.map((group) => ({ ...group, meters: meters.filter((meter) => {
    const included = meter.role !== undefined && (group.roles as readonly string[]).includes(meter.role)
    if (included) assigned.add(meter.meterKey)
    return included
  }) }))
  result.push({ key: 'other', title: 'Other usage', description: 'Additional usage reported for your account.', meters: meters.filter((meter) => !assigned.has(meter.meterKey)) })
  // Older servers can still enforce token allowances. Keep these visible until
  // the server reports a shared allowance; never invent a conversion between them.
  if (!meters.some(meter => meter.role === 'ai.allowance')) {
    const tokens = result.find(group => group.key === 'tokens')!
    result.find(group => group.key === 'ai')!.meters.push(...tokens.meters)
    tokens.meters = []
  }
  return result.filter((group) => group.meters.length > 0)
}

/** Prepaid usage remains in totals but must not be counted against the included plan twice. */
export function planMeterUsage(meter: UsageMeter) {
  return {
    consumed: meter.consumed - (meter.prepaidConsumed ?? 0),
    reserved: meter.reserved - (meter.prepaidReserved ?? 0),
    totalUsed: meter.totalUsed - (meter.prepaidConsumed ?? 0) - (meter.prepaidReserved ?? 0),
  }
}

export function meterProgress(meter: UsageMeter) {
  const { totalUsed } = planMeterUsage(meter)
  const limit = typeof meter.hardLimit === 'number' ? meter.hardLimit : null
  return {
    limit,
    // Zero is a real ceiling, not missing or unlimited. No NaN / Infinity in the bar.
    percent: limit === null ? null : limit > 0 ? Math.min(100, totalUsed / limit * 100) : totalUsed > 0 ? 100 : 0,
    atLimit: limit !== null && totalUsed >= limit,
  }
}

export const resetLabels = { NEVER: 'Does not reset', DAILY: 'Resets daily', MONTHLY: 'Resets monthly' } as const

export function usagePeriod(meter: UsageMeter): string {
  if (meter.resetPeriod === 'NEVER') return resetLabels.NEVER
  // Meter boundaries are UTC; avoid showing the previous date in western time zones.
  const started = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(meter.periodStart))
  return `${resetLabels[meter.resetPeriod]} · Period started ${started} (UTC)`
}

/** Server metering uses UTC calendar windows, independent of Stripe billing dates. */
export function usageReset(meter: UsageMeter): string {
  if (meter.resetPeriod === 'NEVER') return 'Does not reset'
  const start = new Date(meter.periodStart)
  const next = meter.resetPeriod === 'MONTHLY'
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1))
  return `Resets ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(next)} at 00:00 UTC`
}

export function remainingAllowance(meter: UsageMeter): string {
  const { limit } = meterProgress(meter)
  if (limit === null) return 'Unlimited'
  if (limit === 0) return 'No allowance'
  const { totalUsed } = planMeterUsage(meter)
  if (totalUsed >= limit) return 'Limit reached'
  const percent = (limit - totalUsed) / limit * 100
  return `${percent < 0.1 ? '<0.1' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(percent)}% remaining`
}
