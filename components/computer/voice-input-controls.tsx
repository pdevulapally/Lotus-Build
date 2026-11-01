'use client'

import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, RotateCcw, Square, X } from 'lucide-react'
import type { VoiceState } from '@/lib/voice/call'

const button = 'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

/** Audio actions belong to the composer; task cancellation stays a separate action. */
export function VoiceInputControls({ state, muted, onMute, onInterrupt, onEnd, onReconnect }: {
  state: VoiceState
  muted: boolean
  onMute(): void
  onInterrupt(): void
  onEnd(): void
  onReconnect(): void
}) {
  const end = useRef<HTMLButtonElement>(null)
  const active = !['off', 'error'].includes(state)
  useEffect(() => { end.current?.focus() }, [])
  return <span className="inline-flex shrink-0 items-center gap-1" role="group" aria-label="Voice call controls"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onEnd() } }}>
    {active ? <>
      {state === 'speaking' && <button type="button" className={button} onClick={onInterrupt} aria-label="Stop speech" title="Stop speech"><Square className="size-4" aria-hidden="true" /></button>}
      <button type="button" className={`${button} ${muted ? 'bg-muted' : ''}`} onClick={onMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} title={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} disabled={state === 'permission'}>
        {muted ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
      </button>
    </> : <button type="button" className={button} onClick={onReconnect} aria-label="Reconnect voice" title="Reconnect voice"><RotateCcw className="size-5" aria-hidden="true" /></button>}
    <button ref={end} type="button" className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`} onClick={onEnd} aria-label={active ? 'End call' : 'Close voice'} title={active ? 'End call' : 'Close voice'}>
      {active ? <PhoneOff className="size-5" aria-hidden="true" /> : <X className="size-5" aria-hidden="true" />}
    </button>
  </span>
}
