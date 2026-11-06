import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LogoLoader, LogoMark } from '../components/ui/logo-loader'

test('the one loader is the breathing mark with a screen-reader label, themed only when asked', () => {
  const dark = renderToStaticMarkup(createElement(LogoLoader, { label: 'Checking your account…', theme: 'dark' }))
  assert.match(dark, /role="status"/)
  assert.match(dark, /data-product-theme="dark"/); assert.match(dark, /class="[^"]*\bdark\b/)
  assert.match(dark, /animate-logo-breathe/); assert.match(dark, /lotusbuild-icon\.svg/)
  assert.match(dark, /<span class="sr-only">Checking your account…<\/span>/)
  assert.doesNotMatch(dark, /animate-spin|Loading\.\.\./)

  const inherited = renderToStaticMarkup(createElement(LogoLoader, { label: 'Opening your settings…' }))
  assert.doesNotMatch(inherited, /data-product-theme/); assert.doesNotMatch(inherited, /class="[^"]*\bdark\b/)

  const small = renderToStaticMarkup(createElement(LogoMark, { size: 24 }))
  assert.match(small, /width:24px/); assert.match(small, /animate-logo-breathe/); assert.match(small, /aria-hidden="true"/)
})
