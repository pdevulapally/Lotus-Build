import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import test from 'node:test'
import ts from 'typescript'
import type { ToastOptions } from '@astryxdesign/core/Toast'
import ComputerLayout from '../app/computer/layout'
import type { TaskNoticeProps } from '../components/computer/task-notice'
import { selectTaskNotice } from '../lib/backend/task-notice'
import { BackendError, type BackendSession } from '../lib/backend/client'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/computer/task-feedback.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function notificationFixture() {
  const effects: (() => (() => void) | void)[] = []
  const notifications: ToastOptions[] = []
  let dismissals = 0
  const module = { exports: {} as { TaskFeedback: ComponentType<TaskNoticeProps>; TaskErrorNotification: (props: TaskNoticeProps) => null } }
  const isolatedRequire = (id: string) => {
    if (id === 'react') return { useRef: (current: unknown) => ({ current }), useEffect: (effect: typeof effects[number]) => effects.push(effect) }
    if (id === '@astryxdesign/core/Toast') return { useToast: () => (options: ToastOptions) => { notifications.push(options); return () => { dismissals++ } } }
    return require(id === './task-notice' ? '../components/computer/task-notice' : id)
  }
  new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)
  return { ...module.exports, effects, notifications, dismissals: () => dismissals }
}

const session: BackendSession = { id: 's', projectId: 'p', model: 'claude-opus-5', effort: 'high', mode: 'build',
  status: 'IDLE', messageCount: 1, createdAt: '2026-11-16T00:00:00Z', fallback: {
    status: 'AWAITING_CREDITS', reason: 'Paused', resumable: true, consent: false, lane: 'premium', checkpointId: 'saved',
  } }

test('errors use a persistent Astryx notification with manual controls, not an inline chat notice', () => {
  const fixture = notificationFixture()
  let resumed = 0
  const notice = selectTaskNotice({ session, continuationError: new BackendError(409, 'fallback/checkpoint-stale', 'Raw server diagnostic') })
  const props: TaskNoticeProps = { notice, busy: false, onContinue: lane => { assert.equal(lane, 'premium'); resumed++ }, onCancel: () => {} }
  const html = renderToStaticMarkup(createElement(fixture.TaskFeedback, props))
  assert.equal(html, '')
  assert.equal(fixture.notifications.length, 0, 'Rendering never starts task actions or emits during SSR')
  const dismiss = fixture.effects[0]()
  assert.equal(fixture.notifications.length, 1)
  const toast = fixture.notifications[0]
  assert.equal(toast.type, 'error')
  assert.equal(toast.isAutoHide, false)
  assert.equal(toast.uniqueID, 'computer-task-error')
  assert.match(String(toast.body), /Refresh this page/)
  assert.doesNotMatch(String(toast.body), /Raw server diagnostic/)
  assert.match(renderToStaticMarkup(toast.endContent), /Continue task/)
  assert.equal(resumed, 0, 'Showing a notification never resumes work')
  dismiss?.()
  assert.equal(fixture.dismissals(), 1)
  assert.equal(resumed, 0, 'Dismissing a notification never changes the task')
})

test('paused usage keeps its existing manual controls; notifications are positioned at the bottom', () => {
  const fixture = notificationFixture()
  const html = renderToStaticMarkup(createElement(fixture.TaskFeedback, {
    notice: selectTaskNotice({ session }), busy: false, onContinue: () => assert.fail('No automatic continuation'), onCancel: () => {},
  }))
  assert.match(html, /Continue task/)
  assert.match(html, /data-slot="continuation-notice"/)
  assert.equal(fixture.effects.length, 0)
  const viewport = ComputerLayout({ children: 'workspace' })
  assert.equal(viewport.props.position, 'bottomEnd')
  assert.equal(viewport.props.maxVisible, 3)
  assert.equal(viewport.props.children, 'workspace')
})
