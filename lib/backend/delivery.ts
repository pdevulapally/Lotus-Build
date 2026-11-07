import { z } from 'zod'

import type { BackendSession, SessionEvent } from './client'

const externalUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
}, 'Expected an HTTP(S) URL')

export const deliverySchema = z.object({
  id: z.string().min(1).max(128),
  provider: z.literal('github'),
  repository: z.string().min(3).max(140),
  title: z.string().min(1).max(256),
  branch: z.string().min(1).max(255),
  baseBranch: z.string().min(1).max(255),
  pullRequestNumber: z.number().int().positive(),
  pullRequestUrl: externalUrl,
  headSha: z.string().regex(/^[0-9a-f]{40}$/),
  status: z.enum(['CHECKS_PENDING', 'REPAIRING', 'READY_TO_MERGE', 'MERGED', 'DEPLOYING', 'LIVE', 'UNVERIFIED', 'FAILED']),
  checksPassed: z.number().int().nonnegative(),
  checksTotal: z.number().int().nonnegative(),
  failedChecks: z.array(z.string().min(1).max(200)).max(20),
  environmentUrl: externalUrl.optional(),
  updatedAt: z.string().datetime({ offset: true }),
})

export type Delivery = z.infer<typeof deliverySchema>

const deliveryEventSchema = z.object({ delivery: deliverySchema })

/** Delivery updates are whole snapshots; a delayed poll result cannot roll the card back. */
export function applyDeliveryEvent(session: BackendSession | null, event: SessionEvent): BackendSession | null {
  if (!session || event.type !== 'delivery.updated') return session
  const parsed = deliveryEventSchema.safeParse(event.data)
  if (!parsed.success) return session
  if (session.delivery !== undefined && Date.parse(parsed.data.delivery.updatedAt) <= Date.parse(session.delivery.updatedAt)) return session
  return { ...session, delivery: parsed.data.delivery }
}
