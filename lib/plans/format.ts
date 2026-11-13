import type { BackendPlan } from '@/lib/backend/client'
import { formatStripeAmount } from '@/lib/billing/currency'

type Allowance = BackendPlan['allowances'][number]

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function compactCount(value: number): string {
  return value >= 10_000 ? compact.format(value) : value.toLocaleString('en-GB')
}

function duration(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) { const hours = seconds / 3600; return `${hours.toLocaleString('en-GB')} ${hours === 1 ? 'hour' : 'hours'}` }
  if (seconds >= 60 && seconds % 60 === 0) { const minutes = seconds / 60; return `${minutes.toLocaleString('en-GB')} min` }
  return `${seconds.toLocaleString('en-GB')} sec`
}

function bytes(value: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let size = value; let index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  const rounded = Number.isInteger(size) ? size.toString() : size.toFixed(1).replace(/\.0$/, '')
  return `${rounded} ${units[index]}`
}

/** Human-readable quantity for a plan allowance, keyed only on the unit the server reports. */
export function formatAllowanceValue(unit: string, value: number): string {
  switch (unit) {
    case 'seconds': return duration(value)
    case 'bytes': return bytes(value)
    case 'tokens': return `${compactCount(value)} tokens`
    case 'count': return value.toLocaleString('en-GB')
    default: return `${value.toLocaleString('en-GB')} ${unit}`
  }
}

/** A quantity with its unit word, except "count", which reads as a bare number ("12", not "12 count"). */
export function quantityWithUnit(unit: string, value: number): string {
  return unit === 'count' ? value.toLocaleString('en-GB') : `${value.toLocaleString('en-GB')} ${unit}`
}

/**
 * "Included" value plus an "up to" ceiling only when the server reports a higher hard limit.
 * "Unlimited" is a value the server states explicitly (e.g. builds); it is never inferred from a zero.
 */
export function describeAllowance(allowance: Allowance): { included: string; ceiling?: string } {
  if (allowance.included === 'unlimited' || allowance.limit === 'unlimited') return { included: 'Unlimited' }
  const included = formatAllowanceValue(allowance.unit, allowance.included)
  if (allowance.limit <= allowance.included) return { included }
  return { included, ceiling: `up to ${formatAllowanceValue(allowance.unit, allowance.limit)}` }
}

const aiAllowanceOrder: Readonly<Record<string, number>> = {
  DAILY: 0,
  WEEKLY: 1,
  MONTHLY: 2,
}

export function planAllowanceLabel(allowance: Allowance): string {
  if (allowance.role === 'ai.allowance') return 'Monthly AI allowance'
  if (allowance.role === 'ai.pacing') {
    if (allowance.resetPeriod === 'DAILY') return 'Daily AI allowance'
    if (allowance.resetPeriod === 'WEEKLY') return 'Weekly AI allowance'
  }
  return allowance.label
}

export function orderedPlanAllowances(allowances: readonly Allowance[]): readonly Allowance[] {
  return [...allowances].sort((left, right) => {
    const leftOrder = left.role?.startsWith('ai.') === true
      ? aiAllowanceOrder[left.resetPeriod ?? ''] ?? 3
      : 4
    const rightOrder = right.role?.startsWith('ai.') === true
      ? aiAllowanceOrder[right.resetPeriod ?? ''] ?? 3
      : 4
    return leftOrder - rightOrder
  })
}

export function formatPlanPrice(price: NonNullable<BackendPlan['price']>): { amount: string; interval: string } {
  const amount = formatStripeAmount(price.amountMinor, price.currency, { trimWhole: true })
  return { amount, interval: `per ${price.interval}` }
}

/** The plan to visually feature: the highest-ranked paid plan that still has a cheaper paid sibling, else the cheapest paid plan. */
export function featuredPlanKey(plans: readonly BackendPlan[]): string | undefined {
  const paid = plans.filter((plan) => plan.price).sort((a, b) => a.rank - b.rank)
  if (paid.length === 0) return undefined
  return (paid.length >= 3 ? paid[paid.length - 2] : paid[0])?.key
}

type Capability = BackendPlan['capabilities'][number]

/** Numeric plan capabilities (e.g. projects) shown beside the usage allowances. "unlimited" is a value the backend states explicitly, never inferred. */
export function describeCountCapabilities(capabilities: readonly Capability[]): { key: string; label: string; value: string }[] {
  return capabilities.flatMap((capability) => capability.kind === 'number'
    ? [{ key: capability.key, label: capability.label, value: capability.value === 'unlimited' ? 'Unlimited' : compactCount(capability.value) }]
    : [])
}
