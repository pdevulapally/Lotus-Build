'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BackendSession } from '@/lib/backend/client'
import { currentBackend } from '@/lib/backend/browser'
import type { TaskNoticeUsage } from '@/lib/backend/task-notice'
import { usageResetAt } from '@/lib/settings/usage'

/** Refresh reads only. Neither a focus nor an allowance reset resumes saved work. */
export function useTaskNoticeUsage(session: BackendSession | null, uid?: string) {
  const paused = session?.status === 'IDLE' && session.fallback?.resumable === true
  const scope = paused && uid ? `${uid}:${session.id}:${session.fallback?.checkpointId}` : null
  const savedReset = paused ? session.fallback?.resetAt : undefined
  const [result, setResult] = useState<{ scope: string; state: TaskNoticeUsage } | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!scope) return
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      if (timer) clearTimeout(timer)
      if (savedReset && Date.parse(savedReset) > Date.now()) {
        timer = setTimeout(() => { void load() }, Math.min(Date.parse(savedReset) - Date.now(), 2_147_483_647))
      }
      setResult({ scope, state: { status: 'loading' } })
      try {
        const usage = await currentBackend().usage(signal)
        if (signal.aborted) return
        setResult({ scope, state: { status: 'ready', usage } })
        const deadlines = usage.meters.map(usageResetAt).flatMap(date => date && date.getTime() > Date.now() ? [date.getTime()] : [])
        if (savedReset && Date.parse(savedReset) > Date.now()) deadlines.push(Date.parse(savedReset))
        if (timer) clearTimeout(timer)
        if (deadlines.length) timer = setTimeout(() => { void load() }, Math.max(1, Math.min(Math.min(...deadlines) - Date.now(), 2_147_483_647)))
      } catch {
        if (!signal.aborted) setResult({ scope, state: { status: 'unavailable' } })
      }
    }
    const onFocus = () => { void load() }
    void load()
    window.addEventListener('focus', onFocus)
    return () => { controller?.abort(); if (timer) clearTimeout(timer); window.removeEventListener('focus', onFocus) }
  }, [scope, savedReset, revision])

  return { currentUsage: scope ? result?.scope === scope ? result.state : { status: 'loading' as const } : undefined, refresh }
}
