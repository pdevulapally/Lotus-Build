'use client'

import type { VoiceState } from '@/lib/voice/call'
import { VoiceOrb } from './voice-orb'

const labels: Record<VoiceState, string> = {
  off: 'Voice ended', permission: 'Allow microphone access', connecting: 'Connecting…',
  listening: 'Listening', speaking: 'Speaking…', reconnecting: 'Reconnecting…', error: 'Voice stopped',
}
const guidance: Partial<Record<VoiceState, string>> = {
  permission: 'Allow your browser to use the microphone to start talking.',
  reconnecting: 'Audio in this gap is discarded. You may need to repeat it.',
}

export interface VoicePanelModel {
  state: VoiceState
  muted: boolean
  error: string | null
}

/** The visual voice surface sits between the messages and the composer. Actions live inside the input. */
export function VoicePanel({ id, model }: { id: string; model: VoicePanelModel }) {
  const { state, muted, error } = model
  const active = !['off', 'error'].includes(state)
  const status = active && muted && state !== 'speaking' ? 'Microphone muted' : labels[state]

  return <section id={id} aria-label="Voice conversation" className="max-h-[40dvh] overflow-y-auto pb-4 text-center text-foreground">
    <VoiceOrb state={state} muted={muted} />
    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-medium">{status}</p>
    {guidance[state] && <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{guidance[state]}</p>}
    {error && <p role="alert" className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-destructive">{error}</p>}
  </section>
}
