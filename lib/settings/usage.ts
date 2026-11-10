import type { BackendUsage } from '@/lib/backend/client'

export type UsageMeter = BackendUsage['meters'][number]
export type UsageGroup = { key: string; title: string; description: string; meters: UsageMeter[] }

const groups = [
  { key: 'ai', title: 'AI usage', description: 'Account-wide usage across your projects. Each limit is separate.', roles: ['ai.allowance', 'ai.pacing', 'ai.input', 'ai.output'] },
  { key: 'fallback', title: 'Free continuation', description: 'Separate usage for tasks continued on a free model.', roles: ['ai.fallback.input', 'ai.fallback.output'] },
  { key: 'workspace', title: 'Workspace', description: 'Your builds, storage and workspace resources.', roles: ['sandbox.time', 'sandbox.concurrency', 'build', 'storage'] },
] as const

/** Only the server's semantic role groups a meter. Unknown/older responses remain visible. Never sum unlike meters. */
export function groupUsageMeters(meters: readonly UsageMeter[]): UsageGroup[] {
  const assigned = new Set<string>()
  const result: UsageGroup[] = groups.map((group) => ({ ...group, meters: meters.filter((meter) => {
    const included = meter.role !== undefined && (group.roles as readonly string[]).includes(meter.role)
    if (included) assigned.add(meter.meterKey)
    return included
  }) }))
  result.push({ key: 'other', title: 'Other usage', description: 'Additional usage reported for your account.', meters: meters.filter((meter) => !assigned.has(meter.meterKey)) })
  return result.filter((group) => group.meters.length > 0)
}

export function meterProgress(meter: UsageMeter) {
  const limit = typeof meter.hardLimit === 'number' ? meter.hardLimit : null
  return {
    limit,
    // Zero is a real ceiling, not missing or unlimited. No NaN / Infinity in the bar.
    percent: limit === null ? null : limit > 0 ? Math.min(100, meter.totalUsed / limit * 100) : meter.totalUsed > 0 ? 100 : 0,
    atLimit: limit !== null && meter.totalUsed >= limit,
  }
}

export const resetLabels = { NEVER: 'Does not reset', DAILY: 'Resets daily', MONTHLY: 'Resets monthly' } as const

export function usagePeriod(meter: UsageMeter): string {
  if (meter.resetPeriod === 'NEVER') return resetLabels.NEVER
  // Meter boundaries are UTC; avoid showing the previous date in western time zones.
  const started = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(meter.periodStart))
  return `${resetLabels[meter.resetPeriod]} · Period started ${started} (UTC)`
}
