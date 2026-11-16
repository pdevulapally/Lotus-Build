"use client"
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BrandLogo, DotsGlyph, PlusGlyph } from '@/components/integrations/connector-icons'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsDialog } from '@/components/settings/settings-dialog'
import { currentBackend } from '@/lib/backend/browser'
import { statusLabel, type Connection, type Connector } from '@/lib/backend/connections'
import { PluginsPanel } from '@/components/settings/plugins-panel'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Search, Settings2, ChevronDown } from 'lucide-react'
import { integrationRows, type IntegrationView } from '@/lib/integrations/directory'
import { ConnectIntegrationDialog } from '@/components/integrations/connect-integration-dialog'
import { useIntegrationConnect } from '@/hooks/use-integration-connect'
import type { ConnectOutcome } from '@/lib/integrations/connect'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; connectors: Connector[]; connections: Connection[]; configured: boolean }
  | { kind: 'error'; message: string }

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <div data-product-theme="dark" className="dark integration-page">
        <Navbar />
        <IntegrationsContent />
      </div>
    </ProtectedRoute>
  )
}

function IntegrationsContent() {
  const { openSettings } = useSettingsDialog()
  const { user } = useAuth()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<IntegrationView>('available')
  const [accessOpen, setAccessOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    const openAccess = () => { if (window.location.hash === '#integration-access') setAccessOpen(true) }
    openAccess()
    window.addEventListener('hashchange', openAccess)
    return () => window.removeEventListener('hashchange', openAccess)
  }, [])

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    setState({ kind: 'loading' })
    const backend = currentBackend()
    ;(async () => {
      try {
        const catalogue = await backend.connectionCatalogue(controller.signal)
        // Without a key-encryption key the server answers 503 for the list: show the catalogue anyway, with no connections.
        const list = await backend.connections(controller.signal).then((r) => ({ ok: true as const, connections: r.connections }), () => ({ ok: false as const, connections: [] as Connection[] }))
        if (!controller.signal.aborted) setState({ kind: 'ready', connectors: catalogue.connectors, connections: list.connections, configured: list.ok })
      } catch (reason) {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: reason instanceof Error ? reason.message : 'Could not load integrations.' })
      }
    })()
    return () => controller.abort()
  }, [user?.uid, revision])

  const onOutcome = useCallback((outcome: ConnectOutcome) => {
    if (outcome.status === 'failed') { setNotice(outcome.message); return }
    if (outcome.status !== 'connected') return
    setSelectedKey(null); setNotice(null); setView('connected'); setRevision(value => value + 1)
  }, [])
  const { connect: startConnect, connecting } = useIntegrationConnect(onOutcome)
  const connect = async (connector: Connector) => {
    if (connector.auth === 'mcp-remote') { setSelectedKey(null); openSettings('plugins'); return }
    setNotice(null)
    await startConnect(connector)
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

  const rows = state.kind === 'ready' ? integrationRows(state.connectors, state.connections, view, query) : []
  const selected = state.kind === 'ready' ? state.connectors.find(connector => connector.key === selectedKey) : undefined
  const refresh = () => { setSelectedKey(null); setRevision(value => value + 1) }
  return (
    <main className="integration-main integration-directory-main">
      <header className="integration-directory-header">
        <VStack gap={3}><h1 className="integration-title integration-directory-title">Integrations</h1><p className="integration-lead">Connect integrations to let LotusBuild work across your tools</p></VStack>
        <HStack gap={3} align="center" className="integration-directory-tools">
          <label className="integration-search"><Search aria-hidden="true" /><input type="search" aria-label="Search integrations" placeholder="Search integrations" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <button type="button" className="integration-action" aria-label="Integration settings" onClick={() => setAccessOpen(true)}><Settings2 aria-hidden="true" /></button>
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="integration-add-action">Add <ChevronDown aria-hidden="true" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => openSettings('plugins')}>Add custom plugin</DropdownMenuItem><DropdownMenuItem asChild><Link href="/integrations/netlify/deployments">Netlify deployments</Link></DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </HStack>
      </header>
      <nav className="integration-views" aria-label="Integration views">
        <button type="button" className="integration-view" aria-pressed={view === 'available'} onClick={() => setView('available')}>Available</button>
        <button type="button" className="integration-view" aria-pressed={view === 'connected'} onClick={() => setView('connected')}>Connected</button>
      </nav>

      {state.kind === 'loading' && <p className="integration-message" role="status">Loading integrations…</p>}
      {state.kind === 'error' && <section className="integration-message" aria-label="Integration loading error"><p role="alert">Integrations couldn’t be loaded. Refresh to try again.</p><button type="button" className="integration-view" onClick={refresh}>Refresh integrations</button></section>}
      {notice && <p className="integration-message" role="status">{notice}</p>}

      {state.kind === 'ready' && (
        <>
          {state.connectors.length === 0 && <section className="integration-message" aria-label="Integration setup required"><p role="alert">Integrations haven’t been set up yet. Refresh to check again, or contact support.</p><button type="button" className="integration-view" onClick={refresh}>Refresh integrations</button></section>}
          {!state.configured && <section className="integration-message"><p role="alert">Your connections couldn’t be loaded. Refresh before connecting or disconnecting a service.</p><button type="button" className="integration-view" onClick={refresh}>Refresh connections</button></section>}
            <section className="integration-section" aria-labelledby="integration-list-title">
              <h2 id="integration-list-title" className="integration-section-title">{view === 'available' ? 'Available integrations' : 'Your connections'}</h2>
              <ul className="integration-grid integration-directory-grid">
                {rows.map(({ connector, connection }) => {
                  const name = connector.name
                  const account = connection?.account?.name ?? name
                  const pending = connector.status === 'configuration_required' || !state.configured
                  const meta = connection ? connection.status === 'active'
                    ? [account, connection.account?.team].filter(Boolean).join(' · ')
                    : `${statusLabel[connection.status]} · ${account}` : connector.summary
                  return (
                    <li key={connection?.id ?? connector.key} className="integration-row">
                      <span className="integration-tile" aria-hidden="true"><BrandLogo connector={connector.key} name={name} iconPath={connector.iconPath} /></span>
                      <VStack gap={1} className="integration-text">
                        <h3 className="integration-name"><button type="button" className="integration-name-action" onClick={() => { setNotice(null); setSelectedKey(connector.key) }}>{name}</button></h3>
                        <p className="integration-description">{meta}</p>
                      </VStack>
                      {connection ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="integration-action" disabled={busy === connection.id} aria-label={`Options for ${name} (${account})`}>
                              <DotsGlyph />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                            <DropdownMenuItem onSelect={() => connector.auth === 'mcp-remote' ? openSettings('plugins') : setAccessOpen(true)}>Integration access</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg px-3 py-2" onSelect={() => disconnect(connection)}>Disconnect</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : pending ? <span className="integration-soon">{state.configured ? 'Unavailable' : 'Refresh needed'}</span>
                        : <button type="button" className="integration-action" disabled={connecting === connector.key} aria-label={`Connect ${name}`} onClick={() => { setNotice(null); setSelectedKey(connector.key) }}><PlusGlyph /></button>}
                    </li>
                  )
                })}
              </ul>
              {state.connectors.length > 0 && rows.length === 0 && <p className="integration-lead">{query.trim() ? 'No integrations match your search.' : 'No integrations connected yet. Choose Available to connect a service.'}</p>}
            </section>
        </>
      )}
      <ConnectIntegrationDialog connector={selected ?? null} configured={state.kind === 'ready' && state.configured} busy={busy !== null || connecting !== null} error={notice}
        onOpenChange={open => { if (!open) setSelectedKey(null) }} onConnect={connect} />
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}><DialogContent className="dark max-h-dvh overflow-y-auto sm:max-w-3xl">
        <DialogTitle>Integration access</DialogTitle><DialogDescription>Choose the projects and tools each integration can use. Publishing still requires your approval.</DialogDescription>
        <section id="integration-access"><PluginsPanel section="integrations" /></section>
      </DialogContent></Dialog>
    </main>
  )
}
