import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionEvent } from '../lib/backend/client'
import {
  commandOutputText,
  redactSecrets,
  reduceTerminal,
  type TerminalEntry,
} from '../lib/backend/terminal'
import { decideWorkspaceAutoOpen as decideWorkspaceOpen } from '../lib/workspace-auto-open'

const event = (type: string, data: Record<string, unknown>, id = '1700000000000-1'): SessionEvent => ({ id, type, data })

test('redacts private keys, provider tokens, JWTs and bearer credentials', () => {
  const cases = [
    ['-----BEGIN RSA PRIVATE KEY-----\nprivate material\n-----END RSA PRIVATE KEY-----', '••••••'],
    ['sk-ant-api1234567890', '••••••'],
    ['sk-plain1234567890', '••••••'],
    ['sk_live_1234567890', '••••••'],
    ['sk_test_1234567890', '••••••'],
    ['rk_live_1234567890', '••••••'],
    ['ghp_1234567890', '••••••'],
    ['gho_1234567890', '••••••'],
    ['ghs_1234567890', '••••••'],
    ['github_pat_1234567890', '••••••'],
    ['AKIA1234567890ABCDEF', '••••••'],
    ['xoxb-123456-abcdef', '••••••'],
    ['eyJhbGciOiJub25l.eyJzdWIiOiIxMjMifQ.signature', '••••••'],
    ['Authorization: Bearer abc.def.ghi', 'Authorization: Bearer ••••••'],
    ['https://user:password@example.com', 'https://user:••••••@example.com'],
  ] as const

  for (const [input, expected] of cases) assert.equal(redactSecrets(input), expected)
})

test('redacts named assignments while preserving the key and separator', () => {
  assert.equal(redactSecrets('api_key="top-secret" secret: plain-secret private-key = \'pem-value\''), 'api_key="••••••" secret: •••••• private-key = \'••••••\'')
})

test('leaves ordinary command text and exit-code lines untouched', () => {
  const text = 'npm install react\nexit code: 0\nstdout:\nready'
  assert.equal(redactSecrets(text), text)
})

test('parses and removes the leading command exit-code line', () => {
  assert.deepEqual(commandOutputText('exit code: 0\nstdout:\nready'), { exitCode: 0, output: 'stdout:\nready' })
  assert.deepEqual(commandOutputText('plain output'), { output: 'plain output' })
})

test('reduces a run_command call and result by call id', () => {
  const call = event('agent.tool_call', { name: 'run_command', callId: 'call-1', input: { command: 'echo token=secret' } })
  const running = reduceTerminal([], call)
  assert.equal(running.length, 1)
  assert.deepEqual(running[0], {
    id: call.id,
    callId: 'call-1',
    command: 'echo token=••••••',
    status: 'running',
    at: '2023-11-14T22:13:20.000Z',
  })

  const result = event('agent.tool_result', {
    name: 'run_command',
    callId: 'call-1',
    isError: false,
    text: 'exit code: 0\nstdout:\nhello token=secret',
  }, '1700000001000-1')
  assert.deepEqual(reduceTerminal(running, result)[0], {
    ...running[0],
    status: 'done',
    exitCode: 0,
    output: 'stdout:\nhello token=••••••',
  })
})

test('marks command errors and matches a result to the last running entry without a call id', () => {
  const first = reduceTerminal([], event('agent.tool_call', { name: 'run_command', callId: 'call-1', input: { command: 'first' } }))
  const entries = reduceTerminal(first, event('agent.tool_call', { name: 'run_command', input: { command: 'second' } }, '1700000002000-1'))
  const result = event('agent.tool_result', { name: 'run_command', isError: true, text: 'exit code: 1\nstderr:\nfailed' }, '1700000003000-1')
  const next = reduceTerminal(entries, result)
  assert.equal(next[0]?.status, 'running')
  assert.equal(next[1]?.status, 'error')
  assert.equal(next[1]?.exitCode, 1)
  assert.equal(next[1]?.output, 'stderr:\nfailed')
})

