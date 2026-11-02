import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import {
  CONSENT_STORAGE_KEY, CONSENT_VERSION, CONSENT_UPDATED_EVENT,
  getStoredConsent, parseConsent, saveConsent, subscribeToConsent,
} from '../lib/privacy/cookie-consent'
import { consentedAnalyticsEvent, isMeasuredPath } from '../lib/privacy/analytics'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let records: Map<string, string>
let target: EventTarget
let denyWrite = false
let denyRead = false

beforeEach(() => {
  records = new Map()
  target = new EventTarget()
  denyWrite = false
  denyRead = false
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { origin: 'https://lotusbuild.co.uk' },
    localStorage: {
      getItem: (key: string) => { if (denyRead) throw new Error('blocked'); return records.get(key) ?? null },
      setItem: (key: string, value: string) => { if (denyWrite) throw new Error('blocked'); records.set(key, value) },
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  } })
  saveConsent(false)
  records.clear()
})

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

test('absent, malformed, legacy, future and permissively typed records never authorise analytics', () => {
  const valid = { version: CONSENT_VERSION, essential: true, analytics: true, decidedAt: 100 }
  for (const raw of [null, '', 'broken', 'null', 'true', '{}',
    JSON.stringify({ ...valid, version: 0 }), JSON.stringify({ ...valid, analytics: 'true' }),
    JSON.stringify({ ...valid, decidedAt: 201 }), JSON.stringify({ ...valid, essential: false }),
    JSON.stringify({ ...valid, extra: true }), JSON.stringify({ analytics: true, functional: true, decidedAt: 100 }),
  ]) assert.equal(parseConsent(raw, 200), null)
  assert.deepEqual(parseConsent(JSON.stringify(valid), 200), valid)
  assert.equal(consentedAnalyticsEvent({ url: '/welcome' }), null)
  denyRead = true
  assert.equal(getStoredConsent(), null)
})

test('only consented public-page URLs are returned, without query or fragment data', () => {
  saveConsent(true)
  assert.deepEqual(consentedAnalyticsEvent({ type: 'pageview', url: 'https://lotusbuild.co.uk/pricing?email=private#secret' }), {
    type: 'pageview', url: 'https://lotusbuild.co.uk/pricing',
  })
  for (const path of ['/computer/private-id', '/project/private-id', '/signup', '/login',
    '/integrations/github/setup?code=secret', '/billing/cancel', 'https://other.example/welcome', 'https://[invalid',
  ]) assert.equal(consentedAnalyticsEvent({ url: path }), null)
  assert.equal(isMeasuredPath('/welcome'), true)
  assert.equal(isMeasuredPath(null), false)
  saveConsent(false)
  assert.equal(consentedAnalyticsEvent({ url: '/welcome' }), null)
})

test('withdrawal blocks the same retained SDK callback immediately, including failed persistence', () => {
  saveConsent(true)
  const retainedCallback = consentedAnalyticsEvent
  assert.ok(retainedCallback({ url: '/welcome' }))
  denyWrite = true
  assert.throws(() => saveConsent(false), /could not be saved/)
  assert.equal(JSON.parse(records.get(CONSENT_STORAGE_KEY)!).analytics, true)
  assert.equal(getStoredConsent()?.analytics, false)
  assert.equal(retainedCallback({ url: '/welcome' }), null)
  assert.throws(() => saveConsent(true), /could not be saved/)
  assert.equal(retainedCallback({ url: '/welcome' }), null)
})

test('cross-tab changes and browser clearing refresh consumers; event payloads cannot grant consent', () => {
  let notifications = 0
  const unsubscribe = subscribeToConsent(() => { notifications++ })
  saveConsent(true)
  assert.equal(notifications, 1)
  records.clear()
  target.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  assert.equal(notifications, 2)
  assert.equal(consentedAnalyticsEvent({ url: '/welcome' }), null)
  target.dispatchEvent(new Event(CONSENT_UPDATED_EVENT))
  assert.equal(getStoredConsent(), null)
  unsubscribe()
  target.dispatchEvent(new Event(CONSENT_UPDATED_EVENT))
  assert.equal(notifications, 3)
})
