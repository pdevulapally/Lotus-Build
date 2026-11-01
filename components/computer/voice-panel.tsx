'use client'

import type { VoiceState } from '@/lib/voice/call'

const button = 'min-h-11 rounded-full border border-border px-4 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
const labels: Record<VoiceState, string> = { off: 'Voice is off', permission: 'Checking voice access and microphone permission…', connecting: 'Connecting voice…', listening: 'Listening', speaking: 'Speaking', reconnecting: 'Reconnecting voice…', error: 'Voice is off' }

export interface VoicePanelModel {
  policy: { available: boolean; privacyNotice: string } | null
  state: VoiceState
  consent: boolean
  expanded: boolean
  muted: boolean
  partial: string
  error: string | null
  unsent: readonly string[]
  working: boolean
}
export function VoicePanel({ model, actions }: {
  model: VoicePanelModel
  actions: { setExpanded(value: boolean): void; setConsent(value: boolean): void; setUnsent(value: string[]): void; start(): void; toggleMute(): void; interrupt(): void; end(): void }
}) {
  const { policy, state, consent, expanded, muted, partial, error, unsent, working } = model
  const { setExpanded, setConsent, setUnsent, start, toggleMute, interrupt, end } = actions
  const active = !['off', 'error'].includes(state)
  const status = active && muted ? 'Microphone muted' : labels[state]

  return <section aria-label="Voice conversation" className="mb-3 text-foreground">
    {!expanded && <button type="button" className={button} onClick={() => setExpanded(true)} aria-expanded={false}>Talk to LotusBuild</button>}
    {expanded && <section className="rounded-2xl border border-border bg-card p-4" aria-label="Voice controls">
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8.7 5.8c.1-4.1 6.5-4.1 6.6 0v6.5c-.1 4.2-6.5 4.2-6.6 0Z" /><path d="M5.5 11.8c0 8.7 13 8.7 13 0M12 18.4v3M8.8 21.4h6.4" />
        </svg>
        {status}{active && working ? ' · Task working' : ''}
      </p>
      {!active && <>
        <p className="mt-2 text-sm text-muted-foreground">{policy?.available ? policy.privacyNotice : 'Voice is not enabled yet. You can keep working in the chat.'}</p>
        {policy?.available && <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-primary" checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>I agree to share audio for this call. Sent messages stay in my project’s chat. I can end the call to stop sharing audio.</span>
        </label>}
      </>}
      {active && <p className="mt-2 text-sm text-muted-foreground">{state === 'permission' ? 'Your microphone stays off until you allow access. Audio is sent only once connected.' : muted ? 'Your microphone is off. You can still hear responses.' : state === 'reconnecting' ? 'Microphone is on. Audio during the gap is discarded; you may need to repeat it.' : state === 'connecting' ? 'Microphone is on. Waiting for a secure voice connection; audio is not sent yet.' : 'Microphone is on. Speak naturally or interrupt. You can also type below.'} End call stops audio; accepted work continues.</p>}
      {partial && <p className="mt-2 text-sm text-muted-foreground" aria-label="What you are saying">{partial}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {unsent.length > 0 && <section aria-label="Voice messages needing review" className="mt-3 text-sm">
        <p>These words need review before sending. If chat shows a message pending confirmation, retry that original message there first.</p>
        {unsent.map((text, index) => <p key={index} className="mt-2 select-text whitespace-pre-wrap">{text}</p>)}
        <button type="button" className={`${button} mt-2`} onClick={() => setUnsent([])}>Dismiss these words</button>
      </section>}
      <p className="mt-3 flex flex-wrap gap-2">
        {active ? <>
          <button type="button" className={button} onClick={toggleMute} aria-pressed={muted} disabled={state === 'permission'}>{muted ? 'Unmute microphone' : 'Mute microphone'}</button>
          <button type="button" className={button} onClick={() => interrupt()}>Stop speech</button>
          <button type="button" className={button} onClick={() => end()}>End call</button>
        </> : <>
          {policy?.available && <button type="button" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} disabled={!consent || unsent.length > 0} onClick={start}>Start voice</button>}
          <button type="button" className={button} onClick={() => setExpanded(false)}>Use text</button>
        </>}
      </p>
      {active && <p className="mt-2 text-xs text-muted-foreground">To cancel work or approve an action, use the task controls in chat.</p>}
    </section>}
  </section>
}
