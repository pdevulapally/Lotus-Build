import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from '../components/ui/markdown'

test('assistant markdown renders structure and never raw HTML or unsafe links', () => {
  const html = renderToStaticMarkup(<Markdown>{[
    '## Plan',
    '',
    'Build a **client portal** with [docs](https://example.com/guide) and [bad](javascript:alert(1)).',
    '',
    '- First step',
    '- Second step',
    '',
    '<img src=x onerror=alert(1)>',
    '',
    '```ts',
    'const a = 1',
    '```',
  ].join('\n')}</Markdown>)
  assert.match(html, /<h3[^>]*>Plan<\/h3>/)
  assert.match(html, /<strong[^>]*>client portal<\/strong>/)
  assert.match(html, /<a href="https:\/\/example.com\/guide" target="_blank" rel="noopener noreferrer"/)
  assert.doesNotMatch(html, /javascript:/)
  assert.doesNotMatch(html, /onerror|<img/)
  assert.match(html, /<li[^>]*>First step<\/li>/)
  assert.match(html, /<pre[^>]*><code[^>]*language-ts[^>]*>const a = 1/)
  assert.doesNotMatch(html, /\*\*/)
})
