import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { agentFeedModule as module, renderAgentFeed as render } from './support/render-agent-feed'
import { activity, updateToolStepEvent } from '../hooks/use-backend-session'
import { selectTaskNotice } from '../lib/backend/task-notice'
import { SearchTool } from '../components/project/search-tool'

test('initial startup uses natural copy and confirmed processing supersedes the older queued snapshot', () => {
  assert.match(render({ status: 'queued' }), /Starting your request/)
  const html = render({ status: 'queued', liveLabel: 'Processing your request…' })
  assert.match(html, /Processing your request/); assert.doesNotMatch(html, /Queued|Starting your request/)
})

test('the canonical feed displays streamed text immediately and does not duplicate the working indicator', () => {
  const html = render({ streamText: 'Actual model response', liveLabel: 'Processing your request…' })
  assert.match(html, /Actual model response/); assert.doesNotMatch(html, /Working|Processing your request/)
})

test('failed or interrupted file edits never claim to be edited or show a successful diff', () => {
  for (const status of ['error', 'skipped'] as const) {
    const html = render({ status: 'error', events: [{ id: '1-0', title: 'Editing file', kind: 'code', status, index: 0, createdAt: '2026-11-06T10:00:00Z',
      metadata: { filePath: 'app.ts', editVariant: 'edit', oldContent: 'old', newContent: 'new' } }] })
    assert.match(html, status === 'error' ? /Couldn&#x27;t edit/ : /Interrupted:/)
    assert.doesNotMatch(html, />Edited|>Created|\+1/)
  }
})

test('a running tool replaces the generic status and an interrupted command stays interrupted', () => {
  const row = { id: '1-0', title: 'Running command', kind: 'code' as const, status: 'running' as const, index: 0, createdAt: '2026-11-06T10:00:00Z', metadata: { command: 'npm test' } }
  assert.doesNotMatch(render({ events: [row] }), /Working/)
  const html = render({ status: 'error', events: [{ ...row, status: 'skipped' }] })
  assert.match(html, /Command interrupted/); assert.doesNotMatch(html, /Ran command/)
})

test('web search renders a dedicated live shimmer and then linked cited results', () => {
  const call = activity({ id: '1700000000000-1', type: 'agent.tool_call', data: {
    name: 'search_web', callId: 'search', input: { query: 'Tailwind v4 CLI official docs' },
  } }, 0)!
  const live = render({ events: [call] })
  assert.match(live, /Searching the web/)
  assert.match(live, /<svg/)
  const [done] = updateToolStepEvent([call], { id: '1700000000001-1', type: 'agent.tool_result', data: {
    name: 'search_web',
    callId: 'search',
    text: JSON.stringify({ query: 'Tailwind v4 CLI official docs', sources: [
      { title: 'Tailwind upgrade guide', url: 'https://tailwindcss.com/docs/upgrade-guide', date: '2026-10-01' },
    ] }),
  } })
  const completed = render({ events: [done] })
  assert.match(completed, /Found 1 result/)
  const expanded = renderToStaticMarkup(createElement(SearchTool, {
    state: 'done',
    query: 'Tailwind v4 CLI official docs',
    results: [{ title: 'Tailwind upgrade guide', source: 'https://tailwindcss.com/docs/upgrade-guide' }],
    defaultOpen: true,
  }))
  assert.match(expanded, /href="https:\/\/tailwindcss.com\/docs\/upgrade-guide"/)
  assert.match(expanded, /rel="noreferrer"/)
})

test('streamed markdown splits only at stable boundaries, preserving the full document', () => {
  const { splitStableBlocks } = module
  const whole = 'para one\n\npara two\n\n```ts\nconst x = 1\n\nconst y = 2\n```\n\nlast'
  const { done, tail } = splitStableBlocks(whole)
  assert.deepEqual(done, ['para one', 'para two', '```ts\nconst x = 1\n\nconst y = 2\n```'])
  assert.equal(tail, 'last')
  assert.equal(done.join('\n\n') + '\n\n' + tail, whole)
  // An open fence keeps everything after it in the live tail.
  const open = splitStableBlocks('intro\n\n```ts\npartial code\n\nstill code')
  assert.deepEqual(open.done, ['intro'])
  assert.equal(open.tail, '```ts\npartial code\n\nstill code')
  // A growing stream only ever moves text from the tail into done blocks.
  const early = splitStableBlocks('one\n\ntwo\n\nthr')
  const later = splitStableBlocks('one\n\ntwo\n\nthree\n\nfour')
  assert.deepEqual(early.done, later.done.slice(0, early.done.length), 'done blocks are prefix-stable')
})

test('constructs that span blank lines are never split: loose lists, blockquotes, continuations', () => {
  const { splitStableBlocks } = module
  // A loose list must stay one <ul> — splitting would make two tight lists.
  const list = splitStableBlocks('- one\n\n- two\n\npara')
  assert.deepEqual(list.done, ['- one\n\n- two']); assert.equal(list.tail, 'para')
  // A nested list continuation defers the boundary the same way.
  const nested = splitStableBlocks('- one\n\n  - nested\n\npara')
  assert.deepEqual(nested.done, ['- one\n\n  - nested']); assert.equal(nested.tail, 'para')
  // One blockquote across blank lines stays one blockquote.
  const quote = splitStableBlocks('> first\n\n> second\n\nplain')
  assert.deepEqual(quote.done, ['> first\n\n> second']); assert.equal(quote.tail, 'plain')
  // An indented continuation is not a boundary.
  const indent = splitStableBlocks('- item\n\n    continued\n\nnext')
  assert.deepEqual(indent.done, ['- item\n\n    continued']); assert.equal(indent.tail, 'next')
  // Reference definitions are collected for document-wide resolution.
  const refs = splitStableBlocks('see [the docs][d]\n\n[d]: https://example.com\n\nend')
  assert.deepEqual(refs.refs, ['[d]: https://example.com'])
})

test('split rendering matches unsplit react-markdown output for document-scoped constructs', () => {
  const { splitStableBlocks } = module
  // react-markdown echoes source newlines between top-level blocks; that
  // whitespace is insignificant between block elements, so normalise it.
  const render = (text: string) => renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, text)).replace(/>\n+</g, '><')
  const cases: Record<string, string> = {
    'reference link': 'See [the docs][d] and [site].\n\n[d]: https://example.com\n[site]: https://example.org',
    'loose list': '- first\n\n- second\n\n- third',
    'nested list': '- outer\n\n  - inner\n\n  - inner two',
    'blockquote spanning blanks': '> quoted one\n\n> quoted two',
    'fenced code with blanks': 'before\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\nafter',
    'gfm table + task list': '| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] open',
    'thematic break': 'part one\n\n---\n\npart two',
    'setext heading': 'Title\n===\n\nbody',
    'incomplete fence': 'text\n\n```ts\nconst partial = ',
    'indented continuation': '- item\n\n    still the item\n\nafter',
  }
  for (const [name, text] of Object.entries(cases)) {
    const { done, tail, refs } = splitStableBlocks(text)
    const suffix = refs.length === 0 ? '' : '\n\n' + refs.join('\n')
    const split = done.map((block) => render(block + suffix)).join('') + render(tail + suffix)
    const whole = render(text)
    assert.equal(split, whole, name)
  }
})

