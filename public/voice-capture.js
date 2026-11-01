/* Audio never persists: resample mono input to 16kHz PCM16 in bounded 200ms chunks. */
class LotusVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.samples = new Int16Array(3200); this.index = 0; this.phase = 0; this.sum = 0; this.count = 0; this.activeSamples = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    // This node is connected to a muted sink so browsers keep it processing.
    for (const channel of outputs[0] ?? []) channel.fill(0);
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample; this.count++; this.phase += 16000;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      const value = Math.max(-1, Math.min(1, this.sum / this.count)); this.sum = 0; this.count = 0;
      this.samples[this.index++] = Math.round(value * (value < 0 ? 32768 : 32767));
      this.activeSamples = Math.abs(value) > 0.025 ? this.activeSamples + 1 : Math.max(0, this.activeSamples - 1);
      if (this.activeSamples === 1280) this.port.postMessage({ type: 'activity' });
      if (this.index === this.samples.length) {
        this.port.postMessage({ type: 'audio', pcm: this.samples.buffer }, [this.samples.buffer]);
        this.samples = new Int16Array(3200); this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('lotus-voice-capture', LotusVoiceCapture);
