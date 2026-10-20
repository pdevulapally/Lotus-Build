import type { BackendPlan } from '@/lib/backend/client'

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

/** "Included" value plus an "up to" ceiling only when the server reports a higher hard limit. */
export function describeAllowance(allowance: Allowance): { included: string; ceiling?: string } {
  const included = formatAllowanceValue(allowance.unit, allowance.included)
  if (allowance.limit <= allowance.included) return { included }
  return { included, ceiling: `up to ${formatAllowanceValue(allowance.unit, allowance.limit)}` }
}

export function formatPlanPrice(price: NonNullable<BackendPlan['price']>): { amount: string; interval: string } {
  const digits = new Intl.NumberFormat('en-GB', { style: 'currency', currency: price.currency }).resolvedOptions().maximumFractionDigits
  if (typeof digits !== 'number') throw new Error('Currency precision is unavailable.')
  const whole = price.amountMinor % 10 ** digits === 0
  const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency: price.currency, minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: digits })
  const amount = format.format(price.amountMinor / 10 ** digits)
  return { amount, interval: `per ${price.interval}` }
}

/** The plan to visually feature: the highest-ranked paid plan that still has a cheaper paid sibling, else the cheapest paid plan. */
export function featuredPlanKey(plans: readonly BackendPlan[]): string | undefined {
  const paid = plans.filter((plan) => plan.price).sort((a, b) => a.rank - b.rank)
  if (paid.length === 0) return undefined
  return (paid.length >= 3 ? paid[paid.length - 2] : paid[0])?.key
}
