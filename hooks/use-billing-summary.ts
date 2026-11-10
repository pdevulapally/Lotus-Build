'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendSubscription } from '@/lib/backend/client'

export type BillingSummaryState = { subscription: BackendSubscription | null; loading: boolean; error: string | null }
const initial: BillingSummaryState = { subscription: null, loading: true, error: null }

/** A read-only refresh. Never creates a portal or checkout session on mount or return. */
export function useBillingSummary(uid: string | undefined) {
  const [state, setState] = useState<BillingSummaryState & { uid?: string }>(initial)
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    controller.current?.abort()
    if (!uid || auth.currentUser?.uid !== uid) return
    const request = new AbortController()
    controller.current = request
    setState({ ...initial, uid })
    try {
      const result = await currentBackend().billingSubscription(request.signal)
      if (!request.signal.aborted && auth.currentUser?.uid === uid) setState({ subscription: result.subscription, loading: false, error: null, uid })
    } catch (error) {
      if (!request.signal.aborted && auth.currentUser?.uid === uid) setState({ subscription: null, loading: false, error: error instanceof Error ? error.message : 'Billing details could not be loaded.', uid })
    }
  }, [uid])
  useEffect(() => {
    void refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => { controller.current?.abort(); window.removeEventListener('focus', onFocus); window.removeEventListener('pageshow', onFocus) }
  }, [refresh])
  return { ...(state.uid === uid ? state : initial), refresh }
}
