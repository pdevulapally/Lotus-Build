import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loadModule(path: string, overrides: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  const module = { exports: {} as Record<string, React.ComponentType> }
  new Function('require', 'module', 'exports', compiled)(
    (id: string) => (id in overrides ? overrides[id] : require(id)),
    module,
    module.exports,
  )
  return module.exports
}
test('settings remains at its own protected route instead of redirecting away', () => {
  const source = readFileSync(
    new URL('../app/settings/page.tsx', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /router\.replace|SettingsRedirect|useEffect/)
  const module = loadModule('../app/settings/page.tsx', {
    '@/components/auth/protected-route': {
      ProtectedRoute: ({
        children,
        requiredTokens,
      }: {
        children: React.ReactNode
        requiredTokens: number
      }) => {
        assert.equal(requiredTokens, 0)
        return children
      },
    },
    '@/components/settings/settings-dialog': {
      SettingsPageContent: () =>
        createElement('main', null, 'Settings destination'),
    },
  })
  assert.equal(
    renderToStaticMarkup(createElement(module.default)),
    '<main>Settings destination</main>',
  )
})
test('settings uses custom icons and preserves sensitive action boundaries', () => {
  const source = readFileSync(
    new URL('../components/settings/settings-dialog.tsx', import.meta.url),
    'utf8',
  )
  assert.match(source, /components\/ui\/lotus-icons/)
  assert.doesNotMatch(source, /from 'lucide-react'/)
  assert.match(source, /disabled=\{busy \|\| !erasureConfirmed\}/)
  assert.match(source, /if \(operation\.current\) return/)
  assert.match(source, /hasPassword &&/)
  assert.match(source, /currentBackend\(\)\.requestErasure\(\)/)
  assert.match(source, /currentBackend\(\)\.billingPortal\(\)/)
  assert.match(source, /role="switch"\s+aria-checked=\{checked\}/)
  assert.match(source, /aria-current=\{\s*page === section.id/)
})
