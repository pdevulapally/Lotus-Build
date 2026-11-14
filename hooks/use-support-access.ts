'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import { BackendError, type BackendSupportAccess } from '@/lib/backend/client'

export interface SupportAccessController {
  readonly data: BackendSupportAccess | null
  /** The code just generated, shown once; it is never returned by the server again. */
  readonly code: { readonly code: string; readonly expiresAt: string } | null
  readonly loading: boolean
  readonly busy: boolean
  readonly error: string | null
  refresh(): Promise<void>
  generate(): Promise<void>
  cancelCode(): Promise<void>
  endAccess(): Promise<void>
}

const describe = (error: unknown) => error instanceof BackendError ? error.message : 'Something went wrong. Please try again.'

/** Loads while `uid` is set (the Account page is open) and clears when it is not. */
export function useSupportAccess(uid: string | undefined): SupportAccessController {
  const [data, setData] = useState<BackendSupportAccess | null>(null)
  const [code, setCode] = useState<SupportAccessController['code']>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Responses are applied only if the account they were requested for is still
  // the one on screen, so a reply that lands after sign-out or a switch is dropped.
  const owner = useRef(uid)
  owner.current = uid
  const refresh = useCallback(async () => {
    const requested = uid
    if (!requested) return
    setLoading(true)
    try {
      const next = await currentBackend().supportAccess()
      if (owner.current !== requested) return
      setData(next); setError(null)
    } catch (cause) { if (owner.current === requested) setError(describe(cause)) } finally { setLoading(false) }
  }, [uid])
  useEffect(() => { if (uid) void refresh(); else { setData(null); setCode(null); setError(null) } }, [uid, refresh])

  // While a code is out or access is active, the other side's actions change this state; keep it current.
  const watching = data !== null && (data.code !== null || data.grant !== null)
  useEffect(() => {
    if (!uid || !watching) return
    const timer = setInterval(() => { void refresh() }, 15_000)
    return () => clearInterval(timer)
  }, [uid, watching, refresh])

  const perform = useCallback(async (action: (requested: string) => Promise<void>) => {
    const requested = uid
    if (!requested) return
    setBusy(true); setError(null)
    try { await action(requested); await refresh() } catch (cause) { if (owner.current === requested) setError(describe(cause)) } finally { setBusy(false) }
  }, [uid, refresh])

  return {
    data, code, loading, busy, error, refresh,
    generate: () => perform(async (requested) => { const issued = await currentBackend().issueSupportCode(); if (owner.current === requested) setCode(issued) }),
    cancelCode: () => perform(async () => { await currentBackend().cancelSupportCode(); setCode(null) }),
    endAccess: () => perform(async () => { await currentBackend().endSupportAccess(); setCode(null) }),
  }
}
