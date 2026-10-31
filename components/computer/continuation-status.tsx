import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import type { BackendSession } from '@/lib/backend/client'

const providerNames = { anthropic: 'Anthropic', openrouter: 'OpenRouter' } as const

const titles: Record<NonNullable<BackendSession['fallback']>['status'], string> = {
  AWAITING_CONSENT: 'Premium allowance reached',
  QUEUED: 'Continuation queued',
  RUNNING: 'Continuing on the free model',
  CAPACITY_WAIT: 'Waiting for provider capacity',
  EXHAUSTED: 'Allowance used up',
  SHARED_LIMIT: 'Workspace limit reached',
  UNAVAILABLE: 'Task paused',
  COMPLETED: 'Finished on the free model',
}

const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

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
  const choice = 'group flex w-full flex-col gap-1.5 rounded-xl border border-border bg-background/60 p-4 text-left transition-colors hover:border-foreground/40 hover:bg-muted/60 disabled:cursor-progress disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
  return <motion.section
    aria-label="Task continuation" aria-live="polite"
    initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    className="mb-4 w-full max-w-[640px] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[0_1px_0_rgba(0,0,0,.04)]">
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">{titles[state.status]}</h2>
      {state.limitLabel && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{state.limitLabel}</span>}
    </div>
    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{state.reason}</p>

    {(readyForFree || paused) && <div className="mt-4 grid gap-2.5">
      {readyForFree && offer && <button type="button" className={choice} disabled={busy} onClick={() => onContinue('fallback')}>
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Continue with the free model</span>
          <ArrowRight aria-hidden size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{offer.model}</span>{provider && <> via {provider}</>} · effort {offer.effort} · separate free allowance, nothing billed
        </span>
        {offer.estimatedInput && <span className="text-xs leading-relaxed text-muted-foreground">This provider doesn’t pre-count tokens, so the free allowance is reserved from an estimate and corrected to actual usage afterwards.</span>}
      </button>}
      {paused && <button type="button" className={choice} disabled={busy} onClick={() => onContinue('premium')}>
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Retry with {session.model}</span>
          <RotateCcw aria-hidden size={15} className="shrink-0 text-muted-foreground" />
        </span>
        <span className="text-[13px] text-muted-foreground">
          Uses your premium allowance{state.resetAt && <>, which resets {formatWhen(state.resetAt)}</>}.
        </span>
      </button>}
    </div>}

    {(state.status === 'CAPACITY_WAIT' || (state.imageExpiresAt && state.resumable) || (state.resetAt && !paused)) && <ul className="mt-3 grid gap-1 text-xs leading-relaxed text-muted-foreground">
      {state.status === 'CAPACITY_WAIT' && <li>Your task remains queued and resumes on its own{state.retryAt && <>; next attempt {formatWhen(state.retryAt)}</>}. You can close this tab.</li>}
      {state.resetAt && !paused && <li>Allowance resets {formatWhen(state.resetAt)}.</li>}
      {state.imageExpiresAt && state.resumable && <li>Saved screenshot context expires {formatWhen(state.imageExpiresAt)}; fresh context is required after that.</li>}
    </ul>}

    {state.status !== 'COMPLETED' && <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link href="/pricing" className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted">View plans</Link>
      {cancellable && <button type="button" disabled={busy} onClick={onCancel} className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60">Cancel task</button>}
    </div>}
  </motion.section>
}
