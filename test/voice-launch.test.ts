import assert from 'node:assert/strict'
import test from 'node:test'
import { BrowserVoiceAudio, type VoiceAudio } from '../lib/voice/browser-audio'
import { handoffVoiceAudio, takeVoiceAudio } from '../lib/voice/launch'

function audio() {
  let closed = 0
  const resource: VoiceAudio = { start: async () => {}, mute() {}, play() {}, stopSpeech() {}, finishSpeech() {}, close() { closed++ } }
  return { resource, closed: () => closed }
}

test('click-unlocked audio is transferred once, to the matching account and session only', () => {
  const first = audio()
  handoffVoiceAudio('alice', 'session-a', first.resource)
  assert.equal(takeVoiceAudio('alice', 'session-a'), first.resource)
  assert.equal(takeVoiceAudio('alice', 'session-a'), undefined)
  assert.equal(first.closed(), 0)
  for (const [uid, session] of [['bob', 'session-a'], ['alice', 'session-b']]) {
    const other = audio()
    handoffVoiceAudio('alice', 'session-a', other.resource)
    assert.equal(takeVoiceAudio(uid!, session!), undefined)
    assert.equal(other.closed(), 1)
  }
})

test('replaced or abandoned audio resources are closed without starting microphone capture', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = audio(), second = audio()
  handoffVoiceAudio('alice', 'session-a', first.resource)
  handoffVoiceAudio('alice', 'session-b', second.resource)
  assert.equal(first.closed(), 1)
  t.mock.timers.tick(30_001)
  assert.equal(second.closed(), 1)
  assert.equal(takeVoiceAudio('alice', 'session-b'), undefined)
})

test('navigation reuses the unlocked audio context and access refusal never captures a microphone', async t => {
  let created = 0, resumed = 0, captured = 0, closed = 0
  class Context {
    state = 'suspended'
    constructor() { created++ }
    async resume() { resumed++; this.state = 'running' }
    async close() { closed++; this.state = 'closed' }
  }
  const replacements = {
    window: { isSecureContext: true, AudioContext: Context, AudioWorkletNode: class {} },
    AudioContext: Context,
    navigator: { mediaDevices: { getUserMedia: async () => { captured++; throw new Error('Must not capture') } } },
  }
  for (const [key, value] of Object.entries(replacements)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key) })
  }
  const resource = new BrowserVoiceAudio()
  await resource.prepare()
  await assert.rejects(resource.start(() => {}, () => {}, () => {}, async () => { throw new Error('Access refused') }), /Access refused/)
  resource.close()
  assert.equal(created, 1); assert.equal(resumed, 1); assert.equal(captured, 0); assert.equal(closed, 1)
})
