import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { billingSectionFromLocation, billingSections, billingSettingsPages } from '../lib/billing/navigation'

test('billing exposes on-demand credits as a first-class destination', () => {
  assert.deepEqual(billingSections.map(section => section.id), ['plan', 'usage', 'on-demand', 'payments'])
  for (const section of billingSections) assert.equal(billingSectionFromLocation(`#${section.id}`), section.id)
  assert.equal(billingSectionFromLocation(''), 'plan')
  assert.equal(billingSectionFromLocation('#unknown'), 'plan')
})

test('checkout returns show credits without losing explicit billing deep links', () => {
  assert.equal(billingSectionFromLocation('', true), 'on-demand')
  assert.equal(billingSectionFromLocation('#unknown', true), 'on-demand')
  assert.equal(billingSectionFromLocation('#payments', true), 'payments')
})

test('billing links map to the shared settings sections, including checkout returns', () => {
  assert.equal(billingSettingsPages[billingSectionFromLocation('#payments')], 'billing')
  assert.equal(billingSettingsPages[billingSectionFromLocation('#plan')], 'billing')
  assert.equal(billingSettingsPages[billingSectionFromLocation('#usage')], 'usage')
  assert.equal(billingSettingsPages[billingSectionFromLocation('', true)], 'on-demand')
})

test('account menu opens billing in settings without navigating away from the workspace', () => {
  const menu = readFileSync(new URL('../components/projects/sidebar-profile-menu.tsx', import.meta.url), 'utf8')
  assert.match(menu, /openSettings\('billing'\)/)
  assert.doesNotMatch(menu, /router\.push\("\/account\/billing"\)/)
  assert.doesNotMatch(menu, /router\.push\("\/pricing"\)/)
})
