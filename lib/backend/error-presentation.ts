import { z } from 'zod'
import { BackendError } from './client'

const quotaDetails = z.object({
  label: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  limit: z.number().finite().nonnegative(),
  consumed: z.number().finite().nonnegative(),
  reserved: z.number().finite().nonnegative(),
})

export function presentRequestError(error: Error, planName?: string) {
  const isQuota = error instanceof BackendError && error.code === 'usage/limit-reached'
  const quota = isQuota ? quotaDetails.safeParse(error.details) : null
  return {
    isQuota,
    title: isQuota ? 'Plan limit reached' : 'Couldn’t complete your request',
    description: isQuota
      ? quota?.success
        ? `Your ${planName ? `${planName} ` : ''}plan allows up to ${quota.data.limit.toLocaleString()} ${quota.data.label.toLowerCase()}${quota.data.unit === 'count' ? '' : ` (${quota.data.unit})`}. This request would exceed that allowance.`
        : 'This request would exceed your plan’s allowance. View plans to check your limits.'
      : error.message,
    quota: quota?.success ? quota.data : null,
  }
}
