'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Button } from '@/components/ui/button'
import { SubscriptionSummary } from '@/components/settings/billing-panel'
import { OnDemandUsage } from '@/components/settings/usage-panel'
import { useBillingSummary } from '@/hooks/use-billing-summary'
import { auth } from '@/lib/firebase'
import { openBillingPortal } from '@/lib/billing/open-portal'
import { currentBackend } from '@/lib/backend/browser'

export function AccountBilling() {
  const { user, account, accountError, refreshAccount } = useAuth()
  const summary = useBillingSummary(user?.uid)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<symbol | null>(null)
  useEffect(() => {
    setBusy(false); setError(null)
    void refreshAccount().catch(() => { /* The auth context exposes accountError. */ })
    return () => { request.current = null }
  }, [user?.uid, refreshAccount])
  const openPortal = useCallback(async () => {
    if (request.current || !user) return
    const identity = Symbol()
    request.current = identity
    setBusy(true); setError(null)
    try {
      await openBillingPortal({ uid: user.uid, currentUid: () => auth.currentUser?.uid,
        isCurrent: () => request.current === identity,
        create: () => currentBackend().billingPortal(), navigate: (url) => window.location.assign(url),
      })
    } catch (reason) {
      if (request.current === identity) setError(reason instanceof Error ? reason.message : 'Stripe billing could not be opened. Try again.')
    } finally {
      if (request.current === identity) { request.current = null; setBusy(false) }
    }
  }, [user])
  return <main className="min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
    <section className="mx-auto max-w-2xl">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" />Back to workspace</Link>
      <header className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-4">
        <section><h1 className="text-2xl font-semibold tracking-tight">Plan & billing</h1><p className="mt-2 break-all text-sm text-muted-foreground">{user?.email}</p></section>
        <Button variant="outline" disabled={summary.loading || busy} onClick={() => { setError(null); void summary.refresh(); void refreshAccount().catch(() => { /* The auth context exposes accountError. */ }) }}><RefreshCw className={summary.loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />Refresh</Button>
      </header>
      {(error || accountError) && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || accountError}</p>}
      <section className="space-y-7 rounded-2xl border border-border/60 bg-card p-5 sm:p-8">
        {account ? <SubscriptionSummary account={account} summary={summary} /> : <p role="status" className="text-sm text-muted-foreground">Account details are unavailable. Refresh to try again.</p>}
        <Button asChild variant="outline"><Link href="/pricing">Compare plans</Link></Button>
        <section className="border-t border-border/60 pt-6">
          <h2 className="text-sm font-semibold">Invoices & payment details</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Manage your subscription, payment method and invoices securely in Stripe. You’ll return to this page when you’re done.</p>
          <Button className="mt-4" disabled={busy} onClick={() => void openPortal()}>{busy ? 'Opening Stripe…' : 'Open Stripe billing'}<ArrowUpRight aria-hidden="true" /></Button>
        </section>
        <OnDemandUsage />
      </section>
    </section>
  </main>
}

export default function BillingPage() {
  return <ProtectedRoute requiredTokens={0}><AccountBilling /></ProtectedRoute>
}
