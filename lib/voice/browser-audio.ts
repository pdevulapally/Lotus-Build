export interface VoiceAudio {
  start(onChunk: (pcm: ArrayBuffer) => void, onActivity: () => void, onFailure: () => void, access: () => Promise<void>): Promise<void>
  mute(muted: boolean): void
  play(base64: string, sampleRate: number): void
  stopSpeech(): void
  finishSpeech(onFinished: () => void): void
  close(): void
}

/** One user-gesture AudioContext for capture and playback, including mobile Safari. */
export class BrowserVoiceAudio implements VoiceAudio {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private capture: AudioWorkletNode | null = null
  private input: MediaStreamAudioSourceNode | null = null
  private sink: GainNode | null = null
  private sources = new Set<AudioBufferSourceNode>()
  private nextTime = 0
  private trailing: number | null = null
  private ended: (() => void) | null = null
  private closed = false
  async start(onChunk: (pcm: ArrayBuffer) => void, onActivity: () => void, onFailure: () => void, access: () => Promise<void>) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error('Voice needs a supported browser and a secure connection. You can continue in text.')
    // Resume during the click, before awaiting microphone permissions.
    const context = new AudioContext(); this.context = context
    await Promise.all([context.resume(), access()])
    if (this.closed) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); return }
    this.stream = stream
    await context.audioWorklet.addModule('/voice-capture.js')
    if (this.closed) return
    this.capture = new AudioWorkletNode(context, 'lotus-voice-capture')
    this.capture.port.onmessage = (event: MessageEvent<{ type: string; pcm?: ArrayBuffer }>) => {
      if (this.closed) return
      if (event.data.type === 'activity') onActivity()
      if (event.data.type === 'audio' && event.data.pcm) onChunk(event.data.pcm)
    }
    this.input = context.createMediaStreamSource(stream)
    this.sink = context.createGain(); this.sink.gain.value = 0
    this.input.connect(this.capture); this.capture.connect(this.sink); this.sink.connect(context.destination)
    context.onstatechange = () => {
      if (!this.closed && ['suspended', 'interrupted'].includes(String(context.state))) { this.close(); onFailure() }
    }
    // Device revocation/unplugging must terminate capture, never look like silent listening.
    for (const track of stream.getAudioTracks()) {
      track.onended = () => { this.close(); onFailure() }
      track.onmute = () => { this.close(); onFailure() }
    }
  }
  mute(muted: boolean) { for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !muted }
  play(base64: string, sampleRate: number) {
    const context = this.context
    if (!context || context.state !== 'running' || this.closed) throw new Error('Audio playback was paused by your browser. End and restart voice, or use text.')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length + (this.trailing === null ? 0 : 1))
    let offset = 0
    if (this.trailing !== null) bytes[offset++] = this.trailing
    for (let i = 0; i < binary.length; i++) bytes[offset + i] = binary.charCodeAt(i)
    const length = bytes.length - bytes.length % 2
    this.trailing = length < bytes.length ? bytes[length] : null
    if (!length) return
    const samples = new Float32Array(length / 2), view = new DataView(bytes.buffer)
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768
    this.nextTime = Math.max(context.currentTime, this.nextTime)
    if (this.nextTime - context.currentTime > 90) throw new Error('Voice playback exceeded its buffer limit. The response remains in chat.')
    if (![8000, 16000, 22050, 24000, 44100, 48000].includes(sampleRate)) throw new Error('Unsupported voice audio format.')
    const buffer = context.createBuffer(1, samples.length, sampleRate); buffer.copyToChannel(samples, 0)
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination)
    this.sources.add(source)
    source.onended = () => { source.disconnect(); this.sources.delete(source); if (!this.sources.size && this.ended) { const done = this.ended; this.ended = null; done() } }
    source.start(this.nextTime); this.nextTime += buffer.duration
  }
  finishSpeech(done: () => void) { if (this.sources.size) this.ended = done; else done() }
  stopSpeech() { this.ended = null; for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect() }; this.sources.clear(); this.nextTime = 0; this.trailing = null }
  close() {
    if (this.closed) return
    this.closed = true; this.stopSpeech()
    this.capture?.disconnect(); this.input?.disconnect(); this.sink?.disconnect()
    for (const track of this.stream?.getTracks() ?? []) { track.onended = null; track.onmute = null; track.stop() }
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => {}) }
  }
}
