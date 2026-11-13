'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '@/lib/firebase'
import { currentBackend } from '@/lib/backend/browser'
import type { BillingCredits, CreditOffer, CreditPurchase, CreditTask } from '@/lib/billing/credits'
import { readCreditsSnapshot } from '@/lib/billing/credits-read'
import { clearCreditOperation, openCreditCheckout, readCreditOperation } from '@/lib/billing/credits-checkout'

export type CreditsState = { data: BillingCredits | null; purchase: CreditPurchase | null; loading: boolean; unavailable: boolean; busy: boolean; error: string | null; purchaseError: string | null; checkoutBlockedReason: string | null; canRecoverCheckout: boolean }
const initial: CreditsState = { data: null, purchase: null, loading: true, unavailable: false, busy: false, error: null, purchaseError: null, checkoutBlockedReason: null, canRecoverCheckout: false }

/** Every return/focus action is a read. Only the explicit checkout action creates a payment session. */
export function useCredits(uid: string | undefined, purchaseId?: string | null, continuation?: CreditTask) {
  const [state, setState] = useState<CreditsState & { uid?: string }>(initial)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const generation = useRef(0)
  const busy = useRef(false)
  const paymentChecks = useRef({ purchaseId: '', count: 0 })
  const currentUid = useRef(uid)
  currentUid.current = uid
  const isCurrent = useCallback(() => mounted.current && currentUid.current === uid && auth.currentUser?.uid === uid, [uid])
  const refresh = useCallback(async () => {
    controller.current?.abort()
    if (!uid || !isCurrent()) return
    const request = new AbortController()
    controller.current = request
    setState(old => ({ ...(old.uid === uid ? old : initial), uid, loading: true, unavailable: false, busy: busy.current, error: null }))
    try {
      const backend = currentBackend()
      const snapshot = await readCreditsSnapshot({
        readWallet: () => backend.billingCredits(request.signal),
        readPurchase: id => backend.creditPurchase(id, request.signal),
        readOperation: () => readCreditOperation(window.sessionStorage, uid), purchaseId,
      })
      if (request.signal.aborted || !isCurrent()) return
      const { operation: _operation, ...result } = snapshot
      if (result.purchase && result.purchase.status !== 'pending') {
        try {
          clearCreditOperation(window.sessionStorage, uid, result.purchase.purchaseId)
          result.canRecoverCheckout = readCreditOperation(window.sessionStorage, uid) !== null
        }
        catch { result.checkoutBlockedReason = 'Saved checkout information could not be updated. Restore browser storage before starting another purchase.' }
      }
      setState(old => ({ ...result, loading: false, busy: old.busy, uid }))
    } catch (error) {
      if (!request.signal.aborted && isCurrent()) setState(old => ({ ...initial, busy: old.busy, loading: false, error: error instanceof Error ? error.message : 'On-demand usage could not be loaded.', uid }))
    }
  }, [uid, purchaseId, isCurrent])
  useEffect(() => {
    mounted.current = true
    generation.current += 1
    busy.current = false
    void refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => { generation.current += 1; mounted.current = false; controller.current?.abort(); window.removeEventListener('focus', onFocus); window.removeEventListener('pageshow', onFocus) }
  }, [refresh])
  useEffect(() => {
    const purchase = state.uid === uid ? state.purchase : null
    if (!uid || !purchase || purchase.status !== 'pending' || state.purchaseError || state.error || state.loading) return
    if (paymentChecks.current.purchaseId !== purchase.purchaseId) paymentChecks.current = { purchaseId: purchase.purchaseId, count: 0 }
    if (paymentChecks.current.count >= 12) return
    const timer = window.setTimeout(() => { paymentChecks.current.count++; void refresh() }, 5000)
    return () => window.clearTimeout(timer)
  }, [uid, state.uid, state.purchase, state.loading, state.purchaseError, state.error, refresh])
  const runCheckout = useCallback(async (offer: Pick<CreditOffer, 'id' | 'version'>, requireExisting = false) => {
    if (busy.current || !uid || !isCurrent() || state.loading || state.uid !== uid) return
    if (!requireExisting && (state.checkoutBlockedReason || !state.data?.purchasing.enabled || !state.data.offers.some(o => o.id === offer.id && o.version === offer.version))) return
    const started = generation.current
    const stillCurrent = () => generation.current === started && isCurrent()
    busy.current = true
    setState(old => ({ ...old, busy: true, error: null }))
    try {
      await openCreditCheckout({ uid, offer, requireExisting, ...(continuation === undefined ? {} : { continuation }), storage: window.sessionStorage, currentUid: () => auth.currentUser?.uid, isCurrent: stillCurrent,
        create: (input, key) => currentBackend().creditCheckout(input, key), navigate: url => window.location.assign(url) })
      if (stillCurrent()) await refresh()
    } catch (error) {
      if (stillCurrent()) {
        await refresh()
        if (stillCurrent()) setState(old => ({ ...old, error: error instanceof Error ? error.message : 'Checkout could not be opened. Retry to continue the same purchase.' }))
      }
    } finally {
      if (stillCurrent()) { busy.current = false; setState(old => ({ ...old, busy: false })) }
    }
  }, [uid, state.data, state.uid, state.loading, state.checkoutBlockedReason, isCurrent, refresh, continuation])
  const checkout = useCallback((offer: CreditOffer) => runCheckout(offer), [runCheckout])
  const recoverCheckout = useCallback(async () => {
    if (!uid || !isCurrent() || busy.current || state.loading) return
    try {
      const saved = readCreditOperation(window.sessionStorage, uid)
      if (!saved) { await refresh(); return }
      await runCheckout({ id: saved.offerId, version: saved.offerVersion }, true)
    } catch {
      if (isCurrent()) setState(old => ({ ...old, error: 'Saved checkout information is unavailable. Restore browser storage and refresh.' }))
    }
  }, [uid, isCurrent, state.loading, refresh, runCheckout])
  return { ...(state.uid === uid ? state : initial), refresh, checkout, recoverCheckout }
}
export type CreditsController = ReturnType<typeof useCredits>
