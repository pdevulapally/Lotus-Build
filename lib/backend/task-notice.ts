import type { BackendSession } from './client'
import { presentRequestError, usageLimitTitle } from './error-presentation'

type Continuation = NonNullable<BackendSession['fallback']>
type VisibleStatus = Exclude<Continuation['status'], 'RUNNING' | 'COMPLETED'>
export type TaskNoticeAction = 'upgrade' | 'free' | 'premium' | 'cancel' | 'reconnect' | 'refresh' | 'projects'
export type TaskNoticeModel = {
  title: string
  description?: string
  kind: 'quota' | 'waiting' | 'error'
  actions: TaskNoticeAction[]
  retryModel?: string
  failure?: { execution?: number; message: string }
}
export type TaskNoticeInput = {
  session: BackendSession | null
  requestError?: Error | string | null
  streamError?: string | null
  fileError?: string | null
}

const statuses: Record<VisibleStatus, { title: string | null; kind: TaskNoticeModel['kind']; allowance: boolean }> = {
  AWAITING_CONSENT: { title: 'Your AI usage limit is reached', kind: 'quota', allowance: true },
  EXHAUSTED: { title: 'Free model allowance used up', kind: 'quota', allowance: true },
  SHARED_LIMIT: { title: 'Resource limit reached', kind: 'quota', allowance: true },
  QUEUED: { title: 'Continuing shortly', kind: 'waiting', allowance: false },
  CAPACITY_WAIT: { title: 'The free model is busy', kind: 'waiting', allowance: false },
  UNAVAILABLE: { title: null, kind: 'error', allowance: false },
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
    const free = paused && state.offer !== undefined && config.allowance
    const reason = state.status === 'UNAVAILABLE' && session.status === 'FAILED' && session.error ? session.error : state.reason
    const title = allowance && state.limitLabel ? usageLimitTitle(state.limitLabel) : config.title ?? reason
    const details: string[] = []
    // The failure's cause is already in the heading. Do not repeat it with a second checkpoint explanation.
    if (state.status !== 'UNAVAILABLE' && !state.limitLabel && state.reason !== title) details.push(state.reason)
    if (free && state.offer) {
      const provider = state.offer.provider ? ` via ${providerNames[state.offer.provider]}` : ''
      details.push(`Continue with ${state.offer.model}${provider}.${state.offer.estimatedInput ? ' Free usage is estimated, then corrected.' : ''}`)
    }
    if (state.status === 'CAPACITY_WAIT') details.push(`We’ll retry automatically${state.retryAt ? `; next attempt ${formatWhen(state.retryAt)}` : ''}. You can close this tab.`)
    if (state.resetAt && allowance && !free) details.push(`Allowance resets ${formatWhen(state.resetAt)}.`)
    if (state.imageExpiresAt && state.resumable) details.push(`Saved screenshot context expires ${formatWhen(state.imageExpiresAt)}; fresh context is required after that.`)
    const actions: TaskNoticeAction[] = []
    if (allowance) actions.push('upgrade')
    if (free) actions.push('free')
    if (paused) actions.push('premium')
    if (['QUEUED', 'RUNNING', 'IDLE'].includes(session.status)) actions.push('cancel')
    return { title, description: details.length ? details.join(' ') : undefined, kind: allowance ? 'quota' : config.kind, actions, retryModel: paused ? session.model : undefined, failure: failureIdentity }
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
  const title = message.isQuota || message.isProjectLimit ? message.title : error.message
  return { title, description: message.isQuota || message.isProjectLimit ? message.description : undefined, kind: message.isQuota ? 'quota' : 'error', actions,
    failure: requestError || streamError || fileError ? undefined : failureIdentity }
}
