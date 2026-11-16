import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { VerifiedEmailGate } from '../components/auth/verified-email-gate'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/auth/verified-email-gate.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function renderGate(state: {
  loading: boolean
  user: { uid: string } | null
  account: { uid: string; emailVerified: boolean } | null
  accountError?: string | null
}, pathname = '/computer/s1') {
  const module = { exports: {} as { VerifiedEmailGate: typeof VerifiedEmailGate } }
  // Render the actual boundary; only the router and signed-in identity are fixtures.
  const isolatedRequire = (id: string) => {
    if (id === 'next/navigation') return { usePathname: () => pathname, useRouter: () => ({ replace: () => {} }) }
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ ...state, accountError: state.accountError ?? null, refreshAccount: async () => {}, signOut: async () => {} }) }
    return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  let mounted = false
  function PrivateWorkspace(): ReactNode { mounted = true; return createElement('p', null, 'private-workspace') }
  const html = renderToStaticMarkup(createElement(module.exports.VerifiedEmailGate, null, createElement(PrivateWorkspace)))
  return { html, mounted }
}

test('private workspace never renders during startup, verification or a failed identity check', () => {
  for (const state of [
    { loading: true, user: null, account: null },
    { loading: false, user: { uid: 'u' }, account: null },
    { loading: false, user: { uid: 'u' }, account: { uid: 'u', emailVerified: false } },
    { loading: false, user: { uid: 'u' }, account: { uid: 'other', emailVerified: true } },
    { loading: false, user: { uid: 'u' }, account: null, accountError: 'Unavailable' },
  ]) {
    const { html, mounted } = renderGate(state)
    assert.equal(mounted, false)
    assert.doesNotMatch(html, /private-workspace/)
    assert.match(html, /role="status"|role="alert"/)
  }
})

test('a Firebase-verified account renders its workspace without a code screen', () => {
  const { html, mounted } = renderGate({ loading: false, user: { uid: 'google-user' }, account: { uid: 'google-user', emailVerified: true } })
  assert.equal(mounted, true)
  assert.match(html, /private-workspace/)
  assert.doesNotMatch(html, /Checking your account/)
})

test('the verification page remains reachable for an unverified password account', () => {
  const { mounted } = renderGate({ loading: false, user: { uid: 'password-user' }, account: { uid: 'password-user', emailVerified: false } }, '/verify-email')
  assert.equal(mounted, true)
})
