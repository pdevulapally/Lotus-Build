'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { Connection, Connector } from '@/lib/backend/connections'

export type ConnectionsState =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: Connector[]; connections: Connection[]; configured: boolean }
  | { kind: 'error'; message: string }

/**
 * The one place integrations are loaded, connected and disconnected, shared by
 * the Integrations page and the settings Integrations section so the two can
 * never drift. `busy` names the connector or connection being acted on.
 */
export function useConnections() {
  const { user } = useAuth()
  const [state, setState] = useState<ConnectionsState>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const backend = currentBackend()
    ;(async () => {
      try {
        const catalogue = await backend.connectionCatalogue(controller.signal)
        // Without a key-encryption key the server answers 503 for the list: show the catalogue anyway, with no connections.
        const list = await backend.connections(controller.signal).then((r) => ({ ok: true as const, connections: r.connections }), () => ({ ok: false as const, connections: [] as Connection[] }))
        setState({ kind: 'ready', connectors: catalogue.connectors, connections: list.connections, configured: list.ok })
      } catch (reason) {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: reason instanceof Error ? reason.message : 'Could not load integrations.' })
      }
    })()
    return () => controller.abort()
  }, [user])

  const connect = useCallback(async (connector: Connector) => {
    setBusy(connector.key); setNotice(null)
    try {
      // A GitHub App install returns to our setup page, which completes the connection; nothing is granted to a project yet.
      const input = connector.auth === 'github-app' ? { returnTo: `${window.location.origin}/integrations/github/setup`, projectIds: [] } : undefined
      const { authorizeUrl } = await currentBackend().startConnection(connector.key, input)
      window.location.assign(authorizeUrl)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : `Could not start connecting ${connector.name}.`)
    } finally { setBusy(null) }
  }, [])

  const disconnect = useCallback(async (connection: Connection) => {
    setBusy(connection.id); setNotice(null)
    try {
      const result = await currentBackend().disconnectConnection(connection.id)
      setState((current) => current.kind === 'ready'
        ? { ...current, connections: current.connections.map((c) => (c.id === connection.id ? result.connection : c)) }
        : current)
      if (!result.providerRevoked) setNotice('Disconnected here. Also remove LotusBuild from the service’s own settings to revoke its access there.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not disconnect.')
    } finally { setBusy(null) }
  }, [])

  return { state, busy, notice, setNotice, connect, disconnect }
}

export const connectorName = (connectors: readonly Connector[], key: Connector['key']) => connectors.find((c) => c.key === key)?.name ?? key
