import type { Connection, Connector } from '../backend/connections'

/** Presentation assets shipped with this frontend, including older catalogues without iconPath. */
const brandAssets: Readonly<Record<string, string>> = {
  github: '/integrations/github.svg', netlify: '/integrations/netlify.svg',
  vercel: '/integrations/vercel.svg', slack: '/integrations/slack.svg',
  aws: '/integrations/aws.svg', mcp: '/integrations/mcp.svg',
}

export function connectorLogoPath(connector: string, iconPath?: string): string | undefined {
  return iconPath ?? (Object.hasOwn(brandAssets, connector) ? brandAssets[connector] : undefined)
}

export type IntegrationView = 'available' | 'connected'
export function integrationRows(connectors: Connector[], connections: Connection[], view: IntegrationView, query: string) {
  const search = query.trim().toLocaleLowerCase()
  return connectors.flatMap(connector => {
    const connected = connections.filter(connection => connection.connector === connector.key && connection.status !== 'revoked')
    const rows = connected.length ? connected.map(connection => ({ connector, connection }))
      : view === 'available' ? [{ connector, connection: undefined }] : []
    return rows.filter(({ connection }) => [connector.name, connector.summary, connection?.account?.name, connection?.account?.team]
      .some(value => value?.toLocaleLowerCase().includes(search)))
  })
}
