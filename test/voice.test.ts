import assert from 'node:assert/strict'
import test from 'node:test'
import { VoiceCall, type VoiceCallbacks, type VoiceState } from '../lib/voice/call'
import type { VoiceAudio } from '../lib/voice/browser-audio'
import { BackendClient } from '../lib/backend/client'
import { sendMessage, readPendingMessage } from '../lib/backend/send-message'

class Socket extends EventTarget {
  readyState = 1; bufferedAmount = 0; sent: unknown[] = []
  send(value: unknown) { this.sent.push(typeof value === 'string' ? JSON.parse(value) : value) }
  close(code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.dispatchEvent(Object.assign(new Event('close'), { code })) }
  message(value: object) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) }
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
function fixture(overrides: Partial<VoiceCallbacks> = {}, audioOverrides: Partial<VoiceAudio> = {}) {
  const sockets: Socket[] = [], states: VoiceState[] = [], transcripts: string[] = [], errors: string[] = [], unsent: string[] = [], played: string[] = []
  let closed = 0, stopped = 0, muted = false, reads = 0
  const audio: VoiceAudio = { start: async () => {}, mute: value => { muted = value }, play: data => played.push(data), stopSpeech: () => { stopped++ }, finishSpeech: done => done(), close: () => { closed++ }, ...audioOverrides }
  const client = { voiceAccess: async () => ({ privacyVersion: 'v1', maxCallSeconds: 60 }), voiceSocket: async (sessionId: string, consentVersion: string) => { assert.equal(sessionId, 'task'); assert.equal(consentVersion, 'v1'); const socket = new Socket(); sockets.push(socket); return socket as unknown as WebSocket } }
  const call = new VoiceCall(client, audio, 'task', 'v1', { state: state => states.push(state), partial: () => {}, transcript: async (_id, text) => { transcripts.push(text) }, error: message => errors.push(message), unsent: text => unsent.push(text), ready: () => { reads++ }, ...overrides })
  return { call, sockets, states, transcripts, errors, unsent, played, stats: () => ({ closed, stopped, muted, reads }), ready: () => sockets.at(-1)!.message({ type: 'ready', callId: 'call', maxCallSeconds: 60 }) }
}
test('mock voice-to-task flow uses the same text HTTP command and idempotency identity', async () => {
  const requests: { path: string; key: string | null; body: unknown }[] = []
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test-token', fetch: async (input, init) => {
    requests.push({ path: String(input), key: new Headers(init?.headers).get('Idempotency-Key'), body: JSON.parse(String(init?.body)) })
    return Response.json({ steered: true, sessionId: 'task' })
  } })
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
  const f = fixture({ transcript: async (_id, text) => { await sendMessage(client, storage, 'alice', 'task', text, undefined, [], undefined, true) } })
  await f.call.start(); f.ready()
  const turn = { type: 'transcript.final', id: 'call:1', text: 'Use the existing project and change the button' }
  f.sockets[0].message(turn); f.sockets[0].message(turn); await flush()
  assert.equal(requests.length, 1); assert.equal(requests[0].path, 'https://backend.example/sessions/task/messages')
  assert.deepEqual(requests[0].body, { prompt: turn.text, steer: true }); assert.ok(requests[0].key); assert.equal(data.size, 0)
  f.call.end()
})
test('uncertain voice acceptance retains the text retry key and prevents a different task command', async () => {
  const data = new Map<string, string>(), keys: string[] = []
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
  let fail = true
  const client = new BackendClient({ origin: 'https://backend.example', token: async () => 'test', fetch: async (_input, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key')!); if (fail) throw new Error('Network lost after dispatch')
    return Response.json({ steered: true, sessionId: 'task' })
  } })
  await assert.rejects(sendMessage(client, storage, 'alice', 'task', 'Make it blue', undefined, [], undefined, true))
  assert.equal(readPendingMessage(storage, 'alice', 'task')?.steer, true)
  await assert.rejects(sendMessage(client, storage, 'alice', 'task', 'Make it red', undefined, [], undefined, true), /pending message/)
  fail = false; await sendMessage(client, storage, 'alice', 'task', 'Make it blue', undefined, [], undefined, true)
  assert.equal(keys[0], keys[1]); assert.equal(data.size, 0)
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
  f.sockets[0].message({ type: 'transcript.final', id: 'call:1', text: 'Continue' }); await flush()
  f.sockets[0].close(4502); assert.equal(f.states.at(-1), 'reconnecting')
  t.mock.timers.tick(501); await flush(); assert.equal(f.sockets.length, 2); f.ready()
  assert.equal(f.stats().reads, 2); assert.deepEqual(f.transcripts, ['Continue'])
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
test('muting, ending a call and failed acceptance preserve the text alternative and unsent words', async () => {
  const f = fixture({ transcript: async () => { throw new Error('Use the on-screen approval') } })
  await f.call.start(); f.ready(); f.call.mute(true); assert.equal(f.stats().muted, true)
  f.sockets[0].message({ type: 'transcript.final', id: 'call:1', text: 'Approve' })
  f.sockets[0].message({ type: 'transcript.final', id: 'call:2', text: 'Also publish it' }); await flush()
  assert.equal(f.states.at(-1), 'error'); assert.deepEqual(f.unsent, ['Also publish it']); assert.match(f.errors[0], /on-screen approval/)
})
