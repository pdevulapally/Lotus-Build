'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AllowanceLimitIcon, QueuedIcon } from '@/components/ui/lotus-icons'
import type { TaskNoticeAction, TaskNoticeModel } from '@/lib/backend/task-notice'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

const icons = { quota: AllowanceLimitIcon, waiting: QueuedIcon, error: Info }
const pill = 'inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-progress disabled:opacity-60'

export function TaskNotice({ notice, busy, onContinue, onCancel, onReconnect, onBuyCredits }: {
  notice: TaskNoticeModel | null
  busy: boolean
  onContinue: (lane: 'premium' | 'fallback') => void
  onCancel: () => void
  onReconnect?: () => void
  onBuyCredits?: () => void
}) {
  const reducedMotion = useReducedMotion()
  if (!notice) return null
  const Icon = icons[notice.kind]
  const actions: Record<TaskNoticeAction, ReactNode> = {
    credits: <button type="button" className={cn(pill, 'bg-primary text-primary-foreground hover:bg-primary/90')} disabled={busy || !onBuyCredits} onClick={onBuyCredits}>Add credits</button>,
    upgrade: <Link href="/pricing" className={pill}>Upgrade</Link>,
    free: <button type="button" className={pill} disabled={busy} onClick={() => onContinue('fallback')}>Switch model</button>,
    premium: <button type="button" className={pill} disabled={busy} onClick={() => onContinue('premium')}>{notice.creditTask ? 'Continue task' : `Retry with ${notice.retryModel}`}</button>,
    cancel: <button type="button" className={pill} disabled={busy} onClick={onCancel}>Cancel task</button>,
    reconnect: <button type="button" className={pill} disabled={busy || !onReconnect} onClick={onReconnect}>Reconnect</button>,
    refresh: <button type="button" className={pill} disabled={busy || !onReconnect} onClick={onReconnect}>Refresh</button>,
    projects: <Link href="/" className={pill}>Manage projects</Link>,
  }
  const [primary, ...secondary] = notice.actions
  return <motion.section data-slot="continuation-notice" aria-label="Task notice" role={notice.kind === 'error' ? 'alert' : 'status'}
    initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
    className="w-full rounded-xl bg-muted/50 px-4 py-3 text-foreground">
    <header className="flex flex-wrap items-center gap-2.5">
      <span className="shrink-0" aria-hidden="true"><Icon className="size-4 text-muted-foreground" /></span>
      <h2 className="min-w-0 flex-1 text-sm font-semibold leading-snug">{notice.title}</h2>
      {primary && <span className="shrink-0">{actions[primary]}</span>}
    </header>
    {notice.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notice.description}</p>}
    {secondary.length > 0 && <section className="mt-2 flex flex-wrap gap-2" aria-label="Task actions">{secondary.map(action => <span key={action}>{actions[action]}</span>)}</section>}
  </motion.section>
}
