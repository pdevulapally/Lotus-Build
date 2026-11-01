'use client'

import { useEffect, useId, useRef, useState, type MouseEventHandler, type ReactNode } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendSession } from '@/lib/backend/client'
import { BrowserVoiceAudio, type VoiceAudio } from '@/lib/voice/browser-audio'
import { VoiceCall, type VoiceState } from '@/lib/voice/call'
import { takeVoiceAudio } from '@/lib/voice/launch'
import { VoicePanel } from './voice-panel'
import { VoiceInputControls } from './voice-input-controls'

export function VoiceControls({ session, refresh, identity, children, initiallyExpanded = false }: {
  session: BackendSession | null
  refresh(): Promise<void>
  identity?: string
  initiallyExpanded?: boolean
  children(props: { onOpenVoice?: MouseEventHandler<HTMLButtonElement>; voiceExpanded: boolean; voicePanelId: string; voiceControls?: ReactNode }): ReactNode
}) {
  const panelId = useId()
  const [state, setState] = useState<VoiceState>('off')
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const call = useRef<VoiceCall | null>(null)
  const preparing = useRef<VoiceAudio | null>(null)
  const starting = useRef(false)
  const generation = useRef(0)
  const current = useRef({ refresh }); current.current = { refresh }
  const active = !['off', 'error'].includes(state)

  const stopAudio = () => {
    generation.current++
    starting.current = false
    preparing.current?.close(); preparing.current = null
    call.current?.end(); call.current = null
  }
  useEffect(() => () => stopAudio(), [identity, session?.id])
  useEffect(() => {
    const hide = () => { if (document.hidden) { stopAudio(); setState('off') } }
    const leave = () => { stopAudio(); setState('off') }
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave) }
  }, [])

  const start = async (audio: VoiceAudio = new BrowserVoiceAudio()) => {
    if (!session || !identity || active || starting.current) { audio.close(); return }
    stopAudio()
    const launch = ++generation.current
    starting.current = true; preparing.current = audio
    setExpanded(true); setError(null); setMuted(false); setState('connecting')
    try {
      // Unlock during the user's click, or reuse the resource handed over by the workspace click.
      if (audio instanceof BrowserVoiceAudio) await audio.prepare()
      if (generation.current !== launch) { audio.close(); return }
      const backend = currentBackend()
      const policy = await backend.voice()
      if (generation.current !== launch) { audio.close(); return }
      if (!policy.available || !policy.privacyVersion) throw new Error('Voice is not available right now. You can keep working in chat.')
      const refreshConversation = () => {
        void current.current.refresh().catch(() => { if (generation.current === launch) setError('Voice connected, but chat could not be refreshed.') })
      }
      const next = new VoiceCall(backend, audio, session.id, policy.privacyVersion, {
        state: value => { if (generation.current === launch) setState(value) },
        error: value => { if (generation.current === launch) setError(value) },
        // The backend has saved this turn before sending its caption notification.
        caption: () => { if (generation.current === launch) refreshConversation() },
        ready: refreshConversation,
      })
      call.current = next; preparing.current = null
      await next.start()
    } catch (reason) {
      audio.close()
      if (generation.current === launch) { setState('error'); setError(reason instanceof Error ? reason.message : 'Voice could not connect.') }
    } finally {
      if (generation.current === launch) { starting.current = false; preparing.current = null }
    }
  }
  useEffect(() => {
    if (!initiallyExpanded || !session || !identity) return
    let disposed = false
    // Strict Mode's discarded mount must not consume or close the click-unlocked audio resource.
    queueMicrotask(() => { if (!disposed) void start(takeVoiceAudio(identity, session.id)) })
    return () => { disposed = true }
  }, [identity, session?.id, initiallyExpanded])

  const toggleMute = () => { const next = !muted; call.current?.mute(next); setMuted(next) }
  const close = () => {
    stopAudio(); setState('off'); setExpanded(false)
  }
  return <>
    {expanded && <VoicePanel id={panelId} model={{ state, muted, error }} />}
    {children({
      onOpenVoice: session && identity ? () => { setExpanded(true); if (!active) void start() } : undefined,
      voiceExpanded: expanded, voicePanelId: panelId,
      voiceControls: expanded ? <VoiceInputControls state={state} muted={muted} onMute={toggleMute} onInterrupt={() => call.current?.interrupt()} onEnd={close} onReconnect={() => { void start() }} /> : undefined,
    })}
  </>
}