test('streamed responses render through the memoized block splitter preserving the full document', () => {
  const text = 'Intro **bold**\n\n```ts\nconst x = 1\n```\n\nDone'
  // The stub renders each Markdown block as a <p>: three stable blocks in order.
  const html = render({ streamText: text })
  assert.match(html, /<p>Intro \*\*bold\*\*<\/p>/)
  assert.match(html, /<p>```ts\nconst x = 1\n```<\/p>/)
  assert.match(html, /<p>Done<\/p>/)
})

test('a stop the server has accepted reads as Stopping, never as Stopped, and keeps streamed text in view', () => {
  const html = render({ stopping: true, streamText: 'Half an answer', events: [{ id: '1-0', title: 'Running command', kind: 'code', status: 'running', index: 0, createdAt: '2026-11-06T10:00:00Z', metadata: { command: 'npm test' } }] })
  assert.match(html, /Stopping/); assert.doesNotMatch(html, /Stopped|Working|Interrupted/)
  assert.match(html, /Half an answer/)
})

test('a confirmed stop is calm: the progress label says Stopped and nothing is styled as an error', () => {
  const html = render({ status: 'stopped', progress: { state: 'idle', label: 'Stopped', description: 'Stopped before finishing. Send a message to continue.', active: false },
    events: [{ id: '2-0', title: 'Stopped', kind: 'planning', status: 'complete', index: 1, createdAt: '2026-11-06T10:00:01Z' }] })
  assert.match(html, /Stopped/); assert.doesNotMatch(html, /Stopping|Something went wrong|text-destructive/)
})

