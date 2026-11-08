"use client"
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BrandLogo, DotsGlyph, PlusGlyph } from '@/components/integrations/connector-icons'
import { statusLabel } from '@/lib/backend/connections'
import { connectorName, useConnections } from '@/hooks/use-connections'
import styles from './integrations.module.css'

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
  const { state, busy, notice, setNotice, connect, disconnect } = useConnections()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('connected') === 'github') setNotice('GitHub is connected. Open a project and choose Repository to work in one of its repositories.')
  }, [searchParams, setNotice])

  return (
    <main className={styles.main}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Integrations</h1>
        <p className={styles.lead}>Connect services to let LotusBuild deploy and work across your tools</p>
      </header>

      {state.kind === 'loading' && <p className={styles.message} role="status">Loading integrations…</p>}
      {state.kind === 'error' && <p className={styles.message} role="alert">{state.message}</p>}
      {notice && <p className={styles.message} role="status">{notice}</p>}

      {state.kind === 'ready' && (
        <>
          {state.connections.length > 0 && (
            <section className={styles.section} aria-labelledby="connected">
              <h2 id="connected" className={styles.sectionTitle}>Connected</h2>
              <ul className={styles.grid}>
                {state.connections.map((connection) => {
                  const name = connectorName(state.connectors, connection.connector)
                  const account = connection.account?.name ?? name
                  const meta = connection.status === 'active'
                    ? [account, connection.account?.team].filter(Boolean).join(' · ')
                    : `${statusLabel[connection.status]} · ${account}`
                  return (
                    <li key={connection.id} className={styles.row}>
                      <span className={styles.tile} aria-hidden="true"><BrandLogo connector={connection.connector} name={name} /></span>
                      <div className={styles.text}>
                        <h3 className={styles.name}>{name}</h3>
                        <p className={styles.description}>{meta}</p>
                      </div>
                      {connection.status !== 'revoked' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className={styles.action} disabled={busy === connection.id} aria-label={`Options for ${name} (${account})`}>
                              <DotsGlyph />
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
          )}

          <section className={styles.section} aria-labelledby="available">
            <h2 id="available" className={styles.sectionTitle}>Available</h2>
            <ul className={styles.grid}>
              {state.connectors.map((connector) => {
                const pending = connector.status === 'configuration_required' || !state.configured
                return (
                  <li key={connector.key} className={styles.row}>
                    <span className={styles.tile} aria-hidden="true"><BrandLogo connector={connector.key} name={connector.name} /></span>
                    <div className={styles.text}>
                      <h3 className={styles.name}>{connector.name}</h3>
                      <p className={styles.description}>{connector.summary}</p>
                    </div>
                    {pending ? (
                      <span className={styles.soon}>Soon</span>
                    ) : (
                      <button type="button" className={styles.action} disabled={busy === connector.key} aria-label={`Connect ${connector.name}`} onClick={() => connect(connector)}>
                        <PlusGlyph />
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
