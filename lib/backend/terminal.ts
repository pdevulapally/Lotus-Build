import type { SessionEvent } from './client'

const MASK = '••••••'

const PEM_PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
const API_TOKEN = /\b(?:sk-ant-|sk-|sk_live_|sk_test_|rk_live_)[A-Za-z0-9_-]+/g
const GITHUB_TOKEN = /\b(?:ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]+/g
const AWS_ACCESS_KEY = /\bAKIA[0-9A-Z]{16}\b/g
const SLACK_TOKEN = /\bxox[abprs]-[A-Za-z0-9-]+/g
const JWT = /\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]+\b/g
const BEARER_TOKEN = /(\bBearer\s+)[^\s"'`,;)}\]]+/gi
const URL_PASSWORD = /(:\/\/[^/\s:@]+):([^@\s]+)@/g
const ASSIGNMENT_SECRET = /(\b(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|access[_-]?key)\b\s*[=:]\s*)(["']?)([^\s"'`;,)}\]]+)(?:\2)/gi

export function redactSecrets(text: string): string {
  return text
    .replace(PEM_PRIVATE_KEY, MASK)
    .replace(API_TOKEN, MASK)
    .replace(GITHUB_TOKEN, MASK)
    .replace(AWS_ACCESS_KEY, MASK)
    .replace(SLACK_TOKEN, MASK)
    .replace(JWT, MASK)
    .replace(BEARER_TOKEN, `$1${MASK}`)
    .replace(ASSIGNMENT_SECRET, `$1$2${MASK}$2`)
    .replace(URL_PASSWORD, `$1:${MASK}@`)
}

export function getRunCommandInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || !('command' in input)) return null
  const command = (input as { command?: unknown }).command
  return typeof command === 'string' ? command : null
}

export type TerminalEntry = {
  id: string
  callId?: string
  command: string
  status: 'running' | 'done' | 'error' | 'stopped'
  exitCode?: number
  output?: string
  at: string
}

export function commandOutputText(text: string): { exitCode?: number; output: string } {
  const match = text.match(/^exit code:\s*(-?\d+)(?:\r\n|\n|\r|$)/i)
  if (!match) return { output: text }
  const outputStart = match[0].length
  return { exitCode: Number(match[1]), output: text.slice(outputStart) }
}

function eventTime(id: string): string {
  const timestamp = Number(id.split('-')[0])
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString()
}

function lastIndexOf(entries: TerminalEntry[], predicate: (entry: TerminalEntry) => boolean): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (predicate(entries[index])) return index
  }
  return -1
}

export function reduceTerminal(entries: TerminalEntry[], event: SessionEvent): TerminalEntry[] {
  if (event.type === 'agent.tool_call' && event.data.name === 'run_command') {
    if (!event.id) return entries
    const command = getRunCommandInput(event.data.input)
    if (command === null) return entries
    const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
    const entry: TerminalEntry = {
      id: event.id,
      ...(callId ? { callId } : {}),
      command: redactSecrets(command),
      status: 'running',
      at: eventTime(event.id),
    }
    return [...entries, entry].slice(-200)
  }

  if (event.type === 'agent.tool_result' && event.data.name === 'run_command') {
    const callId = typeof event.data.callId === 'string' && event.data.callId ? event.data.callId : undefined
    const index = callId
      ? lastIndexOf(entries, (entry) => entry.callId === callId)
      : lastIndexOf(entries, (entry) => entry.status === 'running')
    if (index < 0) return entries

    const rawText = typeof event.data.text === 'string' ? event.data.text : ''
    const parsed = commandOutputText(redactSecrets(rawText))
    const nextEntry: TerminalEntry = {
      ...entries[index],
      status: event.data.isError === true ? 'error' : 'done',
      ...(parsed.exitCode === undefined ? {} : { exitCode: parsed.exitCode }),
      output: parsed.output,
    }
    const next = entries.slice()
    next[index] = nextEntry
    return next
  }

  if (event.type === 'session.idle' || event.type === 'session.failed') {
    let changed = false
    const next = entries.map((entry) => {
      if (entry.status !== 'running') return entry
      changed = true
      return { ...entry, status: 'stopped' as const }
    })
    return changed ? next : entries
  }

  return entries
}
