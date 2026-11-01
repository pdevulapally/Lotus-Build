'use client'

import { useEffect, useRef, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendSession } from '@/lib/backend/client'
import { BrowserVoiceAudio } from '@/lib/voice/browser-audio'
import { VoiceCall, type VoiceState } from '@/lib/voice/call'
import { VoicePanel } from './voice-panel'

export function VoiceControls({ session, refresh, identity }: {
  session: BackendSession
  refresh(): Promise<void>
  identity: string
}) {
  const [policy, setPolicy] = useState<Awaited<ReturnType<ReturnType<typeof currentBackend>['voice']>> | null>(null)
  const [state, setState] = useState<VoiceState>('off')
  const [consent, setConsent] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [muted, setMuted] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const call = useRef<VoiceCall | null>(null)
  const current = useRef({ session, refresh }); current.current = { session, refresh }
  const active = !['off', 'error'].includes(state)

  useEffect(() => {
    const abort = new AbortController()
    currentBackend().voice(abort.signal).then(setPolicy).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Voice availability could not be checked.') })
    return () => { abort.abort(); call.current?.end(); call.current = null }
  }, [identity, session.id])
  useEffect(() => {
    // Mobile app switching and tab hiding end capture; accepted work stays on the server.
    const hide = () => { if (document.hidden) call.current?.end() }
    const leave = () => call.current?.end()
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave) }
  }, [])
  const start = () => {
    if (!policy?.available || !policy.privacyVersion || !consent || active) return
    setError(null); setMuted(false)
    call.current?.end()
    const next = new VoiceCall(currentBackend(), new BrowserVoiceAudio(), session.id, policy.privacyVersion, {
      state: setState, partial: setPartial, error: setError,
      caption: (speaker, text) => setPartial(`${speaker === 'user' ? 'You' : 'LotusBuild'}: ${text}`),
      ready: () => {
        // Fetch canonical task history after every audio connection, including reconnects.
        void current.current.refresh().catch(() => setError('Voice connected, but task status could not be refreshed. Check the chat before continuing.'))
      },

    })
    call.current = next; void next.start()
  }
  const toggleMute = () => { const next = !muted; call.current?.mute(next); setMuted(next) }
  return <VoicePanel model={{ policy, state, consent, expanded, muted, partial, error, working: session.status === 'RUNNING' }} actions={{ setExpanded, setConsent, start, toggleMute, interrupt: () => call.current?.interrupt(), end: () => call.current?.end() }} />
}
