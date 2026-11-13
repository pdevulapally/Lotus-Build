'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import { currentBackend } from '@/lib/backend/browser'
import { openBillingPortal } from '@/lib/billing/open-portal'

/** Only a user action creates a portal. Closing or switching accounts invalidates it. */
export function useBillingPortal(uid: string | undefined) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<symbol | null>(null)
  const currentUid = useRef(uid)
  currentUid.current = uid
  useEffect(() => {
    setBusy(false); setError(null)
    return () => { request.current = null }
  }, [uid])

  const open = useCallback(async () => {
    if (!uid || currentUid.current !== uid || request.current) return
    const identity = Symbol()
    request.current = identity
    const isCurrent = () => request.current === identity && currentUid.current === uid
    setBusy(true); setError(null)
    try {
      await openBillingPortal({ uid, currentUid: () => auth.currentUser?.uid, isCurrent,
        create: () => currentBackend().billingPortal(), navigate: url => window.location.assign(url),
      })
    } catch (reason) {
      if (isCurrent()) setError(reason instanceof Error ? reason.message : 'Stripe billing could not be opened. Try again.')
    } finally {
      if (isCurrent()) { request.current = null; setBusy(false) }
    }
  }, [uid])

  return { busy, error, open }
}
