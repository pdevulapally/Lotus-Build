'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { billingSectionFromLocation } from '@/lib/billing/navigation'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
  }
}

/** Native links retain copy-link, reload, and browser Back/Forward behavior. */
export function useBillingSection(returningFromCheckout: boolean) {
  const read = useCallback(() => billingSectionFromLocation(window.location.hash, returningFromCheckout), [returningFromCheckout])
  const server = useCallback(() => billingSectionFromLocation('', returningFromCheckout), [returningFromCheckout])
  return useSyncExternalStore(subscribe, read, server)
}
