'use client'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/integrations/connector-icons'
import { statusLabel } from '@/lib/backend/connections'
import { connectorName, useConnections } from '@/hooks/use-connections'
import { SettingsBadge, SettingsRow, SettingsSection } from './settings-row'

/** Integrations as settings rows, on the same loading and actions as the Integrations page. */
export function IntegrationsPage() {
  const { state, busy, notice, connect, disconnect } = useConnections()
  if (state.kind === 'loading') return <p role="status" className="text-sm text-muted-foreground">Loading integrations…</p>
  if (state.kind === 'error') return <p role="alert" className="text-sm text-muted-foreground">{state.message}</p>
  const connectedKeys = new Set(state.connections.filter((c) => c.status !== 'revoked').map((c) => c.connector))
  return (
    <div>
      {notice && <p role="status" className="mb-5 rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">{notice}</p>}
      {state.connections.length > 0 && (
        <SettingsSection title="Connected">
          {state.connections.map((connection) => {
            const name = connectorName(state.connectors, connection.connector)
            const account = connection.account?.name ?? name
            return (
              <SettingsRow key={connection.id} label={name} description={[account, connection.account?.team].filter(Boolean).join(' · ')}>
                {connection.status !== 'active' && <SettingsBadge tone="warning">{statusLabel[connection.status]}</SettingsBadge>}
                {connection.status !== 'revoked' && (
                  <Button type="button" variant="outline" size="sm" disabled={busy === connection.id} onClick={() => void disconnect(connection)}>Disconnect</Button>
                )}
              </SettingsRow>
            )
          })}
        </SettingsSection>
      )}
      <SettingsSection title="Available" description="Connect services so LotusBuild can deploy and work across your tools.">
        {state.connectors.map((connector) => {
          const pending = connector.status === 'configuration_required' || !state.configured
          return (
            <SettingsRow key={connector.key} label={connector.name} description={connector.summary}>
              <span className="flex size-7 items-center justify-center rounded-md bg-muted" aria-hidden="true"><BrandLogo connector={connector.key} name={connector.name} /></span>
              {pending ? <SettingsBadge>Soon</SettingsBadge>
                : connectedKeys.has(connector.key) ? <SettingsBadge>Connected</SettingsBadge>
                : <Button type="button" size="sm" variant="outline" disabled={busy === connector.key} onClick={() => void connect(connector)}>Connect</Button>}
            </SettingsRow>
          )
        })}
      </SettingsSection>
    </div>
  )
}
