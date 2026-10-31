import Link from 'next/link'
import type { BackendSession } from '@/lib/backend/client'

export function ContinuationStatus({ session, busy, onContinue, onCancel }: {
  session: BackendSession
  busy: boolean
  onContinue: (lane: 'premium' | 'fallback') => void
  onCancel: () => void
}) {
  const state = session.fallback
  if (!state) return null
  const offer = state.offer
  const paused = session.status === 'IDLE' && state.resumable
  const readyForFree = paused && offer !== undefined && ['AWAITING_CONSENT', 'EXHAUSTED', 'SHARED_LIMIT'].includes(state.status)
  return <section aria-label="Task continuation" className="mb-3 text-sm text-foreground" aria-live="polite">
    <p>{state.reason}</p>
    {state.lane === 'fallback' && state.offer && <p className="mt-1 text-xs text-muted-foreground">Model: {state.offer.model} · Effort: {state.offer.effort}</p>}
    {state.imageExpiresAt && state.resumable && <p className="mt-1 text-xs text-muted-foreground">Saved screenshot context expires <time dateTime={state.imageExpiresAt}>{new Date(state.imageExpiresAt).toLocaleString()}</time>. Fresh context is required after expiry.</p>}
    {state.resetAt && <p className="mt-1 text-xs text-muted-foreground">Allowance resets <time dateTime={state.resetAt}>{new Date(state.resetAt).toLocaleString()}</time>.</p>}
    {state.status === 'CAPACITY_WAIT' && <p className="mt-1 text-xs text-muted-foreground">Your task remains queued. You can close this tab.</p>}
    {readyForFree && offer && <p className="mt-2">
      <button type="button" className="underline" disabled={busy} onClick={() => onContinue('fallback')}>Continue with the free model: {offer.model} ({offer.effort})</button>
    </p>}
    {paused && <p className="mt-2">
      <button type="button" className="underline" disabled={busy} onClick={() => onContinue('premium')}>Retry with {session.model}</button>
    </p>}
    {state.status !== 'COMPLETED' && <p className="mt-2 flex flex-wrap gap-3 text-xs">
      <Link href="/pricing" className="underline">View upgrade options</Link>
      {(session.status === 'QUEUED' || session.status === 'RUNNING' || session.status === 'IDLE') && <button type="button" className="underline" disabled={busy} onClick={onCancel}>Cancel task</button>}
    </p>}
  </section>
}
