'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import { completeIntegration, deliverOutcome, type ConnectOutcome } from '@/lib/integrations/connect'

/**
 * Where a provider sends the browser after the user approves. Nobody stays
 * here: it finishes the connection, tells the page that started it, and then
 * closes itself or returns to that page.
 */
export default function IntegrationCallbackPage() {
  return (
    <ProtectedRoute>
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Suspense fallback={<Spinner className="size-5" />}><Callback /></Suspense>
      </main>
    </ProtectedRoute>
  )
}

function Callback() {
  const { user } = useAuth()
  const { connector: key } = useParams<{ connector: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const started = useRef(false)
  const [leftOpen, setLeftOpen] = useState(false)

  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    const returnTo = `${window.location.origin}${window.location.pathname}`
    // The one-use code must not stay in the address bar or the history.
    window.history.replaceState(null, '', returnTo)
    const finish = (outcome: ConnectOutcome) => {
      const next = deliverOutcome(outcome, window.sessionStorage)
      if (!next.close) { router.replace(next.path); return }
      window.close()
      setLeftOpen(true)
    }
    const backend = currentBackend()
    backend.connectionCatalogue()
      .then(({ connectors }) => connectors.find(connector => connector.key === key))
      .then(connector => connector ? completeIntegration(backend, connector, params, returnTo) : { status: 'cancelled' as const, connector: key })
      .catch(() => ({ status: 'failed' as const, connector: key, message: 'The connection could not be confirmed. Try again.' }))
      .then(finish)
  }, [user, key, params, router])

  if (leftOpen) return <p className="text-sm" role="status">You can close this window. <Link href="/integrations" className="underline">Open Integrations</Link></p>
  return <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Spinner className="size-4" /> Finishing the connection…</p>
}
