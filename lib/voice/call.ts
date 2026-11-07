import type { BackendClient } from '../backend/client'
import type { VoiceAudio } from './browser-audio'

export type VoiceState = 'off' | 'permission' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'error'
export interface VoiceCallbacks {
  state(state: VoiceState): void
  caption(speaker: 'user' | 'assistant', text: string): void
  error(message: string): void
  ready(): void
}

const terminalReasons: Readonly<Record<number, string>> = {
  4400: 'Voice received invalid data. Continue in text.',
  4401: 'Voice access expired or was refused. Sign in again or continue in text.',
  4403: 'Voice is not allowed from this site.',
  4410: 'This voice call reached its time or inactivity limit. Your task continues.',
  4413: 'Voice could not keep up with this connection. Continue in text.',
  4429: 'Voice reached a usage or capacity limit. Continue in text.',
  4503: 'Voice is unavailable under the required privacy policy. Continue in text.',
  4504: 'Voice configuration changed and needs review. Continue in text for now.',
}

/** Audio can reconnect; accepted commands never replay. The existing HTTP pending-command ledger owns retries. */
export class VoiceCall {
  private socket: WebSocket | null = null
  private ended = false
  private ready = false
  private retries = 0
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  private interrupting = false
  private active = false
  private sampleRate = 24000
  constructor(private readonly backend: Pick<BackendClient, 'voiceSocket' | 'voiceAccess'>, private readonly audio: VoiceAudio,
    private readonly sessionId: string, private readonly consentVersion: string, private readonly callbacks: VoiceCallbacks) {}

  async start() {
    this.callbacks.state('permission')
    try {
      const access = async () => { const value = await this.backend.voiceAccess(this.sessionId); if (value.privacyVersion !== this.consentVersion) throw new Error('Voice privacy information changed. Review it before starting again.') }
      // Invoke start synchronously to unlock audio on mobile, but do not capture until access is checked.
      // BrowserVoiceAudio resumes its AudioContext on this user gesture; microphone permission is gated below.
      await this.audio.start(pcm => {
        if (!this.ended && this.ready && this.socket?.readyState === 1) {
          if (this.socket.bufferedAmount > 128 * 1024) { this.fail('Voice upload is falling behind. Your task continues in text.'); return }
          this.socket.send(pcm)
        }
      }, () => { if (this.active) this.interrupt() }, () => this.fail('Microphone access ended. Your task continues in text.'), access)
      if (!this.ended) { this.callbacks.state('connecting'); await this.connect() }
    } catch (error) {
      const denied = error instanceof Error && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)
      this.fail(denied ? 'Microphone permission was denied. Allow microphone access in your browser settings, or continue in text.' : error instanceof Error ? error.message : 'Voice could not start. Continue in text.')
    }
  }
  private async connect() {
    const socket = await this.backend.voiceSocket(this.sessionId, this.consentVersion)
    if (this.ended) { socket.close(); return }
    this.socket = socket
    const timeout = setTimeout(() => { if (!this.ready) socket.close(4000, 'connection-timeout') }, 25000)
    socket.addEventListener('message', event => {
      if (this.ended || socket !== this.socket) return
      try {
        if (typeof event.data !== 'string' || event.data.length > 256 * 1024) throw new Error('Invalid voice response.')
        const data: unknown = JSON.parse(event.data)
        if (!data || typeof data !== 'object') throw new Error('Invalid voice response.')
        this.receive(data as Record<string, unknown>)
      } catch { this.fail('Voice returned an invalid response. Continue in text.') }
    })
    socket.addEventListener('close', event => {
      clearTimeout(timeout)
      if (this.ended || socket !== this.socket) return
      this.ready = false; this.active = false; this.audio.stopSpeech()
      if (event.code === 1000) { this.end(); return }
      const terminal = terminalReasons[event.code]
      if (terminal) { this.fail(terminal); return }
      if (++this.retries > 3) { this.fail('Voice could not reconnect. Your task continues; use text or start a new call.'); return }
      this.callbacks.state('reconnecting')
      this.retryTimer = setTimeout(() => { void this.connect().catch(() => this.fail('Voice could not reconnect. Your task continues in text.')) }, 500 * 2 ** (this.retries - 1))
    })
    socket.addEventListener('error', () => { socket.close(4000, 'connection-error') })
  }
  private receive(data: Record<string, unknown>) {
    if (data.type === 'ready') {
      this.ready = true; this.generation = 0; this.interrupting = false
      this.callbacks.state('listening'); this.callbacks.ready(); return
    }
    if (data.type === 'voice.caption') {
      if (!['user', 'assistant'].includes(String(data.speaker)) || typeof data.text !== 'string' || data.text.length > 8000) throw new Error('Invalid voice caption.')
      this.callbacks.caption(data.speaker as 'user' | 'assistant', data.text)
      return
    }
    if (data.type === 'speech.stopped') {
      if (typeof data.generation !== 'number') throw new Error('Invalid speech generation.')
      this.generation = data.generation; this.interrupting = false; this.active = false
      this.audio.stopSpeech(); this.callbacks.state('listening'); return
    }
    if (data.type === 'speech.started') {
      if (typeof data.generation !== 'number' || typeof data.sampleRate !== 'number' || ![8000, 16000, 22050, 24000, 44100, 48000].includes(data.sampleRate)) throw new Error('Invalid speech format.')
      if (this.interrupting || data.generation < this.generation) return
      // Native audio event IDs can advance between chunks. Preserve queued PCM;
      // interruption has its own explicit stop event.
      this.generation = data.generation; this.sampleRate = data.sampleRate; this.active = true; this.callbacks.state('speaking'); return
    }
    if (data.type === 'speech.audio') {
      if (this.interrupting || data.generation !== this.generation) return
      if (typeof data.audio !== 'string' || data.audio.length > 192 * 1024) throw new Error('Invalid speech audio.')
      this.active = true; this.callbacks.state('speaking'); this.audio.play(data.audio, this.sampleRate)
      const generation = this.generation
      // Native text completion can precede the last audio chunk. Actual buffer
      // drain, including late chunks, determines the audible speaking state.
      this.audio.finishSpeech(() => { if (!this.ended && generation === this.generation) { this.active = false; this.callbacks.state('listening') } })
      return
    }
    if (data.type === 'speech.finished') {
      if (data.generation === this.generation && !this.interrupting) this.audio.finishSpeech(() => { if (!this.ended) { this.active = false; this.callbacks.state('listening') } })
      return
    }
    if (data.type === 'speech.unavailable') { this.active = false; this.audio.stopSpeech(); this.callbacks.state('listening'); this.callbacks.error('Spoken audio is unavailable. The task and its text response are still available.'); return }
    throw new Error('Unknown voice event.')
  }
  mute(muted: boolean) { this.audio.mute(muted) }
  interrupt() {
    if (this.ended) return
    this.audio.stopSpeech(); this.active = false; this.interrupting = true
    this.send({ type: 'interrupt' })
    if (this.ready) this.callbacks.state('listening')
  }
  private send(value: object) { if (!this.ended && this.ready && this.socket?.readyState === 1) this.socket.send(JSON.stringify(value)) }
  private fail(message: string) { if (this.ended) return; this.end(); this.callbacks.error(message); this.callbacks.state('error') }
  end() {
    if (this.ended) return
    this.send({ type: 'end' }); this.ended = true; this.ready = false
    clearTimeout(this.retryTimer)
    this.socket?.close(); this.audio.close(); this.callbacks.state('off')
  }
}
