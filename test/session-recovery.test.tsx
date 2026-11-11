import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { BackendError } from '../lib/backend/client'
import { TaskNotice } from '../components/computer/task-notice'
import { selectTaskNotice } from '../lib/backend/task-notice'
import { isRejectedInputResponse } from '../lib/backend/send-message'

const require = createRequire(import.meta.url)
const source = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/computer/[id]/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined
  const visit = (node: ts.Node) => { if (predicate(node)) found = node; else ts.forEachChild(node, visit) }
  visit(source)
  assert.ok(found, 'the real workspace recovery surface must remain covered')
  return found
}
// Evaluate the actual answer handlers; render the shared notice for recovery checks.
function evaluate(node: ts.Node, context: Record<string, unknown>): any {
  const compiled = ts.transpileModule(`const { ${Object.keys(context).join(', ')} } = context; const result = (${node.getText(source)});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  return new Function('require', 'context', 'exports', `${compiled}\nreturn result`)(require, context, {})
}
const answerAttribute = find((node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PendingInputCard') as ts.JsxSelfClosingElement
const answer = answerAttribute.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'onAnswer') as ts.JsxAttribute
assert.ok(answer.initializer && ts.isJsxExpression(answer.initializer) && answer.initializer.expression)
const answerHandler = answer.initializer.expression
const declaration = (name: string) => (find((node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name) as ts.VariableDeclaration).initializer!
const reporter = (setRunError: (reason: unknown) => void) => evaluate(declaration('reportMessageError'), { setRunError })

function renderRecovery(runError: Error | string | null, streamError: string | null, fileError: string | null, sessionError: string | null) {
  return renderToStaticMarkup(createElement(TaskNotice, {
    notice: selectTaskNotice({ session: { id: 's', projectId: 'p', model: 'model', mode: 'build', effort: 'standard', status: 'FAILED', messageCount: 1, createdAt: '2026-11-11T00:00:00Z', ...(sessionError ? { error: sessionError } : {}) },
      requestError: runError, streamError, fileError }), busy: false, onContinue() {}, onCancel() {}, onReconnect() {},
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
  const onAnswer = evaluate(answerHandler, { handleRun: async (value: string) => { calls++; assert.equal(value, 'Teams'); throw failure }, reportMessageError: reporter((value) => { displayed = value }) }) as (answer: string) => void
  onAnswer('Teams')
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.strictEqual(displayed, failure)
  assert.equal(calls, 1)
})

test('retry failures are visible and retain the original question identity', async () => {
  const button = find((node) => ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'button' && node.children.some((child) => ts.isJsxText(child) && child.text === 'Retry original message')) as ts.JsxElement
  const attribute = button.openingElement.attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.getText(source) === 'onClick') as ts.JsxAttribute
  assert.ok(attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression)
  const failure = new TypeError('Lost acknowledgement'); let displayed: unknown; let received: unknown[] = []
  const pendingMessage = { prompt: 'Teams', attachments: [], inputResponse: { id: 'original-question', answer: 'Teams' } }
  const onClick = evaluate(attribute.initializer.expression, { pendingMessage,
    handleRun: async (...args: unknown[]) => { received = args; throw failure }, reportMessageError: reporter((value) => { displayed = value }) }) as () => void
  onClick(); await new Promise<void>((resolve) => setImmediate(resolve))
  assert.strictEqual(displayed, failure)
  assert.deepEqual(received, ['Teams', undefined, [], pendingMessage.inputResponse])
})

test('only definitive input rejection reloads the current question, without resubmitting it', async () => {
  for (const failure of [new BackendError(409, 'session/input-stale', 'Already answered.'), new BackendError(409, 'session/input-required', 'Question changed.'), new TypeError('Lost acknowledgement')]) {
    let refreshes = 0; let sends = 0; let reads = 0
    const run = evaluate(declaration('handleRun'), {
      busyRef: { current: false }, raw: { id: 's1', pendingInput: { id: 'q1', kind: 'question' } }, user: { uid: 'alice' },
      setIsStartingRun() {}, setRunError() {}, currentBackend() {}, pendingCommandStorage() {},
      sendMessage: async () => { sends++; throw failure }, backend: { refresh: async () => { refreshes++ } },
      isRejectedInputResponse, reportMessageError: assert.fail, readPending: () => { reads++ },
    }) as (answer: string) => Promise<void>
    await assert.rejects(run('Teams'), (reason) => reason === failure)
    assert.equal(refreshes, isRejectedInputResponse(failure) ? 1 : 0)
    assert.equal(sends, 1); assert.equal(reads, 1)
  }
})
