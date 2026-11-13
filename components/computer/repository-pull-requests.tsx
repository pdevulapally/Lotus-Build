"use client"

import { useEffect, useMemo, useState } from 'react'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendSession } from '@/lib/backend/client'
import type { Delivery } from '@/lib/backend/delivery'
import { DeliveryCard } from '@/components/computer/delivery-card'
import { collectProjectDeliveries } from '@/lib/projects/repository-deliveries'

export function RepositoryPullRequests({ projectId, currentDelivery, revision }: {
  projectId?: string
  currentDelivery?: Delivery
  revision: number
}) {
  const [sessions, setSessions] = useState<BackendSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setSessions(null); setError(null)
    if (!projectId) { setError('This workspace has no project.'); return }
    const controller = new AbortController()
    currentBackend().sessions(projectId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setSessions(result.sessions) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load pull requests.') })
    return () => controller.abort()
  }, [projectId, revision])
  const deliveries = useMemo(() => collectProjectDeliveries(sessions ?? [], currentDelivery), [sessions, currentDelivery])
  return <section aria-label="Pull requests" className="space-y-4 p-4 @3xl/repository:p-6">
    <p className="text-sm text-muted-foreground">Pull requests published by LotusBuild, from the latest 100 tasks. Review and merge on GitHub.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {sessions === null && !error && <p role="status" className="text-sm text-muted-foreground">Loading pull requests…</p>}
    {sessions !== null && deliveries.length === 0 && <p className="py-6 text-sm text-muted-foreground">No pull requests have been published by these tasks.</p>}
    {deliveries.map((delivery) => <DeliveryCard key={`${delivery.repository}#${delivery.pullRequestNumber}`} delivery={delivery} />)}
  </section>
}