test('ignores unmatched results and non-run commands without changing the array', () => {
  const entries = reduceTerminal([], event('agent.tool_call', { name: 'run_command', callId: 'call-1', input: { command: 'echo ok' } }))
  const unmatched = reduceTerminal(entries, event('agent.tool_result', { name: 'run_command', callId: 'missing', isError: false, text: 'exit code: 0\n' }))
  assert.equal(unmatched, entries)
  const other = reduceTerminal(entries, event('agent.tool_call', { name: 'search', input: { command: 'ignored' } }))
  assert.equal(other, entries)
})

test('marks running commands stopped when the session ends', () => {
  const entries = reduceTerminal([], event('agent.tool_call', { name: 'run_command', input: { command: 'sleep 1' } }))
  const stopped = reduceTerminal(entries, event('session.idle', {}))
  assert.equal(stopped[0]?.status, 'stopped')
  assert.notEqual(stopped, entries)
  assert.equal(reduceTerminal(stopped, event('session.failed', {})), stopped)
})

test('caps terminal history at the last 200 commands', () => {
  let entries: TerminalEntry[] = []
  for (let index = 0; index < 205; index += 1) {
    entries = reduceTerminal(entries, event('agent.tool_call', {
      name: 'run_command',
      input: { command: `echo ${index}` },
    }, `${1700000000000 + index}-1`))
  }
  assert.equal(entries.length, 200)
  assert.equal(entries[0]?.command, 'echo 5')
  assert.equal(entries.at(-1)?.command, 'echo 204')
})

test('opens the terminal on a new desktop run without a preview', () => {
  assert.deepEqual(decideWorkspaceOpen({
    isDesktop: true,
    isRunning: true,
    wasRunning: false,
    previewUrl: null,
    previousPreviewUrl: null,
    workspacePanel: 'closed',
    activeTab: 'preview',
    userClosed: false,
  }), { resetUserClosed: true, workspacePanel: 'split', activeTab: 'terminal' })
})

test('opens preview when it becomes available without overriding another view', () => {
  const preview = decideWorkspaceOpen({
    isDesktop: true,
    isRunning: false,
    wasRunning: false,
    previewUrl: 'https://preview.example',
    previousPreviewUrl: null,
    workspacePanel: 'closed',
    activeTab: 'terminal',
    userClosed: false,
  })
  assert.deepEqual(preview, { resetUserClosed: false, workspacePanel: 'split', activeTab: 'preview' })

  const files = decideWorkspaceOpen({
    isDesktop: true,
    isRunning: false,
    wasRunning: false,
    previewUrl: 'https://preview.example',
    previousPreviewUrl: null,
    workspacePanel: 'closed',
    activeTab: 'code',
    userClosed: false,
  })
  assert.deepEqual(files, { resetUserClosed: false, workspacePanel: 'split' })
})

test('respects a user-closed panel, expanded mode, and mobile layout', () => {
  const closed = decideWorkspaceOpen({
    isDesktop: true,
    isRunning: false,
    wasRunning: false,
    previewUrl: 'https://preview.example',
    previousPreviewUrl: null,
    workspacePanel: 'closed',
    activeTab: 'preview',
    userClosed: true,
  })
  assert.deepEqual(closed, { resetUserClosed: false })

  const expanded = decideWorkspaceOpen({
    isDesktop: true,
    isRunning: false,
    wasRunning: false,
    previewUrl: 'https://preview.example',
    previousPreviewUrl: null,
    workspacePanel: 'expanded',
    activeTab: 'preview',
    userClosed: false,
  })
  assert.deepEqual(expanded, { resetUserClosed: false, activeTab: 'preview' })

  const mobile = decideWorkspaceOpen({
    isDesktop: false,
    isRunning: true,
    wasRunning: false,
    previewUrl: null,
    previousPreviewUrl: null,
    workspacePanel: 'closed',
    activeTab: 'preview',
    userClosed: false,
  })
  assert.deepEqual(mobile, { resetUserClosed: false })
})
