import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingsButton } from '../components/settings/settings-button'

test('settings actions share explicit pill corners and 44px minimum targets across variants and sizes', () => {
  for (const variant of ['default', 'outline', 'ghost', 'secondary', 'destructive'] as const) {
    for (const size of ['default', 'sm', 'lg', 'icon'] as const) {
      const html = renderToStaticMarkup(createElement(SettingsButton, { variant, size }, 'Action'))
      assert.match(html, /rounded-full/)
      assert.match(html, /min-h-11/)
      assert.match(html, /min-w-11/)
      assert.doesNotMatch(html, /rounded-(md|xl)/)
      assert.match(html, /focus-visible:ring/)
    }
  }
})

test('settings action styling preserves link destinations and disabled button semantics', () => {
  const link = renderToStaticMarkup(createElement(SettingsButton, { asChild: true }, createElement('a', { href: '/account/billing' }, 'Manage billing')))
  assert.match(link, /<a[^>]*href="\/account\/billing"/)
  assert.match(link, /rounded-full/)
  const disabled = renderToStaticMarkup(createElement(SettingsButton, { disabled: true }, 'Refresh'))
  assert.match(disabled, /disabled=""/)
  assert.match(disabled, /disabled:pointer-events-none/)
})
