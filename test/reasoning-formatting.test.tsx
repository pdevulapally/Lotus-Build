import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Reasoning, ReasoningContent } from '../components/ai-elements/reasoning'

const render = (text: string) => renderToStaticMarkup(createElement(Reasoning, {
  defaultOpen: true, isStreaming: false, children: createElement(ReasoningContent, { children: text }),
}))

test('thought-process text retains semantic paragraphs, headings, emphasis, lists and inline code', () => {
  const html = render('### Checking the app\n\nI am checking **layout** in `src/App.tsx`.\n\n- Read the component\n- Review the styles\n\nThen verify the result.')
  assert.match(html, /<h4[^>]*>Checking the app<\/h4>/)
  assert.match(html, /<strong[^>]*>layout<\/strong>/)
  assert.match(html, /<code[^>]*>src\/App.tsx<\/code>/)
  assert.match(html, /<ul[^>]*>/)
  assert.match(html, /<li[^>]*>Read the component<\/li>/)
  assert.match(html, /<p[^>]*>Then verify the result\.<\/p>/)
})

test('complete thought-process code fences retain indentation and escaped code', () => {
  const html = render('The example:\n\n```tsx\n  const element = <button>Save</button>\n```')
  assert.match(html, /<pre[^>]*>/)
  assert.match(html, />tsx<\/span>/)
  assert.match(html, /  const element = &lt;button&gt;Save&lt;\/button&gt;/)
  assert.doesNotMatch(html, /<button>Save/)
})

test('an incomplete streamed code fence remains literal until it closes', () => {
  const html = render('Checking:\n\n```tsx\n  const element = <button>Save')
  assert.match(html, /```tsx/)
  assert.match(html, /&lt;button&gt;Save/)
  assert.doesNotMatch(html, /<pre|<code/)
})

test('formatted thoughts never execute HTML or unsafe links', () => {
  const html = render('Review [this link](javascript:alert).\n\n<script>danger()</script>')
  assert.doesNotMatch(html, /href="javascript:|<script>/)
})
