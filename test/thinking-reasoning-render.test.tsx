import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { ThinkingReasoning, thoughtDuration } from '../components/ai-elements/thinking-reasoning'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/ai-elements/thinking-reasoning.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { ThinkingReasoning: typeof ThinkingReasoning; thoughtDuration: typeof thoughtDuration } }
const isolatedRequire = (id: string) => {
  if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
  return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
const render = (props: ComponentProps<typeof ThinkingReasoning>) => renderToStaticMarkup(createElement(module.exports.ThinkingReasoning, props))

const startedAt = '2026-11-13T21:00:00.000Z'

test('a streaming thought is open and says it is thinking, with the live text inside', () => {
  const html = render({ text: 'Reading the failing test first.', streaming: true, startedAt })
  assert.match(html, /Thinking…/); assert.match(html, /aria-expanded="true"/); assert.match(html, /data-thinking="streaming"/)
  assert.match(html, /Reading the failing test first\./)
  assert.doesNotMatch(html, /Thought for|clickable/)
})

test('a finished thought folds into how long it took, from the server timestamps, and can be reopened', () => {
  const html = render({ text: 'Done thinking.', streaming: false, startedAt, completedAt: '2026-11-13T21:00:02.400Z' })
  assert.match(html, /Thought<\/span> for 2s/); assert.match(html, /aria-expanded="false"/); assert.match(html, /clickable/)
  assert.match(html, /collapsed/); assert.match(html, /Done thinking\./, 'the text stays in the document for the toggle to reveal')
})

test('no end time means no invented duration', () => {
  const html = render({ text: 'Older thought.', streaming: false, startedAt })
  assert.match(html, /Thought<\/span> process/); assert.doesNotMatch(html, /for \d+s/)
})

test('thoughtDuration rounds to whole seconds, never below one, and refuses impossible or missing ends', () => {
  const duration = module.exports.thoughtDuration
  assert.equal(duration(startedAt, '2026-11-13T21:00:00.200Z'), '1s')
  assert.equal(duration(startedAt, '2026-11-13T21:00:12.600Z'), '13s')
  assert.equal(duration(startedAt, '2026-11-13T20:59:59.000Z'), undefined)
  assert.equal(duration(startedAt, 'not a date'), undefined)
  assert.equal(duration(startedAt), undefined)
})

test('model-authored thought text is rendered as text, never as markup', () => {
  const html = render({ text: '<img src=x onerror=alert(1)> and `code`', streaming: false, startedAt })
  assert.doesNotMatch(html, /<img/); assert.match(html, /<code[^>]*>code<\/code>/)
})
