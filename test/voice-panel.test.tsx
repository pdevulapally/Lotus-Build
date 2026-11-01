import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { VoicePanelModel } from '../components/computer/voice-panel'

const require = createRequire(import.meta.url)
function load(file: string, dependencies: Record<string, unknown> = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> }
  new Function('require', 'module', 'exports', compiled)((id: string) => dependencies[id] ?? require(id), module, module.exports)
  return module.exports
}
const { VoicePanel } = load('../components/computer/voice-panel.tsx', {
  './voice-orb': load('../components/computer/voice-orb.tsx', {
    'next/dynamic': { __esModule: true, default: () => () => null },
    './voice-shader-settings': require('../components/computer/voice-shader-settings.ts'),
    './voice-orb.module.css': { __esModule: true, default: { stage: 'voice-orb-stage', orb: 'voice-orb', fallback: 'voice-orb-fallback' } },
  }),
})
const { VoiceInputControls } = load('../components/computer/voice-input-controls.tsx')
const actions = { onEnd() {}, onReconnect() {}, onMute() {}, onInterrupt() {} }
const model: VoicePanelModel = {
  state: 'connecting', muted: false, error: null,
}
const render = (overrides: Partial<VoicePanelModel> = {}) => renderToStaticMarkup(createElement(VoicePanel, { id: 'voice-controls', model: { ...model, ...overrides } }))
const controls = (state = 'listening', muted = false) => renderToStaticMarkup(createElement(VoiceInputControls, { state, muted, ...actions }))

test('inline voice connects without another start button, checkbox or privacy expander', () => {
  const html = render()
  assert.match(html, /id="voice-controls"/)
  assert.doesNotMatch(html, /role="dialog"|data-radix|Talk to LotusBuild<\/button>/)
  assert.match(html, /Connecting/)
  assert.match(html, /voice-orb-stage/)
  assert.match(html, /voice-orb-fallback/)
  assert.doesNotMatch(html, /<button/)
  assert.doesNotMatch(html, /Start voice|type="checkbox"|<details|<summary|Audio &amp; privacy/)
})

test('voice surface only shows the blob and call status, while composer controls own audio actions', () => {
  const html = render({ state: 'speaking' })
  assert.doesNotMatch(html, /Live voice captions|LotusBuild:/)
  assert.doesNotMatch(html, /<button/)
  for (const label of ['Stop speech', 'Mute microphone', 'End call']) assert.ok(controls('speaking').includes(`aria-label="${label}"`))
  assert.doesNotMatch(html, /Start voice|Voice privacy/)
  const muted = render({ state: 'listening', muted: true })
  assert.match(muted, /Microphone muted/)
  assert.match(controls('listening', true), /aria-label="Unmute microphone"/)
  assert.doesNotMatch(controls('listening'), /Stop speech/)
  assert.match(controls('permission'), /disabled=""/)
})

test('connection failures are explicit and offer a user-triggered reconnect', () => {
  const html = render({ state: 'error', error: 'Voice availability could not be checked.' })
  assert.match(html, /role="alert"/)
  assert.match(html, /Voice availability could not be checked/)
  assert.match(controls('error'), /Reconnect voice/)
  assert.doesNotMatch(html, /Start voice|type="checkbox"/)
})
