import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { DesktopPanelView, desktopStartOutcome } from '../components/computer/desktop-panel'
import { BackendError } from '../lib/backend/client'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/desktop-panel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { DesktopPanelView: typeof DesktopPanelView; desktopStartOutcome: typeof desktopStartOutcome } }
const isolatedRequire = (id: string) => {
  if (id === '@/components/ai-elements/shimmer') return { Shimmer: ({ children }: { children: React.ReactNode }) => createElement('span', { 'data-shimmer': '' }, children) }
  if (id === '@/components/ui/button') return { Button: (props: Record<string, unknown>) => createElement('button', { type: 'button' }, props.children as React.ReactNode) }
  if (id === '@/lib/backend/browser') return { currentBackend: () => { throw new Error('not used by the view') } }
  return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
const render = (props: ComponentProps<typeof DesktopPanelView>) => renderToStaticMarkup(createElement(module.exports.DesktopPanelView, props))

test('the desktop tab offers Start desktop only while a run can take it, and is honest otherwise', () => {
  const idle = render({ state: 'idle', onStart: () => {} })
  assert.match(idle, /No desktop yet/); assert.match(idle, /<button[^>]*>Start desktop<\/button>/)
  const waiting = render({ state: 'waiting', onStart: () => {} })
  assert.match(waiting, /available while the agent is working/); assert.doesNotMatch(waiting, /<button/)
  const starting = render({ state: 'starting' })
  assert.match(starting, /data-shimmer[^>]*>Starting the desktop/); assert.doesNotMatch(starting, /<button/)
  assert.doesNotMatch(render({ state: 'idle' }), /<button/, 'no handler, no button')
  for (const html of [idle, waiting, starting]) assert.doesNotMatch(html, /sandbox|provision|execution|handoff/i, 'no internal vocabulary reaches the user')
})

test('a failed Start desktop says so briefly and offers a retry; an older server is named as such, never left spinning', () => {
  const failed = render({ state: 'start-failed', onStart: () => {} })
  assert.match(failed, /Couldn(?:&#x27;|')t start the desktop/); assert.match(failed, /<button[^>]*>Try again<\/button>/)
  const notOffered = render({ state: 'not-offered', onStart: () => {} })
  assert.match(notOffered, /isn(?:&#x27;|')t available on this server yet/); assert.doesNotMatch(notOffered, /<button/)
  const outcome = module.exports.desktopStartOutcome
  const error = (status: number, code: string) => new BackendError(status, code, 'x')
  assert.equal(outcome(error(409, 'desktop/no-active-run')), 'no-run')
  assert.equal(outcome(error(409, 'session/execution-changed')), 'no-run')
  assert.equal(outcome(error(409, 'desktop/unsupported')), 'not-offered')
  assert.equal(outcome(error(404, 'route/not-found')), 'not-offered')
  assert.equal(outcome(error(500, 'internal')), 'failed')
  assert.equal(outcome(new TypeError('fetch failed')), 'failed')
})
