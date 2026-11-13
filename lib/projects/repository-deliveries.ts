import type { BackendSession } from '@/lib/backend/client'
import type { Delivery } from '@/lib/backend/delivery'

/** Several tasks can report the same PR. Keep its most recent whole snapshot. */
export function collectProjectDeliveries(sessions: Pick<BackendSession, 'delivery'>[], current?: Delivery): Delivery[] {
  const latest = new Map<string, Delivery>()
  for (const delivery of [...sessions.map((session) => session.delivery), current]) {
    if (!delivery) continue
    const key = `${delivery.repository}#${delivery.pullRequestNumber}`
    const previous = latest.get(key)
    if (!previous || Date.parse(delivery.updatedAt) >= Date.parse(previous.updatedAt)) latest.set(key, delivery)
  }
  return [...latest.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
