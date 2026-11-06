import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { DesktopPanelView } from '../components/computer/desktop-panel'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/desktop-panel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { DesktopPanelView: typeof DesktopPanelView } }
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
