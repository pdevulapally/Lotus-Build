import { z } from 'zod'
import { BackendError } from './client'

const quotaDetails = z.object({
  label: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(40),
  limit: z.number().finite().nonnegative(),
  consumed: z.number().finite().nonnegative(),
  reserved: z.number().finite().nonnegative(),
  resetPeriod: z.enum(['NEVER', 'DAILY', 'MONTHLY']).optional(),
  resetAt: z.string().optional(),
})

const projectLimitDetails = z.object({
  limit: z.number().int().nonnegative(),
  current: z.number().int().nonnegative(),
})

export function presentRequestError(error: Error, planName?: string) {
  const isQuota = error instanceof BackendError && error.code === 'usage/limit-reached'
  const isProjectLimit = error instanceof BackendError && error.code === 'project/limit-reached'
  const quota = isQuota ? quotaDetails.safeParse(error.details) : null
  const projectLimit = isProjectLimit ? projectLimitDetails.safeParse(error.details) : null
  const plan = planName ? `Your ${planName} plan` : 'Your plan'
  return {
    isQuota,
    isProjectLimit,
    title: isProjectLimit ? 'Project limit reached' : isQuota ? 'Limit reached' : 'Something went wrong',
    description: isProjectLimit
      ? projectLimit?.success
        ? projectLimit.data.limit === 0
          ? `${plan} doesn’t include projects. Your idea is still here—view plans to get started.`
          : `${plan} includes ${projectLimit.data.limit.toLocaleString()} ${projectLimit.data.limit === 1 ? 'project' : 'projects'}, and you’ve reached that limit. Your idea is still here—delete a project you no longer need, or view plans with more space.`
        : 'Your plan’s project spaces are full. Your idea is still here—delete an existing project or view plans with more space.'
      : isQuota
      ? quota?.success
        ? quota.data.resetPeriod === 'DAILY'
          ? `${plan}’s ${quota.data.label.toLowerCase()} for today are used up. More is available tomorrow, or upgrade for much higher limits.`
          : `${plan}’s ${quota.data.label.toLowerCase()} for this cycle are used up. Upgrade for much higher limits.`
        : 'This request would exceed your plan’s allowance. Upgrade for much higher limits.'
      : error.message,
    quota: quota?.success ? quota.data : null,
  }
}
