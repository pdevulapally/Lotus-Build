'use client'

import { ChevronRight, CircleAlert, CirclePause, FileCode2, LoaderCircle } from 'lucide-react'
import type { ComputerTimelineEvent } from './session-types'
import { redactSecrets } from '@/lib/backend/terminal'

const phases = {
  pending: { label: 'Waiting to read', Icon: FileCode2 },
  running: { label: 'Reading', Icon: LoaderCircle },
  complete: { label: 'Read', Icon: FileCode2 },
  error: { label: 'Could not read', Icon: CircleAlert },
  skipped: { label: 'Read interrupted', Icon: CirclePause },
} as const

export function FileReadActivity({ path, status, diagnostic }: { path?: string; status: ComputerTimelineEvent['status']; diagnostic?: string }) {
  const { label, Icon } = phases[status]
  const fileName = path?.split(/[\\/]/).at(-1)
  return <details className="group my-1 text-sm text-muted-foreground">
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-lg px-2 py-2 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
      <Icon className={`size-4 shrink-0 ${status === 'running' ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-6"><span>{label}</span>{fileName && <span className="ml-2 break-words font-medium text-foreground">{fileName}</span>}</span>
      <ChevronRight className="ml-auto size-3.5 shrink-0 motion-safe:transition-transform group-open:rotate-90" aria-hidden="true" />
    </summary>
    <section className="space-y-3 pb-3 pl-8 pr-2 pt-1" aria-label="File read details">
      {path && <p className="break-words font-mono text-xs leading-6 [overflow-wrap:anywhere]">{path}</p>}
      {diagnostic && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-mono text-xs leading-6">{redactSecrets(diagnostic)}</pre>}
    </section>
  </details>
}
