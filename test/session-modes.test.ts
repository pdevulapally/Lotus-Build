import assert from 'node:assert/strict'
import test from 'node:test'

import { accountSchema } from '../lib/backend/client'
import {
  defaultComputerSessionMode,
  getComputerSessionModeConfig,
  selectableSessionModeConfigs,
} from '../lib/backend/session-modes'

const account = {
  uid: 'user-1', email: 'user@example.test', emailVerified: true, projectCount: 0,
  plan: { key: 'free', name: 'Free' }, capabilities: [], limits: [], models: [],
}

test('without advertised modes (signed out or older backend) Auto, Build and Plan are offered with Auto default', () => {
  const parsed = accountSchema.parse(account)
  assert.deepEqual([...parsed.sessionModes].sort(), ['auto', 'build', 'plan'])
  assert.equal(parsed.defaultSessionMode, 'auto')
  assert.deepEqual(selectableSessionModeConfigs(undefined).map((mode) => mode.id), ['auto', 'build', 'plan'])
  assert.equal(defaultComputerSessionMode(undefined, undefined), 'auto')
  assert.equal(defaultComputerSessionMode(parsed.sessionModes, parsed.defaultSessionMode), 'auto')
})

test('a backend that advertises only Build and Plan keeps Build as the default', () => {
  const parsed = accountSchema.parse({ ...account, sessionModes: ['build', 'plan'], defaultSessionMode: 'build' })
  assert.deepEqual(selectableSessionModeConfigs(parsed.sessionModes).map((mode) => mode.id), ['build', 'plan'])
  assert.equal(defaultComputerSessionMode(parsed.sessionModes, parsed.defaultSessionMode), 'build')
})

test('Auto appears first and is the default when the server advertises it', () => {
  const parsed = accountSchema.parse({ ...account, sessionModes: ['build', 'plan', 'auto'], defaultSessionMode: 'auto' })
  assert.deepEqual(selectableSessionModeConfigs(parsed.sessionModes).map((mode) => mode.id), ['auto', 'build', 'plan'])
  assert.equal(defaultComputerSessionMode(parsed.sessionModes, parsed.defaultSessionMode), 'auto')
  assert.deepEqual(getComputerSessionModeConfig('auto'), {
    id: 'auto', label: 'Auto', description: 'Let LotusBuild decide whether to answer, clarify, plan, or build.',
  })
})

test('unknown future modes never break the account or enter this client picker', () => {
  const parsed = accountSchema.parse({ ...account, sessionModes: ['auto', 'future'], defaultSessionMode: 'future' })
  assert.deepEqual(selectableSessionModeConfigs(parsed.sessionModes).map((mode) => mode.id), ['auto'])
  assert.equal(defaultComputerSessionMode(parsed.sessionModes, parsed.defaultSessionMode), 'auto')
  assert.equal(defaultComputerSessionMode(['future'], 'future'), 'build')
})
