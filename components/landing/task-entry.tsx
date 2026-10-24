"use client"
import Link from 'next/link'
import { Stack } from '@astryxdesign/core'
export function TaskEntry({ suggestedPrompt }: { suggestedPrompt?: string }) {
  return <Stack gap={4} className="rounded-2xl border border-border bg-card p-6"><p id="project-brief" tabIndex={-1} className="text-sm leading-7 text-muted-foreground">{suggestedPrompt ?? 'Start with a goal. Review requested actions and follow your task in one place.'}</p><Link href="/tasks" className="self-start rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Open the new workspace</Link><p className="text-xs text-muted-foreground">Examples below illustrate the product direction. Live previews, file browsing and deployment are not connected in the new workspace.</p></Stack>
}
