"use client"
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { CheckGlyph, ChevronGlyph, connectorGlyphs, GrantGlyph, ShieldGlyph } from '@/components/integrations/connector-icons'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { statusLabel, type Connection, type Connector } from '@/lib/backend/connections'
import styles from './integrations.module.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: Connector[]; connections: Connection[]; configured: boolean }
  | { kind: 'error'; message: string }

const healthy = new Set<Connection['status']>(['active'])
const connectorName = (connectors: Connector[], key: Connector['key']) => connectors.find((c) => c.key === key)?.name ?? key

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
              <p className={styles.sectionNote}>{state.connections.length === 0 ? 'Nothing yet' : `${state.connections.length} ${state.connections.length === 1 ? 'service' : 'services'}`}</p>
            </div>
            {state.connections.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.tile} aria-hidden="true"><GrantGlyph /></span>
                <div className={styles.body}>
                  <h3 className={styles.name}>No services connected yet</h3>
                  <p className={styles.summary}>When you connect one, you choose which projects may use it. Credentials stay on the server and are never shown to you, the agent or your code.</p>
                </div>
              </div>
            ) : (
              <ul className={styles.list}>
                {state.connections.map((connection) => {
                  const Glyph = connectorGlyphs[connection.connector]
                  const ok = healthy.has(connection.status)
                  const label = connection.account?.name ?? connection.connector
                  const projects = connection.grantedProjectIds?.length
                  return (
                    <li key={connection.id} className={styles.row}>
                      <span className={styles.tile} aria-hidden="true"><Glyph /></span>
                      <div className={styles.body}>
                        <div className={styles.nameLine}>
                          <h3 className={styles.name}>{label}</h3>
                          <span className={`${styles.status} ${ok ? styles.statusOk : styles.statusWarn}`}><span className={styles.dot} aria-hidden="true" />{statusLabel[connection.status]}</span>
                        </div>
                        <p className={styles.summary}>
                          {connectorName(state.connectors, connection.connector)}{connection.account?.team ? ` · ${connection.account.team}` : ''}
                          {projects === undefined ? '' : projects === 0 ? ' · No projects can use it yet' : ` · ${projects} ${projects === 1 ? 'project' : 'projects'} can use it`}
                        </p>
                      </div>
                      {connection.status !== 'revoked' && (
                        <button type="button" className={styles.secondary} disabled={busy === connection.id} aria-label={`Disconnect ${label}`} onClick={() => disconnect(connection)}>
                          {busy === connection.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="available">
            <div className={styles.sectionHead}>
              <h2 id="available" className={styles.sectionTitle}>Available services</h2>
              <p className={styles.sectionNote}>Each one asks you before it changes anything outside LotusBuild.</p>
            </div>
            <ul className={styles.list}>
              {state.connectors.map((connector) => {
                const Glyph = connectorGlyphs[connector.key]
                const pending = connector.status === 'configuration_required' || !state.configured
                const detailsId = `${connector.key}-details`
                return (
                  <li key={connector.key} className={styles.row}>
                    <span className={styles.tile} aria-hidden="true"><Glyph /></span>
                    <div className={styles.body}>
                      <div className={styles.nameLine}>
                        <h3 className={styles.name}>{connector.name}</h3>
                        {pending && <span className={`${styles.status} ${styles.statusSoon}`}>Coming soon</span>}
                      </div>
                      <p className={styles.summary}>{connector.summary}</p>
                      <details className={styles.details}>
                        <summary className={styles.summaryToggle} aria-controls={detailsId}>
                          <ChevronGlyph className={styles.chevron} />
                          What it can do
                        </summary>
                        <div id={detailsId} className={styles.detailsBody}>
                          <ul className={styles.caps} aria-label={`${connector.name} capabilities`}>
                            {connector.capabilities.map((capability) => (
                              <li key={capability.key} className={styles.cap}>
                                <CheckGlyph className={styles.capIcon} />
                                <span><strong className={styles.capTitle}>{capability.title}</strong> — {capability.description}</span>
                              </li>
                            ))}
                          </ul>
                          {connector.limits && connector.limits.length > 0 && (
                            <ul className={styles.caps} aria-label={`${connector.name} limits`}>
                              {connector.limits.map((limit) => (
                                <li key={limit} className={styles.cap}><ShieldGlyph className={styles.capIcon} /><span>{limit}</span></li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    </div>
                    {!pending && (
                      <div className={styles.actions}>
                        <button type="button" className={styles.primary} disabled={busy === connector.key} aria-label={`Connect ${connector.name}`} onClick={() => connect(connector)}>
                          {busy === connector.key ? 'Opening…' : 'Connect'}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
