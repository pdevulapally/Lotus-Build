'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendSessionUsage } from '@/lib/backend/client'

type Snapshot = { usage: BackendSessionUsage | null; usageError: string | null }
const empty: Snapshot = { usage: null, usageError: null }
const message = (error: unknown) => error instanceof Error ? error.message : 'Could not load this session.'

/** Refresh only while open. Late results cannot cross accounts, routes, closing or a newer refresh. */
export function useSettingsSnapshot(open: boolean, uid: string | undefined, sessionId: string | null, refreshAccount: () => Promise<void>) {
  const scope = `${uid ?? ''}:${sessionId ?? ''}`
  const [snapshot, setSnapshot] = useState<Snapshot & { scope?: string }>(empty)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const active = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    active.current?.abort()
    if (!open || !uid) return
    const controller = new AbortController()
    active.current = controller
    setRefreshing(true)
    const [accountResult, usageResult] = await Promise.allSettled([
      refreshAccount(),
      sessionId ? Promise.resolve().then(async () => {
        const value = await currentBackend().sessionUsage(sessionId, controller.signal)
        if (value.sessionId !== sessionId) throw new Error('The server returned usage for a different session.')
        return value
      }) : Promise.resolve(null),
    ])
    if (controller.signal.aborted) return
    setSnapshot({
      scope,
      usage: usageResult.status === 'fulfilled' ? usageResult.value : null,
      usageError: usageResult.status === 'rejected' ? message(usageResult.reason) : null,
    })
    setUpdatedAt(accountResult.status === 'fulfilled' ? new Date() : null)
    setRefreshing(false)
  }, [open, uid, sessionId, scope, refreshAccount])
  useEffect(() => {
    setSnapshot(empty)
    setUpdatedAt(null)
    setRefreshing(false)
    void refresh()
    return () => { active.current?.abort() }
  }, [refresh])
  return { ...(open && snapshot.scope === scope ? snapshot : empty), refreshing, updatedAt, refresh }
}