test('a thinking row hands the feed\'s live state to the thought block: streaming only while this step still thinks', () => {
  const thinking = { id: '1-0', title: 'Thinking', kind: 'thinking' as const, status: 'running' as const, index: 0, createdAt: '2026-11-06T10:00:00Z', description: 'The failing assertion points at the reducer.' }
  const live = render({ events: [thinking] })
  assert.match(live, /data-thinking="streaming" data-started="2026-11-06T10:00:00Z"/); assert.match(live, /failing assertion/)
  const closed = render({ events: [{ ...thinking, status: 'complete' as const, completedAt: '2026-11-06T10:00:04Z' }] })
  assert.match(closed, /data-thinking="done"[^>]*data-completed="2026-11-06T10:00:04Z"/, 'a step that moved on is no longer thinking even while the session runs')
  const stopped = render({ status: 'complete', events: [thinking] })
  assert.match(stopped, /data-thinking="done"/, 'a session that is not running has no live thought')
})

test('the current stop appears once in the shared notice without exposing tool diagnostics', () => {
  const error = 'The Free plan allows 300000 tokens of Input tokens, and 297048 tokens of that is already used or held.'
  const call = activity({ id: '1700000000000-1', type: 'agent.tool_call', data: { name: 'read_file', callId: 'read', input: { path: '/home/daytona/project/src/App.tsx' } } }, 0)!
  const tool = updateToolStepEvent([call], { id: '1700000000001-1', type: 'agent.tool_result', data: { name: 'read_file', callId: 'read', isError: true, error: 'Confined ranged read failed: Traceback (most recent call last):' } })
  const terminal = activity({ id: '1700000000002-1', type: 'session.failed', data: { execution: 2, error } }, 1)!
  const taskNotice = selectTaskNotice({ session: { id: 's', projectId: 'p', model: 'model', mode: 'build', effort: 'standard', status: 'FAILED', execution: 2, messageCount: 1, createdAt: '2026-11-11T00:00:00Z', error,
    fallback: { status: 'UNAVAILABLE', limitLabel: 'Input tokens', reason: 'A durable workspace checkpoint is unavailable.', resumable: false, consent: false } } })
  const html = render({ status: 'error', events: [...tool, terminal], taskNotice })
  assert.doesNotMatch(html, /The Free plan allows|>Stopped<|durable workspace checkpoint/)
  assert.match(html, /Could not read/)
  assert.match(html, /App.tsx/)
  assert.match(html, /<details[^>]*>/)
  assert.doesNotMatch(html, /<details[^>]*\sopen/)
  assert.doesNotMatch(html, /Confined ranged read failed: Traceback/)
  const visible = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '')
  assert.doesNotMatch(visible, /Traceback|Confined ranged|Reading did not finish/)
  // A different execution's history remains available; a current banner must not erase it.
  const old = { ...terminal, id: '1699999999999-1', metadata: { ...terminal.metadata, execution: 1 }, description: 'An earlier failure.' }
  const history = render({ status: 'error', events: [old, ...tool, terminal], taskNotice })
  assert.match(history, /This request couldn\u2019t finish/)
  assert.doesNotMatch(history, /An earlier failure|text-destructive/)
})
