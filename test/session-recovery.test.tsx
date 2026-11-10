import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { BackendError } from '../lib/backend/client'
import { presentRequestError } from '../lib/backend/error-presentation'

const require = createRequire(import.meta.url)
const source = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/computer/[id]/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined
  const visit = (node: ts.Node) => { if (predicate(node)) found = node; else ts.forEachChild(node, visit) }
  visit(source)
  assert.ok(found, 'the real workspace recovery surface must remain covered')
  return found
}
// Evaluate the actual page expressions, with only the surrounding page state
// and RequestError shell supplied. No copied recovery predicate or handler.
function evaluate(node: ts.Node, context: Record<string, unknown>): any {
  const compiled = ts.transpileModule(`const { ${Object.keys(context).join(', ')} } = context; const result = (${node.getText(source)});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  return new Function('require', 'context', 'exports', `${compiled}\nreturn result`)(require, context, {})
}
const recovery = find((node) => ts.isCallExpression(node) && ts.isParenthesizedExpression(node.expression)
  && ts.isArrowFunction(node.expression.expression) && node.getText(source).includes('<RequestError '))
const answerAttribute = find((node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PendingInputCard') as ts.JsxSelfClosingElement
const answer = answerAttribute.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'onAnswer') as ts.JsxAttribute
assert.ok(answer.initializer && ts.isJsxExpression(answer.initializer) && answer.initializer.expression)
const answerHandler = answer.initializer.expression

function renderRecovery(runError: Error | string | null, streamError: string | null, fileError: string | null, sessionError: string | null) {
  return renderToStaticMarkup(evaluate(recovery, {
    runError, backend: { streamError, fileError, reconnect() {} }, raw: { error: sessionError },
    BackendError, presentRequestError, isTokenLimitError: () => false,
    RequestError: ({ error, children }: { error: Error; children?: ReactNode }) => createElement('section', { role: 'alert' }, error.message, children),
  }))
}

test('a failed run or rejected question answer never offers reconnect as if it could restart the task', () => {
  for (const html of [renderRecovery(null, null, null, 'The question could not be saved.'), renderRecovery(new Error('Answer was rejected.'), 'Connection interrupted.', null, null)]) {
    assert.match(html, /role="alert"/)
    assert.doesNotMatch(html, /<button/)
  }
})

test('transport and saved-file errors retain the matching read-only recovery controls', () => {
  assert.match(renderRecovery(null, 'Connection interrupted.', null, 'Task failed.'), />Reconnect<\/button>/)
  assert.match(renderRecovery(null, null, 'Could not read saved files.', null), />Refresh<\/button>/)
})

test('failed question answers surface their original error without an automatic resend', async () => {
  const failure = new BackendError(409, 'session/input-stale', 'This question has already been answered.')
  let displayed: unknown
  let calls = 0
  const onAnswer = evaluate(answerHandler, { handleRun: async (value: string) => { calls++; assert.equal(value, 'Teams'); throw failure }, setRunError: (value: unknown) => { displayed = value } }) as (answer: string) => void
  onAnswer('Teams')
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.strictEqual(displayed, failure)
  assert.equal(calls, 1)
})
