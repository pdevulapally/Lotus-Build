import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { PlanCard } from '../components/computer/plan-card'
import type { SessionPlan } from '../lib/backend/session-plan'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/plan-card.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { PlanCard: typeof PlanCard } }
const isolatedRequire = (id: string) => {
  if (id === '@/components/ui/markdown') return { Markdown: ({ children }: { children: React.ReactNode }) => createElement('p', null, children) }
  return require(id.startsWith('@/') ? `../${id.slice(2)}` : id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
const render = (props: ComponentProps<typeof PlanCard>) => renderToStaticMarkup(createElement(module.exports.PlanCard, props))

const plan: SessionPlan = {
  protocol: 1, revision: 2, title: 'Todo app', summary: 'A small list.',
  steps: [
    { id: 's1', title: 'Scaffold the app', status: 'done', evidence: ['tool-1'] },
    { id: 's2', title: 'List view', status: 'in_progress' },
    { id: 's3', title: 'Tests', status: 'proposed' },
    { id: 's4', title: 'Deploy', status: 'blocked', note: 'Interrupted: the run ended before this step finished.' },
  ],
  questions: [{ id: 'q1', text: 'Persist between reloads?' }], checks: ['npm test'], decisions: [], risks: [], source: 'agent',
}
const actions = (overrides: Partial<NonNullable<ComponentProps<typeof PlanCard>['actions']>> = {}): NonNullable<ComponentProps<typeof PlanCard>['actions']> => ({
  approvalRequired: true, canApprove: true, canEdit: true, busy: false, onApprove: () => {}, onEdit: () => {}, ...overrides,
})

test('the card shows every step with its real status and what still needs the user', () => {
  const html = render({ plan, actions: actions() })
  assert.match(html, /Todo app/); assert.match(html, /1 of 4 done/)
  assert.match(html, /Before I build/)
  assert.match(html, /title="Done"/); assert.match(html, /title="In progress"/); assert.match(html, /title="Not started"/); assert.match(html, /title="Blocked"/)
  assert.match(html, /Interrupted: the run ended before this step finished\./)
  assert.match(html, /What still needs your input/); assert.match(html, /Persist between reloads\?/)
  assert.match(html, /Approve and build/); assert.match(html, /or answer the questions first/)
  assert.match(html, /data-plan-revision="2"/)
})

test('approval and edits are offered only when the page says they may be', () => {
  const readOnly = render({ plan, actions: actions({ canApprove: false, canEdit: false }) })
  assert.doesNotMatch(readOnly, /Approve and build|>Skip<|>Answer</)
  assert.match(readOnly, />Plan</)
  const noActions = render({ plan })
  assert.doesNotMatch(noActions, /Approve|Skip|Answer</)
  const editable = render({ plan, actions: actions({ canApprove: false }) })
  assert.match(editable, />Skip</); assert.match(editable, />Answer</)
  // Only steps not yet started can be skipped; done, running and blocked steps are the agent's to report.
  assert.equal((editable.match(/>Skip</g) ?? []).length, 1)
  const busy = render({ plan, actions: actions({ busy: true }) })
  assert.match(busy, /One moment…/); assert.match(busy, /disabled=""/)
})

test('an approved plan reads as approved, and one changed since approval says so and asks again', () => {
  const approved = render({ plan: { ...plan, approvedRevision: 2 }, actions: actions({ canApprove: false }) })
  assert.match(approved, /Approved plan/); assert.doesNotMatch(approved, /Approve and build/)
  const changed = render({ plan: { ...plan, revision: 3, approvedRevision: 2 }, actions: actions() })
  assert.match(changed, /Plan changed since you approved it/); assert.match(changed, /Approve the changes and build/)
  const answered = render({ plan: { ...plan, questions: [{ id: 'q1', text: 'Persist?', answer: 'Yes' }] }, actions: actions() })
  assert.match(answered, /Your answers/); assert.match(answered, /You: Yes/); assert.match(answered, /or type to revise/)
})

test('an Auto plan is informational and never becomes an approval gate', () => {
  const html = render({ plan, actions: actions({ approvalRequired: false, canApprove: false }) })
  assert.match(html, /Working plan/)
  assert.doesNotMatch(html, /Approve and build|Approve the changes/)
  assert.match(html, />Skip</)
})

test('model-authored text is rendered as text, never as markup', () => {
  const hostile = render({ plan: { ...plan, title: '<img src=x onerror=alert(1)>', steps: [{ id: 's1', title: '<script>alert(1)</script>', status: 'proposed', note: '<b>bold</b>' }], questions: [{ id: 'q1', text: '<svg onload=alert(1)>' }] } })
  assert.doesNotMatch(hostile, /<img|<script>|<svg onload|<b>bold/)
  assert.match(hostile, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})
