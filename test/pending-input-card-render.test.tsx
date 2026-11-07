import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ts from 'typescript'
import type { PendingInputCard, firstUnansweredQuestion, formatPendingInputAnswers } from '../components/computer/pending-input-card'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/pending-input-card.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as {
  PendingInputCard: typeof PendingInputCard
  firstUnansweredQuestion: typeof firstUnansweredQuestion
  formatPendingInputAnswers: typeof formatPendingInputAnswers
} }
const isolatedRequire = (id: string) => {
  if (id === '@/components/ui/markdown') return {
    Markdown: ({ children, className }: { children: string; className?: string }) =>
      createElement('div', { className }, createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], skipHtml: true }, children)),
  }
  return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)

test('a clarification keeps Markdown structure instead of collapsing it into one plain paragraph', () => {
  const html = renderToStaticMarkup(createElement(module.exports.PendingInputCard, {
    request: { id: 'q1', kind: 'question', prompt: 'One thing to confirm:\n\n1. **Who is this for?**\n2. **What should happen first?**' },
    busy: false, onAnswer() {},
  }))
  assert.match(html, /<ol>/); assert.match(html, /<strong>Who is this for\?<\/strong>/)
  assert.match(html, /Type your answer/); assert.match(html, /Continue/)
  assert.doesNotMatch(html, /\*\*Who is this for/)
})

test('approval actions remain explicit and model-authored HTML is never rendered', () => {
  const html = renderToStaticMarkup(createElement(module.exports.PendingInputCard, {
    request: { id: 'a1', kind: 'approval', prompt: 'Publish <script>alert(1)</script>?' },
    busy: true, onAnswer() {},
  }))
  assert.match(html, /Approve/); assert.match(html, /Reject/); assert.match(html, /disabled=""/)
  assert.doesNotMatch(html, /<script>/); assert.doesNotMatch(html, /Reply below/)
})

test('structured questions render one question with navigation, choices and the natural lead-in', () => {
  const html = renderToStaticMarkup(createElement(module.exports.PendingInputCard, {
    request: { id: 'request', kind: 'question', prompt: 'A couple of quick choices:', questions: [
      { id: 'q1', prompt: 'Who is this for?', options: [{ label: 'Teams' }, { label: 'Individuals', description: 'People choosing for themselves.' }] },
      { id: 'q2', prompt: 'What should happen first?', options: [{ label: 'Collect leads' }, { label: 'Sell products' }] },
    ] },
    busy: false, onAnswer() {},
  }))
  assert.match(html, /A couple of quick choices:/)
  assert.match(html, /Question 1 of 2/)
  assert.match(html, /Who is this for\?/)
  assert.match(html, /Something else/)
  assert.match(html, /aria-label="Previous question"/)
  assert.match(html, /aria-label="Next question"/)
  assert.doesNotMatch(html, /What should happen first\?/)
})

test('answer serialization requires every question and preserves question order', () => {
  const questions = [
    { id: 'q1', prompt: 'Who is this for?' },
    { id: 'q2', prompt: 'What should happen first?' },
  ]
  assert.equal(module.exports.firstUnansweredQuestion(questions, { q2: 'Collect leads' }), 0)
  assert.equal(module.exports.firstUnansweredQuestion(questions, { q1: 'Teams', q2: 'Collect leads' }), -1)
  assert.equal(module.exports.formatPendingInputAnswers(questions, { q1: 'Teams', q2: 'Collect leads' }),
    'Question: Who is this for?\nAnswer: Teams\n\nQuestion: What should happen first?\nAnswer: Collect leads')
})
