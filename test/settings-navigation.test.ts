import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canShowSettingsFeedback,
  SETTINGS_SECTIONS,
  filterSettings,
  settingsPage,
} from '../components/settings/settings-sections'

test('settings deep links only resolve supported sections', () => {
  for (const section of SETTINGS_SECTIONS)
    assert.equal(settingsPage(section.id), section.id)
  for (const value of [null, '', '__proto__', 'admin', 'javascript:alert(1)'])
    assert.equal(settingsPage(value), 'account')
})
test('search finds controls by plain-language intent, case insensitively', () => {
  assert.deepEqual(
    filterSettings('PASSWORD').map((section) => section.id),
    ['security'],
  )
  assert.deepEqual(
    filterSettings('cookies').map((section) => section.id),
    ['privacy'],
  )
  assert.deepEqual(
    filterSettings('invoice').map((section) => section.id),
    ['billing'],
  )
  assert.deepEqual(
    filterSettings('  email verify  ').map((section) => section.id),
    ['account'],
  )
  assert.equal(filterSettings('not a real setting').length, 0)
  assert.equal(filterSettings('   ').length, SETTINGS_SECTIONS.length)
})

test('async feedback is scoped to the initiating account and settings section', () => {
  const origin = { uid: 'first-user', section: 'security' as const }
  assert.equal(canShowSettingsFeedback(origin, origin), true)
  assert.equal(
    canShowSettingsFeedback(origin, { uid: 'first-user', section: 'billing' }),
    false,
  )
  assert.equal(
    canShowSettingsFeedback(origin, {
      uid: 'second-user',
      section: 'security',
    }),
    false,
  )
  assert.equal(
    canShowSettingsFeedback(origin, { uid: undefined, section: 'security' }),
    false,
  )
  assert.equal(
    canShowSettingsFeedback(
      { uid: undefined, section: 'account' },
      { uid: undefined, section: 'account' },
    ),
    false,
  )
})
