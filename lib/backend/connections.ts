import { z } from 'zod'

/** Mirrors lotusbuild-server src/connections: the order is the product order. */
export const connectorKeys = ['github', 'netlify', 'vercel', 'slack', 'aws', 'mcp'] as const
export type ConnectorKey = (typeof connectorKeys)[number]

export const connectionStatuses = ['connecting', 'active', 'expired', 'revoked', 'insufficient_permissions', 'provider_unavailable', 'configuration_required'] as const
export type ConnectionStatus = (typeof connectionStatuses)[number]

const capabilitySchema = z.object({ key: z.string(), title: z.string(), description: z.string(), requiresApproval: z.boolean() }).loose()

export const connectorSchema = z.object({
  key: z.enum(connectorKeys), name: z.string(), summary: z.string(),
  auth: z.enum(['github-app', 'oauth2', 'slack-install', 'aws-role', 'mcp-remote']),
  capabilities: z.array(capabilitySchema),
  limits: z.array(z.string()).optional(),
  status: z.enum(['available', 'configuration_required']),
}).loose()
export type Connector = z.infer<typeof connectorSchema>
export const catalogueSchema = z.object({ connectors: z.array(connectorSchema) })

/** What the API returns for a connection. Credentials never appear here, by contract. */
export const connectionSchema = z.object({
  id: z.string(), connector: z.enum(connectorKeys), status: z.enum(connectionStatuses), scopes: z.array(z.string()),
  account: z.object({ id: z.string(), name: z.string(), team: z.string().optional() }).optional(),
  health: z.object({ checkedAt: z.string(), ok: z.boolean(), detail: z.string().optional() }).optional(),
  createdAt: z.string(), updatedAt: z.string(), grantedProjectIds: z.array(z.string()).optional(),
}).strict()
export type Connection = z.infer<typeof connectionSchema>
export const connectionListSchema = z.object({ connections: z.array(connectionSchema) })
export const connectionDetailSchema = z.object({ connection: connectionSchema })
export const disconnectSchema = z.object({ connection: connectionSchema, providerRevoked: z.boolean() })
export const connectionStartSchema = z.object({ authorizeUrl: z.url(), expiresAt: z.string().optional() })

/** A repository an installation reaches, as the API reports it. */
export const repositorySchema = z.object({
  id: z.number().int(), fullName: z.string(), name: z.string(), owner: z.string(), private: z.boolean(),
  defaultBranch: z.string(), htmlUrl: z.url(), pushedAt: z.string().optional(),
}).strict()
export type Repository = z.infer<typeof repositorySchema>
export const repositoryListSchema = z.object({ repositories: z.array(repositorySchema) })

/** The repository a project is bound to. */
export const projectSourceSchema = z.object({
  kind: z.literal('github'), connectionId: z.string(), fullName: z.string(), defaultBranch: z.string(), branch: z.string().optional(), boundAt: z.string(),
}).strict()
export type ProjectSource = z.infer<typeof projectSourceSchema>
export const projectSourceResponseSchema = z.object({ source: projectSourceSchema.nullable() })

export const statusLabel: Record<ConnectionStatus, string> = {
  connecting: 'Connecting', active: 'Connected', expired: 'Needs reconnecting', revoked: 'Disconnected',
  insufficient_permissions: 'Needs more access', provider_unavailable: 'Provider unavailable', configuration_required: 'Setup pending',
}
