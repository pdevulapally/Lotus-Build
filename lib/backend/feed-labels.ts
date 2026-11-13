/**
 * Copy for the activity feed, kept as data so the hook never grows a chain of
 * per-event branches. Anything absent from these maps is not shown: the feed
 * should read like a calm log of what the agent did for you, not a trace of
 * the machinery (queue slots, sandboxes, internal bookkeeping) behind it.
 */

/** Lifecycle events worth a line of their own. Status is carried by the live status line, not by rows. */
export const lifecycleFeedLabels: Readonly<Record<string, string>> = {
  'session.stopped': 'Stopped',
  'session.failed': 'Stopped',
  'session.awaiting_input': 'Waiting for you',
  'preview.ready': 'Preview is ready',
  'sandbox.started': 'Workspace environment started',
  'desktop.requested': 'Starting the desktop',
  'desktop.ready': 'Desktop is ready',
  'repository.ready': 'Repository is ready',
  'project.saved': 'Saved your work',
  'project.save_failed': "Couldn't save your work",
  'agent.blocked': 'Needs your attention',
  'agent.specialist_started': 'Review started',
  'agent.specialist_completed': 'Review finished',
}

/** Live copy while the server winds a stopped run down; it alone decides when "Stopped" is true. */
export const stoppingLabels = {
  stopping: 'Stopping',
  stillStopping: 'Still stopping — making sure your work is saved',
} as const
/** How long a Stop may take before the live line explains what is still happening. */
export const STILL_STOPPING_AFTER_MS = 5_000

const executionLabels: Readonly<Record<string, string | null>> = {
  'session.queued': 'Starting your request…',
  'session.running': 'Starting your request…',
  'agent.step': 'Processing your request…',
  'agent.text': null, 'agent.tool_call': null,
  'session.idle': null, 'session.stopped': null, 'session.failed': null, 'session.awaiting_input': null,
}

/** Safe live copy from actual execution signals; never render agent.step payloads. */
export function executionLabel(previous: string | null, type: string): string | null {
  return Object.hasOwn(executionLabels, type) ? executionLabels[type] : previous
}

export type ToolStepPhase = 'call' | 'result' | 'failed'

/** `failed` is what the person reads when the tool did not do its job; the tool's own error text is written for the model and never shown. */
type ToolStepCopy = { readonly call: string; readonly result: string; readonly failed?: string; readonly subject?: (input: Readonly<Record<string, unknown>>) => string | undefined }

const text = (input: Readonly<Record<string, unknown>>, key: string, max = 80): string | undefined => {
  const value = input[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : undefined
}

/** Tools the agent uses on your behalf, in the words a person would use. */
const toolStepCopy: Readonly<Record<string, ToolStepCopy>> = {
  list_files: { call: 'Looking through files', result: 'Looked through files' },
  read_file: { call: 'Reading', result: 'Read', failed: 'Could not read', subject: (input) => text(input, 'path', 2000)?.split(/[\\/]/).at(-1) },
  search_files: { call: 'Searching files', result: 'Searched files', subject: (input) => { const query = text(input, 'query', 60); return query === undefined ? undefined : `for “${query}”` } },
  start_preview: { call: 'Starting the preview', result: 'Started the preview', failed: 'The preview could not start' },
  git_status: { call: 'Checking what changed', result: 'Checked what changed' },
  git_diff: { call: 'Reviewing changes', result: 'Reviewed changes', subject: (input) => text(input, 'path') },
  git_log: { call: 'Reading recent commits', result: 'Read recent commits' },
  git_commit: { call: 'Committing', result: 'Committed', subject: (input) => text(input, 'message', 60)?.split('\n')[0] },
  publish_pull_request: { call: 'Publishing the pull request', result: 'Published the pull request', subject: (input) => text(input, 'title', 60) },
  run_validation: { call: 'Running checks', result: 'Ran checks' },
  consult_specialist: { call: 'Asking a reviewer', result: 'Heard back from the reviewer' },
  submit_review: { call: 'Writing up the review', result: 'Wrote up the review' },
  use_skill: { call: 'Applying a skill', result: 'Applied a skill' },
  request_user_input: { call: 'Asking you a question', result: 'Asked you a question', failed: 'The question could not be shown' },
}

/** Internal bookkeeping tools: they have no meaning to the person reading the feed. */
const hiddenTools: ReadonlySet<string> = new Set(['update_task', 'finish_task'])

export function isHiddenToolStep(name: string): boolean {
  return hiddenTools.has(name)
}

/**
 * The feed row title for a tool step, or undefined when the tool has no copy
 * of its own (the caller falls back to a plain description of the step).
 */
export function toolStepLabel(name: string, phase: ToolStepPhase, input: Readonly<Record<string, unknown>> = {}): string | undefined {
  const copy = toolStepCopy[name]
  if (copy === undefined) return undefined
  const subject = copy.subject?.(input)
  const label = phase === 'failed' ? copy.failed ?? `${copy.call} did not finish` : copy[phase]
  return subject === undefined ? label : `${label} ${subject}`
}

/** The person-facing failure line a tool declares, if it has one; such a tool keeps its model-facing result text to itself. */
export function toolFailureLabel(name: string): string | undefined {
  return toolStepCopy[name]?.failed
}

/** A readable fallback for a tool the maps do not know yet: "Using render_chart" → "Using render chart". */
export function genericToolStepLabel(name: string, phase: ToolStepPhase): string {
  const verb = phase === 'call' ? 'Using' : phase === 'failed' ? 'Could not finish' : 'Finished'
  return `${verb} ${name.replace(/_/g, ' ').slice(0, 100)}`
}
