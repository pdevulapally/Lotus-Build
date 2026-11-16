import { z } from 'zod'
import type { BackendClient } from './client'
import type { Connector } from './connections'
const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const https = z.url().refine(value => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port })
export const netlifyDeploymentSchema = z.object({
  id: documentId, projectId: documentId, connectionId: documentId, ownerUid: z.string().min(1), sessionId: documentId,
  title: z.string(), accountSlug: z.string(), accountId: z.string().optional(), publishDirectory: z.string(), buildCommand: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive(), files: z.number().int().positive(),
  createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  status: z.enum(['preparing', 'awaiting_approval', 'uploading', 'processing', 'ready', 'error', 'uncertain', 'rejected']),
  adminUrl: https.refine(value => new URL(value).hostname === 'app.netlify.com').optional(), siteId: z.string().optional(), deployId: z.string().optional(), url: https.optional(), deployUrl: https.optional(), message: z.string().optional(),
})
export type NetlifyDeployment = z.infer<typeof netlifyDeploymentSchema>
export const netlifyDeploymentsSchema = z.object({ deployments: z.array(netlifyDeploymentSchema) })
export const netlifyDeploymentResponseSchema = z.object({ deployment: netlifyDeploymentSchema })
export const netlifyDeploymentFor = (projectId: string, deploymentId: string) => netlifyDeploymentResponseSchema.refine(
  value => value.deployment.projectId === projectId && value.deployment.id === deploymentId,
)

export const netlifyDeploymentStatus: Record<NetlifyDeployment['status'], { label: string; description?: string }> = {
  preparing: { label: 'Preparing build review' },
  awaiting_approval: { label: 'Ready for review' },
  uploading: { label: 'Submitting to Netlify', description: 'An interrupted request may already have been accepted. Use Refresh to check progress before considering another publish.' },
  processing: { label: 'Netlify is preparing the site', description: 'Your site links will appear once Netlify confirms it is ready.' },
  ready: { label: 'Published' },
  error: { label: 'Deployment failed', description: 'Review Integration access, then ask the project agent to prepare a fresh deployment.' },
  uncertain: { label: 'Publication needs checking', description: 'Publishing was interrupted and may already have been accepted. Use Refresh to check again. If it stays unresolved, contact support before publishing again.' },
  rejected: { label: 'Cancelled' },
}

/** Refresh may reconcile a known deployment, but never prepares or repeats an upload. */
export async function loadNetlifyDeploymentHistory(client: BackendClient, projectId: string, signal: AbortSignal) {
  const result = await client.netlifyDeployments(projectId, signal)
  const updates = await Promise.allSettled(result.deployments.map(record =>
    ['processing', 'uploading', 'uncertain'].includes(record.status)
      ? client.refreshNetlifyDeployment(projectId, record.id, signal).then(value => value.deployment) : record))
  return {
    deployments: updates.map((update, index) => update.status === 'fulfilled' ? update.value : result.deployments[index]!),
    refreshFailed: updates.some(update => update.status === 'rejected'),
  }
}

export const netlifyPreparationPrompt = 'Prepare this project for deployment to Netlify. Inspect the actual project, build command and static output directory. Use the available Netlify tools and authorized project connections. Ask me to choose the destination team if it is not already confirmed; do not guess. Prepare the exact build for my review, but do not publish it or treat this request as publication approval.'

export function pendingNetlifyDeployment(records: readonly NetlifyDeployment[], now = Date.now()) {
  return records.find(record => ['preparing', 'uploading', 'processing', 'uncertain'].includes(record.status)
    || (record.status === 'awaiting_approval' && Date.parse(record.expiresAt) > now))
}

/** The tool a project must have switched on before the agent may prepare a deployment. */
export const netlifyPreparationTools = ['deploy'] as const

export type NetlifyPreparationAccess =
  | { state: 'ready' }
  | { state: 'unavailable' }
  | { state: 'connect'; connector: Connector }
  | { state: 'access'; connectionId: string }

/** Check the existing grants and deploy permission before asking the agent to spend allowance. */
export async function netlifyPreparationAccess(client: BackendClient, projectId: string, signal: AbortSignal): Promise<NetlifyPreparationAccess> {
  const { connectors } = await client.connectionCatalogue(signal)
  const connector = connectors.find(candidate => candidate.key === 'netlify' && candidate.auth === 'netlify-oauth' && candidate.status === 'available')
  if (!connector) return { state: 'unavailable' }
  const { connections } = await client.connections(signal)
  const active = connections.filter(connection => connection.connector === 'netlify' && connection.status === 'active')
  if (!active.length) return { state: 'connect', connector }
  const permissions = await Promise.all(active.map(async connection => {
    const [detail, tools] = await Promise.all([client.connection(connection.id, signal), client.pluginTools(connection.id, signal)])
    if (detail.connection.grantedProjectIds === undefined) throw new Error('Project access could not be verified.')
    return detail.connection.grantedProjectIds.includes(projectId)
      && netlifyPreparationTools.every(name => tools.tools.some(tool => tool.name === name && tool.mode === 'always'))
  }))
  return permissions.some(Boolean) ? { state: 'ready' } : { state: 'access', connectionId: active[0]!.id }
}
