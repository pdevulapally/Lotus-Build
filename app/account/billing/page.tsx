'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { SettingsButton as Button } from '@/components/settings/settings-button'
import { SubscriptionSummary } from '@/components/settings/billing-panel'
import { CreditsPanel } from '@/components/settings/credits-panel'
import { useCredits } from '@/hooks/use-credits'
import { creditPurchaseSchema } from '@/lib/billing/credits'
import { AccountUsage } from '@/components/settings/usage-panel'
import { useBillingSummary } from '@/hooks/use-billing-summary'
import { auth } from '@/lib/firebase'
import { openBillingPortal } from '@/lib/billing/open-portal'
import { currentBackend } from '@/lib/backend/browser'

export function AccountBilling() {
  const { user, account, usage, accountError, refreshAccount } = useAuth()
  const summary = useBillingSummary(user?.uid)
  const searchParams = useSearchParams()
  const reference = creditPurchaseSchema.shape.purchaseId.safeParse(searchParams.get('credit_purchase_id'))
  const credits = useCredits(user?.uid, reference.success ? reference.data : null)
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
  return <main data-product-theme="dark" className="dark min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
    <section className="mx-auto max-w-2xl">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" />Back to workspace</Link>
      <header className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-4">
        <section><h1 className="text-2xl font-semibold tracking-tight">Plan & billing</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your plan, usage and payment options in one place.</p><p className="mt-2 break-all text-xs text-muted-foreground">{user?.email}</p></section>
        <Button variant="outline" disabled={summary.loading || credits.loading || busy || credits.busy} onClick={() => { setError(null); void summary.refresh(); void credits.refresh(); void refreshAccount().catch(() => { /* The auth context exposes accountError. */ }) }}><RefreshCw className={summary.loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />Refresh</Button>
      </header>
      <nav aria-label="Billing sections" className="mb-6 flex flex-wrap gap-2">
        {([{ href: '#plan', label: 'Your plan' }, { href: '#usage', label: 'Usage' }, { href: '#payments', label: 'Payments & cancellation' }, { href: '#on-demand', label: 'On-demand usage' }]).map((item) => <Button key={item.href} asChild variant="outline"><a href={item.href}>{item.label}</a></Button>)}
      </nav>
      {(error || accountError) && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || accountError}</p>}
      <section className="space-y-7 rounded-2xl border border-border/60 bg-card p-5 sm:p-8">
        <section id="plan" className="scroll-mt-6" aria-label="Your plan">
          {account ? <SubscriptionSummary account={account} summary={summary} /> : <p role="status" className="text-sm text-muted-foreground">Account details are unavailable. Refresh to try again.</p>}
          <Button asChild variant="outline" className="mt-5"><Link href="/pricing">Compare plans</Link></Button>
        </section>
        <section id="usage" className="scroll-mt-6 border-t border-border/60 pt-6" aria-labelledby="billing-usage-title">
          <h2 id="billing-usage-title" className="mb-5 text-base font-semibold">Usage</h2>
          <AccountUsage usage={usage} showManagePlan={false} />
        </section>
        <section id="payments" className="scroll-mt-6 border-t border-border/60 pt-6" aria-labelledby="billing-payments-title">
          <h2 id="billing-payments-title" className="text-base font-semibold">Payments & cancellation</h2>
          {!summary.loading && !summary.error && !summary.subscription && <p className="mt-2 text-sm text-muted-foreground">There is no active paid subscription to cancel.</p>}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Subscription changes and cancellation are managed in Stripe. Review the available options and any effective dates there before confirming a change.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">You can also review payment details and past invoices in your Stripe billing account. You’ll return to this page when you’re done.</p>
          {credits.data?.portalAvailable === false ? <p className="mt-4 text-sm text-muted-foreground">You do not have a Stripe billing account yet. Choose a paid plan or an available top-up to review payment options.</p> : <Button className="mt-4" disabled={busy || credits.loading} onClick={() => void openPortal()}>{busy ? 'Opening Stripe…' : 'Open Stripe billing'}<ArrowUpRight aria-hidden="true" /></Button>}
        </section>
        <section id="on-demand" className="scroll-mt-6"><CreditsPanel key={user?.uid} credits={credits} /></section>
      </section>
    </section>
  </main>
}

export default function BillingPage() {
  return <section data-product-theme="dark" className="dark min-h-dvh bg-background text-foreground"><ProtectedRoute requiredTokens={0}><AccountBilling /></ProtectedRoute></section>
}
