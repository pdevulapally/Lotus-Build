import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(
  readFileSync(new URL('../components/ui/navbar.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText

// Render the actual navbar with auth already resolved, as it can be when a
// shared provider updates before this boundary hydrates. No Firebase calls.
function initialNavbar(user: { uid: string; email: string } | null, loading: boolean) {
  const module = { exports: {} as { Navbar: () => ReactNode } }
  const children = ({ children }: { children?: ReactNode }) => children
  const isolatedRequire = (id: string) => {
    if (id === '@/contexts/auth-context') return { useAuth: () => ({ user, loading }) }
    if (id === 'next/navigation') return { usePathname: () => '/welcome' }
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }
    if (id === '@/components/settings/settings-dialog') return { useSettingsDialog: () => ({ openSettings: () => {} }) }
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (id.startsWith('@/components/ui/')) return new Proxy({}, { get: () => children })
    return require(id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  return renderToStaticMarkup(createElement(module.exports.Navbar))
}

test('navbar initial markup matches pending SSR even when auth has resolved before hydration', () => {
  const server = initialNavbar(null, true)
  assert.match(server, /Loading account/)
  assert.equal(initialNavbar(null, false), server)
  assert.equal(initialNavbar({ uid: 'test-user', email: 'test@example.com' }, false), server)
  assert.doesNotMatch(server, /href="\/(login|signup)"|Open workspace/)
})
