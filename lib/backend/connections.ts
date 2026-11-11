import { z } from 'zod'

/** Provider identities and presentation come from the backend catalogue. */
export const connectorKeySchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)
export type ConnectorKey = z.infer<typeof connectorKeySchema>

export const connectionStatuses = ['connecting', 'active', 'expired', 'revoked', 'insufficient_permissions', 'provider_unavailable', 'configuration_required'] as const
export type ConnectionStatus = (typeof connectionStatuses)[number]

const capabilitySchema = z.object({ key: z.string(), title: z.string(), description: z.string(), requiresApproval: z.boolean() }).loose()

export const connectorSchema = z.object({
  key: connectorKeySchema, name: z.string(), summary: z.string(),
  auth: connectorKeySchema,
  browserCallback: z.boolean().optional(),
  toolPermissions: z.boolean().optional(),
  iconPath: z.string().regex(/^\/integrations\/[a-z0-9_-]+\.svg$/).optional(),
  capabilities: z.array(capabilitySchema),
  limits: z.array(z.string()).optional(),
  status: z.enum(['available', 'configuration_required']),
}).loose()
export type Connector = z.infer<typeof connectorSchema>
export const catalogueSchema = z.object({ connectors: z.array(connectorSchema) })

/** What the API returns for a connection. Credentials never appear here, by contract. */
export const connectionSchema = z.object({
  id: z.string(), connector: connectorKeySchema, status: z.enum(connectionStatuses), scopes: z.array(z.string()),
  account: z.object({ id: z.string(), name: z.string(), team: z.string().optional() }).optional(),
  health: z.object({ checkedAt: z.string(), ok: z.boolean(), detail: z.string().optional() }).optional(),
  createdAt: z.string(), updatedAt: z.string(), grantedProjectIds: z.array(z.string()).optional(),
}).strict()
export type Connection = z.infer<typeof connectionSchema>
export const connectionListSchema = z.object({ connections: z.array(connectionSchema) })
export const connectionDetailSchema = z.object({ connection: connectionSchema })
export const pluginToolSchema = z.object({ name: z.string(), description: z.string(), inputSchema: z.record(z.string(), z.unknown()),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/), readOnly: z.boolean(), mode: z.enum(['off', 'read-only', 'always']) }).strict()
export type PluginTool = z.infer<typeof pluginToolSchema>
export const pluginToolsSchema = z.object({ tools: z.array(pluginToolSchema), rejected: z.array(z.object({ name: z.string(), reason: z.string() })).optional() })
export const pluginCreatedSchema = pluginToolsSchema.extend({ connection: connectionSchema })
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
