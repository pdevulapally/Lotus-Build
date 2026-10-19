import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionEvent } from '../lib/backend/client'
import {
  computerActionLabel,
  desktopCloseAction,
  desktopSocketUrl,
  reduceDesktop,
  type DesktopState,
} from '../lib/backend/desktop'

const event = (type: string, data: Record<string, unknown>): SessionEvent => ({ type, data })
const none: DesktopState = { status: 'none' }

test('desktop socket URLs require a secure or loopback API origin and preserve the ticket as one query value', () => {
  assert.equal(
    desktopSocketUrl('https://api.example.test', 'session_1', 'one-use+ticket'),
    'wss://api.example.test/sessions/session_1/desktop?ticket=one-use%2Bticket',
  )
  assert.equal(
    desktopSocketUrl('http://localhost:3000', 'session_1', 'ticket'),
    'ws://localhost:3000/sessions/session_1/desktop?ticket=ticket',
  )
  for (const origin of ['http://api.example.test', 'https://user:pass@api.example.test', 'https://api.example.test/path']) {
    assert.throws(() => desktopSocketUrl(origin, 'session_1', 'ticket'))
  }
  assert.throws(() => desktopSocketUrl('https://api.example.test', 'bad/id', 'ticket'))
  assert.throws(() => desktopSocketUrl('https://api.example.test', 'session_1', ''))
})

test('desktop events fold in replay order, including an end without a prior ready event', () => {
  const ready = reduceDesktop(none, event('desktop.ready', { width: 1280, height: 800 }))
  assert.deepEqual(ready, { status: 'ready', width: 1280, height: 800 })
  assert.deepEqual(reduceDesktop(ready, event('desktop.ended', { reason: 'session-ended' })), {
    status: 'ended',
    reason: 'session-ended',
  })
  assert.deepEqual(reduceDesktop(none, event('desktop.ended', { reason: 'error' })), {
    status: 'ended',
    reason: 'error',
  })
  assert.equal(reduceDesktop(none, event('desktop.ready', { width: 0, height: 800 })), none)
})

test('all documented WebSocket close codes map to the required policy', () => {
  const expected: Record<number, string> = {
    1000: 'stop',
    1001: 'reconnect-backoff',
    4400: 'stop',
    4401: 'retry-once',
    4403: 'stop',
    4404: 'stop',
    4409: 'wait-ready',
    4410: 'quiet-reconnect',
    4413: 'slow',
    4429: 'capacity',
    4500: 'reconnect-backoff',
    1006: 'reconnect-backoff',
  }
  for (const [code, action] of Object.entries(expected)) assert.equal(desktopCloseAction(Number(code)), action)
})

test('computer action labels are friendly and unknown actions remain safe', () => {
  assert.equal(computerActionLabel('left_click', { coordinate: [143, 312] }), 'Clicking at 143, 312')
  assert.equal(computerActionLabel('scroll', { scroll_direction: 'down' }), 'Scrolling down')
  assert.equal(computerActionLabel('type', { text: 'unrendered text' }), 'Typing')
  assert.equal(computerActionLabel('screenshot', {}), 'Looking at the screen')
  assert.equal(computerActionLabel('new_action', { text: '<script>' }), 'Using the computer')
})
