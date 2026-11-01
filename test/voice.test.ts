import assert from 'node:assert/strict'
import test from 'node:test'
import { VoiceCall, type VoiceCallbacks, type VoiceState } from '../lib/voice/call'
import type { VoiceAudio } from '../lib/voice/browser-audio'
import { BackendClient } from '../lib/backend/client'

class Socket extends EventTarget {
  readyState = 1; bufferedAmount = 0; sent: unknown[] = []
  send(value: unknown) { this.sent.push(typeof value === 'string' ? JSON.parse(value) : value) }
  close(code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.dispatchEvent(Object.assign(new Event('close'), { code })) }
  message(value: object) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) }
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
function fixture(overrides: Partial<VoiceCallbacks> = {}, audioOverrides: Partial<VoiceAudio> = {}) {
  const sockets: Socket[] = [], states: VoiceState[] = [], captions: string[] = [], errors: string[] = [], played: string[] = []
  let closed = 0, stopped = 0, muted = false, reads = 0
  const audio: VoiceAudio = { start: async () => {}, mute: value => { muted = value }, play: data => played.push(data), stopSpeech: () => { stopped++ }, finishSpeech: done => done(), close: () => { closed++ }, ...audioOverrides }
  const client = { voiceAccess: async () => ({ privacyVersion: 'v1', maxCallSeconds: 60 }), voiceSocket: async (sessionId: string, consentVersion: string) => { assert.equal(sessionId, 'task'); assert.equal(consentVersion, 'v1'); const socket = new Socket(); sockets.push(socket); return socket as unknown as WebSocket } }
  const call = new VoiceCall(client, audio, 'task', 'v1', { state: state => states.push(state), partial: () => {}, caption: (speaker, text) => { captions.push(`${speaker}: ${text}`) }, error: message => errors.push(message), ready: () => { reads++ }, ...overrides })
  return { call, sockets, states, captions, errors, played, stats: () => ({ closed, stopped, muted, reads }), ready: () => sockets.at(-1)!.message({ type: 'ready', callId: 'call', maxCallSeconds: 60 }) }
}
test('native voice captions do not submit browser task commands', async () => {
  const f = fixture(); await f.call.start(); f.ready()
  f.sockets[0].message({ type: 'voice.caption', speaker: 'user', text: 'Which approach?' })
  f.sockets[0].message({ type: 'voice.caption', speaker: 'assistant', text: 'Let us clarify the task.' })
  assert.deepEqual(f.captions, ['user: Which approach?', 'assistant: Let us clarify the task.'])
  assert.equal(f.sockets[0].sent.length, 0); f.call.end()
})
test('private voice sockets keep identity out of URLs and only send a fresh Firebase token in the first frame', async t => {
  let connectedUrl = '', refreshed = false
  const Original = globalThis.WebSocket
  class BrowserSocket extends Socket { constructor(url: string | URL) { super(); connectedUrl = String(url) } }
  globalThis.WebSocket = BrowserSocket as unknown as typeof WebSocket
  t.after(() => { globalThis.WebSocket = Original })
  const client = new BackendClient({ origin: 'https://backend.example', token: async refresh => { refreshed ||= refresh === true; return 'private-test-token' },
    fetch: async (_input, init) => { assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-test-token'); return Response.json({ privacyVersion: 'v1', maxCallSeconds: 60 }) } })
  const socket = await client.voiceSocket('task', 'v1') as unknown as BrowserSocket
  assert.equal(connectedUrl, 'wss://backend.example/sessions/task/voice'); assert.equal(refreshed, true); assert.equal(socket.sent.length, 0)
  socket.dispatchEvent(new Event('open')); assert.deepEqual(socket.sent, [{ type: 'authenticate', token: 'private-test-token', consentVersion: 'v1' }])
  await assert.rejects(client.voiceSocket('task', 'stale'), /privacy information changed/)
})
test('barge-in stops local playback immediately and discards audio from the interrupted generation', async () => {
  const f = fixture(); await f.call.start(); f.ready()
  f.sockets[0].message({ type: 'speech.started', generation: 1, sampleRate: 24000 })
  f.sockets[0].message({ type: 'speech.audio', generation: 1, audio: 'AAAA' })
  f.call.interrupt(); f.sockets[0].message({ type: 'speech.audio', generation: 1, audio: 'stale' })
  assert.deepEqual(f.played, ['AAAA']); assert.ok(f.stats().stopped > 0)
  assert.deepEqual(f.sockets[0].sent.at(-1), { type: 'interrupt' }); f.call.end()
  assert.equal(f.sockets[0].sent.some((value: unknown) => (value as { type?: string }).type === 'cancel'), false)
})
test('reconnection refreshes the same task, does not replay utterances and has a bounded retry count', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(); await f.call.start(); f.ready()
  f.sockets[0].message({ type: 'voice.caption', speaker: 'user', text: 'Continue' }); await flush()
  f.sockets[0].close(4502); assert.equal(f.states.at(-1), 'reconnecting')
  t.mock.timers.tick(501); await flush(); assert.equal(f.sockets.length, 2); f.ready()
  assert.equal(f.stats().reads, 2); assert.deepEqual(f.captions, ['user: Continue'])
  for (const delay of [1001, 2001]) { f.sockets.at(-1)!.close(4502); t.mock.timers.tick(delay); await flush(); f.ready() }
  f.sockets.at(-1)!.close(4502); assert.equal(f.states.at(-1), 'error'); assert.equal(f.sockets.length, 4); assert.equal(f.stats().closed, 1)
})
test('permission denial never opens a provider connection and always releases audio resources', async () => {
  const f = fixture({}, { start: async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) } })
  await f.call.start(); assert.equal(f.sockets.length, 0); assert.equal(f.stats().closed, 1); assert.match(f.errors[0], /permission was denied/)
})
test('expired access and privacy-policy failures do not reconnect or start new tasks', async () => {
  for (const code of [4401, 4429, 4503, 4410]) {
    const f = fixture(); await f.call.start(); f.ready(); f.sockets[0].close(code)
    assert.equal(f.states.at(-1), 'error'); assert.equal(f.sockets.length, 1); assert.equal(f.stats().closed, 1)
  }
})
test('muting and ending affect audio only, leaving task controls in text', async () => {
  const f = fixture(); await f.call.start(); f.ready(); f.call.mute(true)
  assert.equal(f.stats().muted, true); f.call.end()
  assert.deepEqual(f.sockets[0].sent, [{ type: 'end' }]); assert.equal(f.stats().closed, 1)
})

test('successive native chunks preserve queued playback at the negotiated sample rate', async () => {
  const rates: number[] = []; const f = fixture({}, { play: (_data, rate) => { rates.push(rate) } })
  await f.call.start(); f.ready(); const before = f.stats().stopped
  for (const generation of [1, 2, 3]) {
    f.sockets[0].message({ type: 'speech.started', generation, sampleRate: 48000 })
    f.sockets[0].message({ type: 'speech.audio', generation, audio: 'AAAA' })
  }
  assert.deepEqual(rates, [48000, 48000, 48000]); assert.equal(f.stats().stopped, before)
  f.call.end()
})