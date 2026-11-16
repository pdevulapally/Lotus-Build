'use client'
import { useCallback, useEffect, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { Connector } from '@/lib/backend/connections'
import { connectIntegration, takeRedirectOutcome, type ConnectOutcome } from '@/lib/integrations/connect'

/** Connect any integration from the current page and learn the outcome without leaving it. */
export function useIntegrationConnect(onOutcome: (outcome: ConnectOutcome) => void) {
  const [connecting, setConnecting] = useState<string | null>(null)

  // A browser that blocked the popup comes back here by redirect with the outcome waiting.
  useEffect(() => {
    const outcome = takeRedirectOutcome(window.sessionStorage)
    if (outcome) onOutcome(outcome)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = useCallback(async (connector: Connector, options: { projectIds?: readonly string[] } = {}) => {
    setConnecting(connector.key)
    try {
      const outcome = await connectIntegration(currentBackend(), connector, options)
      if (outcome.status !== 'redirecting') onOutcome(outcome)
    } catch {
      onOutcome({ status: 'failed', connector: connector.key, message: `Could not start connecting ${connector.name}. Try again.` })
    } finally { setConnecting(null) }
  }, [onOutcome])

  return { connect, connecting }
}
