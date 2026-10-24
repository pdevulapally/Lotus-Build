import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Exercise the actual home component without Firebase or backend calls.
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function renderHome(user: { uid: string } | null, loading = false) {
  const module = { exports: {} as { default: () => React.ReactNode } }
  const isolatedRequire = (id: string) => {
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ user, loading }) }
    if (id === '@/components/projects/projects-workspace') return { ProjectsWorkspace: () => createElement('main', null, 'Original workspace') }
    if (id === '@/components/landing/landing-page') return { LandingPage: () => createElement('main', null, 'Public landing') }
    if (id === 'next/navigation') throw new Error('Home must render the workspace at /, not redirect it.')
    return require(id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  return renderToStaticMarkup(createElement(module.exports.default))
}

test('signed-in visitors see the original workspace directly at home', () => {
  assert.equal(renderHome({ uid: 'test-user' }), '<main>Original workspace</main>')
})

test('signed-out visitors see the public landing at home', () => {
  assert.equal(renderHome(null), '<main>Public landing</main>')
})

test('pending auth shows loading without a redirect or workspace flash', () => {
  const html = renderHome(null, true)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /Original workspace|Public landing/)
})
