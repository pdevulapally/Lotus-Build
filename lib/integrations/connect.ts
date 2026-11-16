import type { BackendClient } from '../backend/client'
import type { Connection, Connector } from '../backend/connections'

/**
 * One connect flow for every integration that sends the browser back to us.
 *
 * The page that starts it opens the provider in a popup and waits. The provider
 * returns to the callback page, which finishes the connection, reports the
 * outcome on a same-origin channel and closes itself. When a popup cannot be
 * opened the same steps run as a full redirect that returns to the starting page.
 */
export type ConnectOutcome =
  | { status: 'connected'; connector: string; connectionId: string; account?: string }
  | { status: 'failed'; connector: string; message: string }
  | { status: 'cancelled'; connector: string }

const channelName = 'lotusbuild:integration-connect'
const returnPathKey = 'lotusbuild:integration-return'
const outcomeKey = 'lotusbuild:integration-outcome'
const fallbackPath = '/integrations'

/** The address registered with each provider. It only ever passes the user through. */
export function integrationCallbackUrl(origin: string, connector: string): string {
  return `${origin}/integrations/${encodeURIComponent(connector)}/setup`
}

type Completion = (client: BackendClient, params: URLSearchParams, returnTo: string) => Promise<{ connection: Connection }> | undefined

/** What each sign-in method sends back. A new method is one entry here; `undefined` means the visit completes nothing. */
const completions: Readonly<Record<string, Completion>> = {
  'github-app': (client, params, returnTo) => {
    const state = params.get('state'), code = params.get('code'), installationId = Number(params.get('installation_id'))
    if (!state || !code || !Number.isInteger(installationId) || installationId <= 0) return undefined
    return client.completeGitHubConnection({ state, code, installationId, returnTo })
  },
  'netlify-oauth': (client, params, returnTo) => {
    const state = params.get('state'), code = params.get('code')
    if (!state || !code || params.get('error')) return undefined
    return client.completeNetlifyConnection({ state, code, returnTo })
  },
}

/** Runs on the callback page: exchange what the provider sent for a connection. Provider and server text is never shown. */
export async function completeIntegration(client: BackendClient, connector: Connector, params: URLSearchParams, returnTo: string): Promise<ConnectOutcome> {
  const pending = completions[connector.auth]?.(client, params, returnTo)
  if (pending === undefined) return { status: 'cancelled', connector: connector.key }
  try {
    const { connection } = await pending
    return { status: 'connected', connector: connector.key, connectionId: connection.id, ...(connection.account ? { account: connection.account.name } : {}) }
  } catch {
    return { status: 'failed', connector: connector.key, message: `${connector.name} could not be connected. Try again.` }
  }
}

function safeReturnPath(value: string | null): string {
  return value !== null && /^\/(?![/\\])/.test(value) ? value : fallbackPath
}

/**
 * Runs on the callback page: hand the outcome to whoever started the flow and say where this window goes next.
 * A redirect leaves a return path in this tab; without one this window is the popup, so it reports and closes.
 */
export function deliverOutcome(outcome: ConnectOutcome, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): { close: true } | { close: false; path: string } {
  const returnPath = storage.getItem(returnPathKey)
  if (returnPath === null) {
    const channel = new BroadcastChannel(channelName)
    channel.postMessage(outcome)
    channel.close()
    return { close: true }
  }
  storage.removeItem(returnPathKey)
  storage.setItem(outcomeKey, JSON.stringify(outcome))
  return { close: false, path: safeReturnPath(returnPath) }
}

/** After a full redirect, the starting page reads the outcome once. */
export function takeRedirectOutcome(storage: Pick<Storage, 'getItem' | 'removeItem'>): ConnectOutcome | null {
  const raw = storage.getItem(outcomeKey)
  if (raw === null) return null
  storage.removeItem(outcomeKey)
  try {
    const value = JSON.parse(raw) as ConnectOutcome
    return typeof value?.connector === 'string' && ['connected', 'failed', 'cancelled'].includes(value.status) ? value : null
  } catch { return null }
}

function waitForOutcome(connector: string, popup: Window): Promise<ConnectOutcome> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(channelName)
    const finish = (outcome: ConnectOutcome) => { clearInterval(watch); channel.close(); resolve(outcome) }
    channel.onmessage = (event: MessageEvent<ConnectOutcome>) => { if (event.data?.connector === connector) finish(event.data) }
    // The outcome is posted before the popup closes; the short wait lets it arrive first.
    const watch = setInterval(() => {
      if (!popup.closed) return
      clearInterval(watch)
      setTimeout(() => finish({ status: 'cancelled', connector }), 500)
    }, 500)
  })
}

/**
 * Starts connecting from any page. `projectIds` are granted when the connection is made.
 * Resolves with the outcome, or `redirecting` when the browser is leaving for the provider.
 */
export async function connectIntegration(client: BackendClient, connector: Connector, options: { projectIds?: readonly string[] } = {}): Promise<ConnectOutcome | { status: 'redirecting' }> {
  if (connector.browserCallback !== true) {
    const { authorizeUrl } = await client.startConnection(connector.key)
    window.location.assign(authorizeUrl)
    return { status: 'redirecting' }
  }
  // A popup starts with a copy of this tab's storage; a stale return path would make it act as a redirect.
  window.sessionStorage.removeItem(returnPathKey)
  // Opened before any await so the browser ties it to the click and does not block it.
  const popup = window.open('', 'lotusbuild-integration-connect', 'popup,width=640,height=760')
  try {
    const { authorizeUrl } = await client.startConnection(connector.key, {
      returnTo: integrationCallbackUrl(window.location.origin, connector.key), projectIds: options.projectIds ?? [],
    })
    if (popup === null) {
      window.sessionStorage.setItem(returnPathKey, `${window.location.pathname}${window.location.search}`)
      window.location.assign(authorizeUrl)
      return { status: 'redirecting' }
    }
    const outcome = waitForOutcome(connector.key, popup)
    popup.location.replace(authorizeUrl)
    return await outcome
  } catch (reason) {
    popup?.close()
    throw reason
  }
}

/**
 * Lets a project use an existing connection and switches on the named tools,
 * leaving every other grant and tool setting as it is.
 */
export async function allowConnectionForProject(client: BackendClient, connectionId: string, projectId: string, toolNames: readonly string[]): Promise<void> {
  const { connection } = await client.connection(connectionId)
  const granted = connection.grantedProjectIds
  if (granted === undefined) throw new Error('Project access could not be verified.')
  if (!granted.includes(projectId)) await client.setConnectionGrants(connectionId, [...granted, projectId])
  if (toolNames.length === 0) return
  const { tools } = await client.pluginTools(connectionId)
  if (toolNames.some(name => !tools.some(tool => tool.name === name))) throw new Error('This connection does not offer the required permission.')
  if (tools.every(tool => !toolNames.includes(tool.name) || tool.mode === 'always')) return
  await client.setPluginPermissions(connectionId, tools.map(tool => toolNames.includes(tool.name) ? { ...tool, mode: 'always' as const } : tool))
}
