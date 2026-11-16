import { BackendError, type BackendSession, type BackendUsage } from './client'
import { presentRequestError } from './error-presentation'
import { remainingAllowance, usageMeterLabel, usageReset, usageResetAt } from '../settings/usage'

export type TaskNoticeUsage = { status: 'loading' | 'unavailable' } | { status: 'ready'; usage: BackendUsage }

type Continuation = NonNullable<BackendSession['fallback']>
type VisibleStatus = Exclude<Continuation['status'], 'RUNNING' | 'COMPLETED'>
export type TaskNoticeAction = 'credits' | 'upgrade' | 'free' | 'premium' | 'cancel' | 'reconnect' | 'refresh' | 'projects'
export type TaskNoticeModel = {
  title: string
  description?: string
  kind: 'quota' | 'waiting' | 'error'
  actions: TaskNoticeAction[]
  retryModel?: string
  creditTask?: { sessionId: string; checkpointId: string }
  failure?: { execution?: number; message: string }
}
export type TaskNoticeInput = {
  session: BackendSession | null
  requestError?: Error | string | null
  streamError?: string | null
  fileError?: string | null
  continuationError?: Error | null
  continuationPending?: boolean
  currentUsage?: TaskNoticeUsage
}

const usageTitle = 'Your usage limit is reached'
const usageDescription = 'This request needs more usage than is currently available on your plan.'
const statuses: Record<VisibleStatus, { title: string; description?: string; kind: TaskNoticeModel['kind']; allowance: boolean }> = {
  AWAITING_CREDITS: { title: usageTitle, kind: 'quota', allowance: true },
  AWAITING_CONSENT: { title: usageTitle, kind: 'quota', allowance: true },
  EXHAUSTED: { title: usageTitle, kind: 'quota', allowance: true },
  SHARED_LIMIT: { title: usageTitle, kind: 'quota', allowance: true },
  QUEUED: { title: 'Continuing shortly', kind: 'waiting', allowance: false },
  CAPACITY_WAIT: { title: 'The selected model is busy', kind: 'waiting', allowance: false },
  UNAVAILABLE: { title: 'This request couldn’t finish', description: 'You can review the conversation and send a new message when you’re ready.', kind: 'error', allowance: false },
}
const providerNames = { anthropic: 'Anthropic', nvidia: 'NVIDIA' } as const
const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function continuationFailure(error: Error, pending?: boolean): Pick<TaskNoticeModel, 'title' | 'description' | 'kind'> {
  const quota = presentRequestError(error).isQuota
  const stale = error instanceof BackendError && ['fallback/offer-stale', 'fallback/checkpoint-stale'].includes(error.code)
  return {
    title: pending && !quota && !stale ? 'We couldn’t confirm your task continued' : 'Your task couldn’t continue',
    description: quota ? 'There isn’t enough usage available for this request. Review your usage or add credits before trying again.'
      : stale ? 'The saved task has changed. Refresh this page before trying again.'
      : pending ? 'We couldn’t confirm whether your task continued. Use Retry original continuation to check again safely.'
      : 'Refresh this page and try again. If it keeps happening, contact support.',
    kind: 'error',
  }
}

