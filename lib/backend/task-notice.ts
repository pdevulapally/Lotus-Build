import type { BackendSession } from './client'
import { presentRequestError } from './error-presentation'

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

/** One presentation for the current stop. Structured server limits take precedence over recovery diagnostics. */
export function selectTaskNotice({ session, requestError, streamError, fileError }: TaskNoticeInput): TaskNoticeModel | null {
  const failureIdentity = session?.status === 'FAILED' && session.error ? { execution: session.execution, message: session.error } : undefined
  const state = session?.fallback
  if (session && state && state.status !== 'RUNNING' && state.status !== 'COMPLETED') {
    const config = statuses[state.status]
    const allowance = config.allowance || (state.status === 'UNAVAILABLE' && Boolean(state.limitLabel))
    const paused = session.status === 'IDLE' && state.resumable
    const free = paused && state.offer?.accounting === 'shared' && config.allowance
    const title = allowance ? usageTitle : config.title
    const details: string[] = []
    // Reasons are diagnostics for the server and may contain codes or provider details.
    if (allowance) details.push(state.status === 'AWAITING_CREDITS' ? 'Add credits to continue this task, or view plans for more usage.' : usageDescription)
    else if (config.description) details.push(paused ? 'Choose retry to try continuing this request.' : config.description)
    if (free && state.offer) {
      const provider = state.offer.provider ? ` via ${providerNames[state.offer.provider]}` : ''
      details.push(`Continue with ${state.offer.model}${provider} using the same AI credit balance.`)
    }
    if (state.status === 'CAPACITY_WAIT') details.push(`We’ll retry automatically${state.retryAt ? `; next attempt ${formatWhen(state.retryAt)}` : ''}. You can close this tab.`)
    if (state.resetAt && allowance && !free) details.push(`Allowance resets ${formatWhen(state.resetAt)}.`)
    if (state.imageExpiresAt && state.resumable) details.push(`You may need to share a new screenshot after ${formatWhen(state.imageExpiresAt)}.`)
    const actions: TaskNoticeAction[] = []
    const canAddCredits = state.status === 'AWAITING_CREDITS' || (state.status === 'AWAITING_CONSENT' && state.offer?.accounting === 'shared')
    if (canAddCredits) actions.push('credits')
    if (allowance) actions.push('upgrade')
    if (free) actions.push('free')
    if (paused) actions.push('premium')
    if (['QUEUED', 'RUNNING', 'IDLE'].includes(session.status)) actions.push('cancel')
    return { title, description: details.length ? details.join(' ') : undefined, kind: allowance ? 'quota' : config.kind, actions, retryModel: paused ? session.model : undefined, failure: failureIdentity,
      ...(canAddCredits && paused && state.checkpointId ? { creditTask: { sessionId: session.id, checkpointId: state.checkpointId } } : {}) }
  }

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
