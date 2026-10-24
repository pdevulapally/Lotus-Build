import Link from 'next/link'
import { Stack } from '@astryxdesign/core'
export function RetiredWorkspace() {
  return <Stack as="main" gap={5} className="mx-auto max-w-xl px-6 py-24"><p className="text-sm text-muted-foreground">Workspace upgrade</p><h1 className="text-3xl font-semibold tracking-tight">This link belongs to the previous workspace.</h1><p className="text-sm leading-7 text-muted-foreground">Old projects and computer sessions have not been migrated to the new task API. This page does not connect to the old server or delete any stored data. Keep the original link for a future migration.</p><Link href="/tasks" className="font-medium underline underline-offset-4">Open the new workspace</Link></Stack>
}
