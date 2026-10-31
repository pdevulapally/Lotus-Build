import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { AllowanceLimitIcon, ContinuedIcon, PausedIcon, QueuedIcon } from '@/components/ui/lotus-icons'
import type { BackendSession } from '@/lib/backend/client'

const providerNames = { anthropic: 'Anthropic', openrouter: 'OpenRouter' } as const

type Status = NonNullable<BackendSession['fallback']>['status']

const titles: Record<Status, string> = {
  AWAITING_CONSENT: 'Limit reached',
  QUEUED: 'Continuation queued',
  RUNNING: 'Continuing on the free model',
  CAPACITY_WAIT: 'Waiting for capacity',
  EXHAUSTED: 'Limit reached',
  SHARED_LIMIT: 'Limit reached',
  UNAVAILABLE: 'Task paused',
  COMPLETED: 'Finished on the free model',
}

const icons: Record<Status, (props: { className?: string }) => React.JSX.Element> = {
  AWAITING_CONSENT: AllowanceLimitIcon, EXHAUSTED: AllowanceLimitIcon, SHARED_LIMIT: AllowanceLimitIcon,
  QUEUED: QueuedIcon, CAPACITY_WAIT: QueuedIcon, UNAVAILABLE: PausedIcon, RUNNING: ContinuedIcon, COMPLETED: ContinuedIcon,
}

const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const pill = 'inline-flex min-h-[42px] items-center justify-center rounded-full px-[18px] text-sm font-semibold leading-none transition-[background-color,opacity] duration-150 disabled:cursor-progress disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const primaryPill = `${pill} bg-primary text-primary-foreground hover:opacity-90`
const secondaryPill = `${pill} border border-border text-foreground hover:bg-muted`

export function ContinuationStatus({ session, busy, onContinue, onCancel }: {
  session: BackendSession
  busy: boolean
  onContinue: (lane: 'premium' | 'fallback') => void
  onCancel: () => void
}) {
  const reduceMotion = useReducedMotion()
  const state = session.fallback
  if (!state) return null
  const offer = state.offer
  const paused = session.status === 'IDLE' && state.resumable
  const readyForFree = paused && offer !== undefined && ['AWAITING_CONSENT', 'EXHAUSTED', 'SHARED_LIMIT'].includes(state.status)
  const provider = offer?.provider ? providerNames[offer.provider] : undefined
  const cancellable = session.status === 'QUEUED' || session.status === 'RUNNING' || session.status === 'IDLE'
  const StatusIcon = icons[state.status]
  const details = [
    readyForFree && offer ? `Continue free on ${offer.model}${provider ? ` via ${provider}` : ''}, or retry with your model.${offer.estimatedInput ? ' Free usage is estimated, then corrected.' : ''}` : undefined,
    state.status === 'CAPACITY_WAIT' ? `Your task remains queued and resumes on its own${state.retryAt ? `; next attempt ${formatWhen(state.retryAt)}` : ''}. You can close this tab.` : undefined,
    state.imageExpiresAt && state.resumable ? `Saved screenshot context expires ${formatWhen(state.imageExpiresAt)}; fresh context is required after that.` : undefined,
    state.resetAt && !readyForFree ? `Allowance resets ${formatWhen(state.resetAt)}.` : undefined,
  ].filter((line): line is string => line !== undefined)
  const detail = details.length > 0 ? details.join(' ') : undefined
  return <motion.section
    aria-label="Task continuation" aria-live="polite"
    initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    className="mb-4 grid w-full gap-2 rounded-[20px] border border-border bg-card px-5 pb-5 pt-[18px] text-card-foreground">
    <StatusIcon className="mb-1 size-[22px] text-foreground" />
    <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{titles[state.status]}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{readyForFree ? 'Your premium allowance for this cycle is used up.' : state.reason}{detail && <> {detail}</>}</p>
    {state.status !== 'COMPLETED' && <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {readyForFree && offer && <button type="button" className={primaryPill} disabled={busy} onClick={() => onContinue('fallback')}>Continue with free model</button>}
      {paused && <button type="button" className={readyForFree ? secondaryPill : primaryPill} disabled={busy} onClick={() => onContinue('premium')}>Retry with {session.model}</button>}
      <Link href="/pricing" className={secondaryPill}>View plans</Link>
      {cancellable && <button type="button" disabled={busy} onClick={onCancel} className="ml-auto inline-flex min-h-[42px] items-center px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60">Cancel task</button>}
    </div>}
  </motion.section>
}
