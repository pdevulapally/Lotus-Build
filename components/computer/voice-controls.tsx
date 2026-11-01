'use client'

import { useEffect, useRef, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendMessage, BackendSession } from '@/lib/backend/client'
import { BrowserVoiceAudio } from '@/lib/voice/browser-audio'
import { VoiceCall, type VoiceState } from '@/lib/voice/call'
import { VoicePanel } from './voice-panel'

export function VoiceControls({ session, messages, onMessage, refresh, identity }: {
  session: BackendSession
  messages: readonly BackendMessage[]
  onMessage(prompt: string): Promise<void>
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
  const [unsent, setUnsent] = useState<string[]>([])
  const call = useRef<VoiceCall | null>(null)
  const current = useRef({ session, onMessage, refresh }); current.current = { session, onMessage, refresh }
  const active = !['off', 'error'].includes(state)
  const latestAssistant = messages.filter(message => message.role === 'assistant').at(-1)

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
  useEffect(() => {
    if (!active) return
    if (session.status === 'IDLE' && !session.pendingInput && !session.fallback && latestAssistant) call.current?.speak('message', latestAssistant.seq)
    else call.current?.speak('status')
  }, [active, session.status, session.messageCount, session.pendingInput?.id, session.fallback?.status, session.cancelRequested, latestAssistant?.seq])

  const start = () => {
    if (!policy?.available || !policy.privacyVersion || !consent || active || unsent.length) return
    setError(null); setMuted(false)
    call.current?.end()
    const next = new VoiceCall(currentBackend(), new BrowserVoiceAudio(), session.id, policy.privacyVersion, {
      state: setState, partial: setPartial, error: setError,
      unsent: text => setUnsent(values => [...values, text]),
      ready: () => {
        // Fetch canonical task history after every audio connection, including reconnects.
        void current.current.refresh().then(() => next.speak('status')).catch(() => setError('Voice connected, but task status could not be refreshed. Check the chat before continuing.'))
      },
      transcript: async (_id, text) => {
        if (current.current.session.pendingInput?.kind === 'approval') {
          setUnsent(values => [...values, text]); next.mute(true); setMuted(true)
          throw new Error('An action needs your approval. Review it and use Approve or Reject in the chat. Spoken words cannot approve this action.')
        }
        try { await current.current.onMessage(text); next.speak('status') }
        catch (reason) { setUnsent(values => [...values, text]); throw reason }
      },
    })
    call.current = next; void next.start()
  }
  const toggleMute = () => { const next = !muted; call.current?.mute(next); setMuted(next) }
  return <VoicePanel model={{ policy, state, consent, expanded, muted, partial, error, unsent, working: session.status === 'RUNNING' }} actions={{ setExpanded, setConsent, setUnsent, start, toggleMute, interrupt: () => call.current?.interrupt(), end: () => call.current?.end() }} />
}
