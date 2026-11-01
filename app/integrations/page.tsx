"use client"
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { connectorGlyphs, GrantGlyph } from '@/components/integrations/connector-icons'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { statusLabel, type Connection, type Connector } from '@/lib/backend/connections'
import styles from './integrations.module.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: Connector[]; connections: Connection[]; configured: boolean }
  | { kind: 'error'; message: string }

const healthy = new Set<Connection['status']>(['active'])

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <div data-product-theme="dark" className={`dark ${styles.page}`}>
        <Navbar />
        <IntegrationsContent />
      </div>
    </ProtectedRoute>
  )
}

function IntegrationsContent() {
  const { user } = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })
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

  const connect = async (connector: Connector) => {
    setBusy(connector.key); setNotice(null)
    try {
      const { authorizeUrl } = await currentBackend().startConnection(connector.key)
      window.location.assign(authorizeUrl)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : `Could not start connecting ${connector.name}.`)
    } finally { setBusy(null) }
  }

  const disconnect = async (connection: Connection) => {
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
  }

  return (
    <main className={styles.main}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Integrations</h1>
        <p className={styles.lead}>Connect a service once, choose the projects that may use it, and approve every action that changes something outside LotusBuild.</p>
      </header>

      {state.kind === 'loading' && <p className={styles.message} role="status">Loading integrations…</p>}
      {state.kind === 'error' && <p className={styles.message} role="alert">{state.message}</p>}
      {notice && <p className={styles.message} role="status">{notice}</p>}

      {state.kind === 'ready' && (
        <>
          <section className={styles.section} aria-labelledby="connected">
            <div className={styles.sectionHead}>
              <h2 id="connected" className={styles.sectionTitle}>Connected</h2>
              <span className={styles.count}>{state.connections.length}</span>
            </div>
            <div className={styles.list}>
              {state.connections.length === 0 ? (
                <div className={styles.row}>
                  <span className={styles.tile} aria-hidden="true"><GrantGlyph /></span>
                  <div className={styles.body}>
                    <p className={styles.name}>Nothing connected yet</p>
                    <p className={styles.meta}>When you connect a service you’ll pick the projects it may be used in. Credentials stay on the server — never shown to you, the agent or your code.</p>
                  </div>
                </div>
              ) : state.connections.map((connection) => {
                const Glyph = connectorGlyphs[connection.connector]
                const ok = healthy.has(connection.status)
                return (
                  <div key={connection.id} className={styles.row}>
                    <span className={styles.tile} aria-hidden="true"><Glyph /></span>
                    <div className={styles.body}>
                      <p className={styles.name}>{connection.account?.name ?? connection.connector}</p>
                      <p className={styles.meta}>
                        <span className={`${styles.dot} ${ok ? styles.dotOk : styles.dotWarn}`} aria-hidden="true" />
                        {statusLabel[connection.status]}{connection.account?.team ? ` · ${connection.account.team}` : ''}
                        {connection.grantedProjectIds ? ` · ${connection.grantedProjectIds.length} ${connection.grantedProjectIds.length === 1 ? 'project' : 'projects'}` : ''}
                      </p>
                    </div>
                    {connection.status !== 'revoked' && (
                      <button type="button" className={styles.secondary} disabled={busy === connection.id} onClick={() => disconnect(connection)}>Disconnect</button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="available">
            <div className={styles.sectionHead}>
              <h2 id="available" className={styles.sectionTitle}>Available</h2>
              <span className={styles.count}>{state.connectors.length}</span>
            </div>
            <div className={styles.list}>
              {state.connectors.map((connector) => {
                const Glyph = connectorGlyphs[connector.key]
                const pending = connector.status === 'configuration_required' || !state.configured
                return (
                  <article key={connector.key} className={styles.row}>
                    <span className={styles.tile} aria-hidden="true"><Glyph /></span>
                    <div className={styles.body}>
                      <p className={styles.name}>{connector.name}</p>
                      <p className={styles.meta}>{connector.summary}</p>
                      <ul className={styles.caps} aria-label={`${connector.name} capabilities`}>
                        {connector.capabilities.map((capability) => (
                          <li key={capability.key} className={styles.cap} title={capability.description}>
                            {capability.title}{capability.requiresApproval ? <span className={styles.capNote}> · asks first</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.actions}>
                      {pending && <span className={styles.hint}>Coming soon</span>}
                      <button type="button" className={styles.primary} disabled={pending || busy === connector.key} onClick={() => connect(connector)}>Connect</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
