'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const refresh = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    try { setData(await currentBackend().supportAccess()); setError(null) } catch (cause) { setError(describe(cause)) } finally { setLoading(false) }
  }, [uid])
  useEffect(() => { if (uid) void refresh(); else { setData(null); setCode(null) } }, [uid, refresh])

  const perform = useCallback(async (action: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await action(); await refresh() } catch (cause) { setError(describe(cause)) } finally { setBusy(false) }
  }, [refresh])

  return {
    data, code, loading, busy, error, refresh,
    generate: () => perform(async () => { setCode(await currentBackend().issueSupportCode()) }),
    cancelCode: () => perform(async () => { await currentBackend().cancelSupportCode(); setCode(null) }),
    endAccess: () => perform(async () => { await currentBackend().endSupportAccess(); setCode(null) }),
  }
}
