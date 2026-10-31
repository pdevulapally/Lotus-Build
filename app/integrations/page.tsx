"use client"
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { FooterSection } from '@/components/sections/footer-section'
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

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <IntegrationsContent />
      <FooterSection />
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
        <p className={styles.eyebrow}>Integrations</p>
        <h1 className={styles.title}>Connect the services your projects ship with</h1>
        <p className={styles.lead}>
          Connect an account once, then choose which projects may use it. Nothing gets access by default, and every
          action that changes something outside LotusBuild asks you first.
        </p>
      </header>

      {state.kind === 'loading' && <p className={styles.state} role="status">Loading integrations…</p>}
      {state.kind === 'error' && <p className={styles.state} role="alert">{state.message}</p>}
      {notice && <p className={styles.state} role="status">{notice}</p>}

      {state.kind === 'ready' && (
        <>
          <section className={styles.section} aria-labelledby="your-connections">
            <h2 id="your-connections" className={styles.sectionTitle}>Your connections</h2>
            {state.connections.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.glyph} aria-hidden="true"><GrantGlyph /></span>
                <div>
                  <p className={styles.emptyTitle}>No services connected yet</p>
                  <p className={styles.emptyText}>When you connect one, you’ll pick the projects it may be used in. Credentials stay on the server and are never shown to you, the agent or your project code.</p>
                </div>
              </div>
            ) : (
              <div className={styles.grid}>
                {state.connections.map((connection) => {
                  const Glyph = connectorGlyphs[connection.connector]
                  return (
                    <div key={connection.id} className={styles.row}>
                      <span className={styles.glyph} aria-hidden="true"><Glyph /></span>
                      <div className={styles.rowBody}>
                        <p className={styles.name}>{connection.account?.name ?? connection.connector}</p>
                        <span className={styles.rowMeta}>{statusLabel[connection.status]}{connection.account?.team ? ` · ${connection.account.team}` : ''}</span>
                      </div>
                      {connection.status !== 'revoked' && (
                        <button type="button" className={styles.quiet} style={{ marginLeft: 'auto' }} disabled={busy === connection.id} onClick={() => disconnect(connection)}>Disconnect</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="available">
            <h2 id="available" className={styles.sectionTitle}>Available services</h2>
            <div className={styles.grid}>
              {state.connectors.map((connector) => {
                const Glyph = connectorGlyphs[connector.key]
                const pending = connector.status === 'configuration_required' || !state.configured
                return (
                  <article key={connector.key} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.glyph} aria-hidden="true"><Glyph /></span>
                      <h3 className={styles.name}>{connector.name}</h3>
                      <span className={`${styles.pill} ${pending ? '' : styles.pillActive}`}>{pending ? 'Setup pending' : 'Available'}</span>
                    </div>
                    <p className={styles.summary}>{connector.summary}</p>
                    <ul className={styles.caps} aria-label={`${connector.name} capabilities`}>
                      {connector.capabilities.map((capability) => (
                        <li key={capability.key} className={`${styles.cap} ${capability.requiresApproval ? styles.capApproval : ''}`} title={capability.description}>
                          {capability.title}{capability.requiresApproval ? ' · asks first' : ''}
                        </li>
                      ))}
                    </ul>
                    <div className={styles.actions}>
                      <button type="button" className={styles.connect} disabled={pending || busy === connector.key} onClick={() => connect(connector)}>
                        {busy === connector.key ? 'Opening…' : 'Connect'}
                      </button>
                      {pending && <span className={styles.hint}>Not switched on yet</span>}
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
