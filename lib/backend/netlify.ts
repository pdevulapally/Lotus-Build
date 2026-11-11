import { z } from 'zod'
const https = z.url().refine(value => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port })
export const netlifyDeploymentSchema = z.object({
  id: z.string(), projectId: z.string(), connectionId: z.string(), ownerUid: z.string(), sessionId: z.string(),
  title: z.string(), accountSlug: z.string(), publishDirectory: z.string(), buildCommand: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive(), files: z.number().int().positive(),
  createdAt: z.string(), expiresAt: z.string(),
  status: z.enum(['preparing', 'awaiting_approval', 'uploading', 'processing', 'ready', 'error', 'uncertain', 'rejected']),
  siteId: z.string().optional(), deployId: z.string().optional(), url: https.optional(), deployUrl: https.optional(), message: z.string().optional(),
})
export type NetlifyDeployment = z.infer<typeof netlifyDeploymentSchema>
export const netlifyDeploymentsSchema = z.object({ deployments: z.array(netlifyDeploymentSchema) })
export const netlifyDeploymentResponseSchema = z.object({ deployment: netlifyDeploymentSchema })