/** One presentation for the current stop. Continuation failures must remain visible over a saved pause. */
export function selectTaskNotice({ session, requestError, streamError, fileError, continuationError, continuationPending, currentUsage }: TaskNoticeInput): TaskNoticeModel | null {
  const failureIdentity = session?.status === 'FAILED' && session.error ? { execution: session.execution, message: session.error } : undefined
  const state = session?.fallback
  if (session && state && state.status !== 'RUNNING' && state.status !== 'COMPLETED') {
    const config = statuses[state.status]
    const allowance = config.allowance || (state.status === 'UNAVAILABLE' && Boolean(state.limitLabel))
    const paused = session.status === 'IDLE' && state.resumable
    const free = paused && state.offer?.accounting === 'shared' && config.allowance
    // A saved pause records why work stopped, not today's account balance.
    const refreshed = allowance && currentUsage !== undefined
    // The saved pause has a label, not a meter key. Do not guess if it no longer
    // identifies exactly one current meter (for example, after a plan change).
    const matchingMeters = currentUsage?.status === 'ready'
      ? currentUsage.usage.meters.filter(meter => meter.label === state.limitLabel) : []
    const meter = matchingMeters.length === 1 ? matchingMeters[0] : undefined
    const reset = meter ? usageResetAt(meter) : null
    const currentMeter = meter && (!reset || reset.getTime() > Date.now()) ? meter : undefined
    const title = refreshed ? 'Your task is paused' : allowance ? usageTitle : config.title
    const details: string[] = []
    // Reasons are diagnostics for the server and may contain codes or provider details.
    if (refreshed) {
      if (currentUsage.status === 'loading') details.push('Checking your current usage. Choose Continue task when you’re ready to try again.')
      else if (currentMeter) details.push(`${usageMeterLabel(currentMeter)}: ${remainingAllowance(currentMeter)}. ${usageReset(currentMeter)}. Choose Continue task to check whether this request can resume.`)
      else details.push('Current usage could not be confirmed. Refresh this page to check again, or choose Continue task to try resuming.')
    }
    else if (allowance) details.push(state.status === 'AWAITING_CREDITS' ? 'Add credits to continue this task, or view plans for more usage.' : usageDescription)
    else if (config.description) details.push(paused ? 'Choose retry to try continuing this request.' : config.description)
    if (free && state.offer) {
      const provider = state.offer.provider ? ` via ${providerNames[state.offer.provider]}` : ''
      details.push(`Continue with ${state.offer.model}${provider} using the same AI credit balance.`)
    }
    if (state.status === 'CAPACITY_WAIT') details.push(`We’ll retry automatically${state.retryAt ? `; next attempt ${formatWhen(state.retryAt)}` : ''}. You can close this tab.`)
    if (!refreshed && state.resetAt && Date.parse(state.resetAt) > Date.now() && allowance && !free) details.push(`Allowance resets ${formatWhen(state.resetAt)}.`)
    if (state.imageExpiresAt && state.resumable) details.push(`You may need to share a new screenshot after ${formatWhen(state.imageExpiresAt)}.`)
    const actions: TaskNoticeAction[] = []
    const canAddCredits = state.status === 'AWAITING_CREDITS' || (state.status === 'AWAITING_CONSENT' && state.offer?.accounting === 'shared')
    if (canAddCredits) actions.push('credits')
    if (allowance) actions.push('upgrade')
    if (free) actions.push('free')
    if (paused) actions.push('premium')
    if (['QUEUED', 'RUNNING', 'IDLE'].includes(session.status)) actions.push('cancel')
    const visibleActions = continuationError && !presentRequestError(continuationError).isQuota
      ? actions.filter(action => action !== 'credits' && action !== 'upgrade' && action !== 'free') : actions
    return { title, description: details.length ? details.join(' ') : undefined, kind: allowance && !refreshed ? 'quota' : config.kind, actions: visibleActions, retryModel: paused ? session.model : undefined, failure: failureIdentity,
      ...(continuationError ? { ...continuationFailure(continuationError, continuationPending), failure: undefined } : {}),
      ...(canAddCredits && paused && state.checkpointId ? { creditTask: { sessionId: session.id, checkpointId: state.checkpointId } } : {}) }
  }

  if (continuationError) return { ...continuationFailure(continuationError, continuationPending), actions: [] }
  const failure = requestError || streamError || fileError || session?.error
  if (!failure) return null
  const error = failure instanceof Error ? failure : new Error(failure)
  const message = presentRequestError(error)
  const actions: TaskNoticeAction[] = []
  if (message.isQuota || message.isProjectLimit) actions.push('upgrade')
  if (message.isProjectLimit) actions.push('projects')
  // Reconnect only repairs a read stream; it cannot restart a failed task or resend an answer.
  if (!message.isQuota && !message.isProjectLimit && !requestError) {
    if (streamError) actions.push('reconnect')
    else if (fileError) actions.push('refresh')
  }
  const presentation = message.isQuota ? { title: usageTitle, description: usageDescription }
    : message.isProjectLimit ? message
    : streamError && !requestError ? { title: 'Let’s reconnect', description: 'Live updates were interrupted. Reconnect to see the latest progress.' }
    : fileError && !requestError ? { title: 'Your files couldn’t load', description: 'Refresh to try loading your project files again.' }
    : requestError ? { title: 'Your request couldn’t be completed', description: 'Please try again. If this keeps happening, contact support.' }
    : statuses.UNAVAILABLE
  return { title: presentation.title, description: presentation.description, kind: message.isQuota ? 'quota' : 'error', actions,
    failure: requestError || streamError || fileError ? undefined : failureIdentity }
}
