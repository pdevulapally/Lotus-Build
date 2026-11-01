'use client'

import { AudioLines, Mic, MicOff, PhoneOff, Square, X } from 'lucide-react'
import type { VoiceState } from '@/lib/voice/call'
import { LotusLogo } from '@/components/ui/lotus-logo'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VoiceOrb } from './voice-orb'

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover'
const round = `inline-flex size-11 items-center justify-center rounded-full border border-border bg-popover text-foreground transition-colors hover:bg-accent disabled:opacity-40 ${focus}`
const labels: Record<VoiceState, string> = {
  off: 'Voice is off', permission: 'Allow microphone access', connecting: 'Connecting…',
  listening: 'Listening', speaking: 'Speaking…', reconnecting: 'Reconnecting…', error: 'Voice is off',
}
const guidance: Record<VoiceState, string> = {
  off: 'A conversation, right here in your project.',
  permission: 'Allow your browser to use the microphone to start talking.',
  connecting: 'Your microphone is on. Audio sharing starts once connected.',
  listening: 'Go ahead. You can interrupt or type in the chat, too.',
  speaking: 'You can jump in whenever you like.',
  reconnecting: 'Your task continues. Audio in this gap is discarded; you may need to repeat it.',
  error: 'You can keep working in the chat below.',
}

export interface VoicePanelModel {
  policy: { available: boolean; privacyNotice: string } | null
  state: VoiceState
  consent: boolean
  expanded: boolean
  muted: boolean
  partial: string
  error: string | null
  working: boolean
}
export function VoicePanel({ model, actions }: {
  model: VoicePanelModel
  actions: { setExpanded(value: boolean): void; setConsent(value: boolean): void; start(): void; toggleMute(): void; interrupt(): void; end(): void }
}) {
  const { policy, state, consent, expanded, muted, partial, error, working } = model
  const { setExpanded, setConsent, start, toggleMute, interrupt, end } = actions
  const active = !['off', 'error'].includes(state)
  const status = active && muted && state !== 'speaking' ? 'Microphone muted' : labels[state]
  const close = () => { if (active) end(); setExpanded(false) }

  return <section aria-label="Voice conversation" className="mb-3 text-foreground">
    <Popover open={expanded} onOpenChange={open => { if (open) setExpanded(true); else close() }}>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm transition-colors hover:bg-accent ${focus}`}>
          {active ? <AudioLines className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
          {active ? 'Voice on' : 'Talk to LotusBuild'}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={12} collisionPadding={12} aria-label="Voice controls"
        onInteractOutside={event => { if (active) event.preventDefault() }}
        className="flex max-h-[min(42rem,calc(100svh-2rem),var(--radix-popover-content-available-height))] w-[min(25rem,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden rounded-3xl border-border bg-popover p-0 shadow-xl motion-reduce:animate-none">
        <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-3">
          <span className="flex items-center gap-2.5 text-base font-medium"><LotusLogo size={22} />LotusBuild</span>
          <button type="button" className={`inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`}
            onClick={close} aria-label={active ? 'End call and close voice' : 'Close voice panel'} title={active ? 'End call and close' : 'Close'}><X className="size-4" aria-hidden="true" /></button>
        </header>

        <section className="mx-3 min-h-0 overflow-y-auto rounded-2xl bg-muted/40 px-5 pb-6 text-center" aria-label="Voice status">
          <VoiceOrb state={state} muted={muted} />
          <p role="status" aria-live="polite" aria-atomic="true" className="text-base font-medium">{status}</p>
          {active && <p className="mt-1.5 text-xs text-muted-foreground">{state === 'permission' ? 'Microphone permission pending' : muted ? 'Microphone off' : 'Microphone on'}{working ? ' · Task working' : ''}</p>}

          {partial && active ? <p className="mx-auto mt-6 max-h-32 max-w-72 overflow-y-auto text-lg leading-relaxed text-foreground" aria-label="Live voice captions" aria-live="polite" aria-atomic="true">{partial}</p>
            : <p className="mx-auto mt-5 max-w-64 text-sm leading-relaxed text-muted-foreground">{!active && !policy?.available ? 'Voice is not enabled yet. You can keep working in the chat.' : active && muted ? 'Your microphone is off. You can still hear responses.' : guidance[state]}</p>}

          {!active && policy?.available && <section className="mt-5 text-left text-xs leading-relaxed text-muted-foreground" aria-label="Voice privacy">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg py-2 text-foreground">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={consent} onChange={event => setConsent(event.target.checked)} />
              <span>Share live audio and recent project chat with ElevenLabs. Final voice dialogue stays in my project chat.</span>
            </label>
            <details className="mt-1">
              <summary className={`w-fit cursor-pointer rounded-sm py-1 underline decoration-border underline-offset-4 ${focus}`}>Audio &amp; privacy</summary>
              <p className="pt-2">{policy.privacyNotice}</p>
            </details>
          </section>}
          {error && <p role="alert" className="mt-4 text-sm leading-relaxed text-destructive">{error}</p>}
        </section>

        <footer className="shrink-0 px-5 pb-4 pt-4 text-center">
          {active ? <>
            <span className="mx-auto grid max-w-64 grid-cols-3 items-start gap-4">
              <span className="flex flex-col items-center gap-2 pt-2">
                <button type="button" className={round} onClick={interrupt} aria-label="Stop speech"><Square className="size-4" aria-hidden="true" /></button>
                <span className="text-xs text-muted-foreground">Stop speech</span>
              </span>
              <span className="flex flex-col items-center gap-2">
                <button type="button" className={`${round} size-16 bg-muted/60`} onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} disabled={state === 'permission'}>
                  {muted ? <MicOff className="size-6" aria-hidden="true" /> : <Mic className="size-6" strokeWidth={1.5} aria-hidden="true" />}
                </button>
                <span className="text-xs text-muted-foreground">{muted ? 'Unmute' : 'Mute'}</span>
              </span>
              <span className="flex flex-col items-center gap-2 pt-2">
                <button type="button" className={round} onClick={() => end()} aria-label="End call"><PhoneOff className="size-4" aria-hidden="true" /></button>
                <span className="text-xs text-muted-foreground">End call</span>
              </span>
            </span>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">End call stops audio; accepted work continues.<br />Approvals and task cancellation stay in chat.</p>
          </> : <span className="flex items-center justify-center gap-3">
            {policy?.available && <button type="button" className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 ${focus}`} disabled={!consent} onClick={start}><Mic className="size-4" aria-hidden="true" />Start voice</button>}
            <button type="button" className={`min-h-11 rounded-full px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focus}`} onClick={close}>Use text</button>
          </span>}
        </footer>
      </PopoverContent>
    </Popover>
  </section>
}
