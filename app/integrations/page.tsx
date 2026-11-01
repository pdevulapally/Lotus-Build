"use client"
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ArrowGlyph, ChevronGlyph, connectorGlyphs } from '@/components/integrations/connector-icons'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { statusLabel, type Connection, type Connector } from '@/lib/backend/connections'
import styles from './integrations.module.css'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: Connector[]; connections: Connection[]; configured: boolean }
  | { kind: 'error'; message: string }

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
        <p className={styles.lead}>Connect deployment targets and third-party tools your projects can use.</p>
      </header>

      {state.kind === 'loading' && <p className={styles.message} role="status">Loading integrations…</p>}
      {state.kind === 'error' && <p className={styles.message} role="alert">{state.message}</p>}
      {notice && <p className={styles.message} role="status">{notice}</p>}

      {state.kind === 'ready' && (
        <>
          <section className={styles.section} aria-labelledby="connected">
            <h2 id="connected" className={styles.sectionTitle}>Connected</h2>
            <ul className={styles.panel}>
              {state.connections.length === 0 ? (
                <li className={styles.row}>
                  <div className={styles.text}>
                    <p className={styles.name}>No services connected</p>
                    <p className={styles.description}>Connect one below. You choose which projects may use it; credentials stay on the server.</p>
                  </div>
                </li>
              ) : state.connections.map((connection) => {
                const Glyph = connectorGlyphs[connection.connector]
                const account = connection.account?.name ?? connection.connector
                const projects = connection.grantedProjectIds?.length
                const meta = [
                  `${connection.status === 'active' ? 'Connected as' : `${statusLabel[connection.status]} ·`} ${account}`,
                  connection.account?.team,
                  projects === undefined ? undefined : `${projects} ${projects === 1 ? 'project' : 'projects'}`,
                ].filter(Boolean).join(' · ')
                return (
                  <li key={connection.id} className={styles.row}>
                    <span className={styles.icon} aria-hidden="true"><Glyph /></span>
                    <div className={styles.text}>
                      <h3 className={styles.name}>{connectorName(state.connectors, connection.connector)}</h3>
                      <p className={styles.description}>{meta}</p>
                    </div>
                    {connection.status !== 'revoked' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={styles.button} disabled={busy === connection.id} aria-label={`Manage ${account}`}>
                            Manage <ChevronGlyph className={styles.buttonIcon} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                          <DropdownMenuItem className="rounded-lg px-3 py-2" onSelect={() => disconnect(connection)}>Disconnect</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="available">
            <h2 id="available" className={styles.sectionTitle}>Integrations</h2>
            <ul className={styles.panel}>
              {state.connectors.map((connector) => {
                const Glyph = connectorGlyphs[connector.key]
                const pending = connector.status === 'configuration_required' || !state.configured
                return (
                  <li key={connector.key} className={styles.row}>
                    <span className={styles.icon} aria-hidden="true"><Glyph /></span>
                    <div className={styles.text}>
                      <h3 className={styles.name}>{connector.name}</h3>
                      <p className={styles.description}>{connector.summary}</p>
                    </div>
                    {pending ? (
                      <span className={styles.soon}>Coming soon</span>
                    ) : (
                      <button type="button" className={styles.button} disabled={busy === connector.key} aria-label={`Connect ${connector.name}`} onClick={() => connect(connector)}>
                        Connect <ArrowGlyph className={styles.buttonIcon} />
                      </button>
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
