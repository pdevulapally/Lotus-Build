'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowUpRight, CreditCard, Gauge, RefreshCw, Wallet, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { SettingsButton as Button } from '@/components/settings/settings-button'
import { SubscriptionSummary } from '@/components/settings/billing-panel'
import { CreditsPanel } from '@/components/settings/credits-panel'
import { billingSections } from '@/lib/billing/navigation'
import { useBillingSection } from '@/hooks/use-billing-section'
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
  const section = useBillingSection(reference.success)
  const activeSection = billingSections.find(item => item.id === section)!
  const sectionIcons = { plan: CreditCard, usage: Gauge, 'on-demand': Zap, payments: Wallet }
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
  return <main data-product-theme="dark" className="dark min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
    <section className="mx-auto max-w-6xl">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" />Back to workspace</Link>
      <header className="mb-8 mt-5 flex flex-wrap items-center justify-between gap-4">
        <section><h1 className="text-3xl font-semibold tracking-tight">Plan & billing</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Manage your plan, check usage or add extra AI credits.</p><p className="mt-2 break-all text-xs text-muted-foreground">{user?.email}</p></section>
        <Button variant="outline" disabled={summary.loading || credits.loading || busy || credits.busy} onClick={() => { setError(null); void summary.refresh(); void credits.refresh(); void refreshAccount().catch(() => { /* The auth context exposes accountError. */ }) }}><RefreshCw className={summary.loading ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />Refresh</Button>
      </header>
      <section className="grid items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Billing sections" className="grid grid-cols-2 gap-1 md:sticky md:top-6 md:grid-cols-1">
          {billingSections.map(item => {
            const Icon = sectionIcons[item.id]
            return <a key={item.id} href={`#${item.id}`} aria-current={section === item.id ? 'page' : undefined} aria-controls="billing-section-content"
              className={`flex min-h-12 items-start gap-3 rounded-lg px-3 py-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${section === item.id ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{item.label}<span className="mt-1 hidden text-xs font-normal leading-relaxed text-muted-foreground md:block">{item.description}</span></span>
            </a>
          })}
        </nav>
        <section id="billing-section-content" aria-labelledby="billing-section-title" className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 sm:p-8">
          <header className="mb-7 border-b border-border/60 pb-5"><h2 id="billing-section-title" className="text-xl font-semibold tracking-tight">{activeSection.label}</h2><p className="mt-2 text-sm text-muted-foreground">{activeSection.description}</p></header>
          {(error || accountError) && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || accountError}</p>}
          {section === 'plan' && <section className="space-y-7" aria-label="Your plan">
            {account ? <SubscriptionSummary account={account} summary={summary} /> : <p role="status" className="text-sm text-muted-foreground">Account details are unavailable. Refresh to try again.</p>}
            <Button asChild variant="outline"><Link href="/pricing">Compare plans<ArrowUpRight aria-hidden="true" /></Link></Button>
            <section className="divide-y divide-border/60 border-t border-border/60">
              <a href="#on-demand" className="flex min-h-16 items-center justify-between gap-4 rounded-md py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"><span><span className="block text-sm font-semibold">Need more AI usage?</span><span className="mt-1 block text-sm text-muted-foreground">View your extra credits or buy a one-time top-up.</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
              <a href="#payments" className="flex min-h-16 items-center justify-between gap-4 rounded-md py-5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage payments and invoices<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
            </section>
          </section>}
          {section === 'usage' && <section className="space-y-7">
            <a href="#on-demand" className="flex min-h-11 items-center justify-between gap-3 rounded-md text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">Looking for extra credits? Open on-demand usage<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></a>
            <AccountUsage usage={usage} showManagePlan={false} />
          </section>}
          {section === 'on-demand' && <CreditsPanel key={user?.uid} credits={credits} />}
          {section === 'payments' && <section aria-label="Payments and cancellation">
            <h3 className="text-base font-semibold">Payment details & invoices</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Review payment methods and download past invoices securely in Stripe. You’ll return here when you’re done.</p>
            <section className="mt-7 border-t border-border/60 pt-6">
              <h3 className="text-base font-semibold">Subscription changes & cancellation</h3>
              {!summary.loading && !summary.error && !summary.subscription && <p className="mt-2 text-sm text-muted-foreground">There is no active paid subscription to cancel.</p>}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Review available changes and their effective dates in Stripe before confirming. Opening billing does not change your plan.</p>
            </section>
            {credits.data?.portalAvailable === false ? <p className="mt-6 text-sm text-muted-foreground">You do not have a Stripe billing account yet. Choose a paid plan or an available top-up to review payment options.</p> : <Button className="mt-6" disabled={busy || credits.loading} onClick={() => void openPortal()}>{busy ? 'Opening Stripe…' : 'Open Stripe billing'}<ArrowUpRight aria-hidden="true" /></Button>}
          </section>}
        </section>
      </section>
    </section>
  </main>
}

export default function BillingPage() {
  return <section data-product-theme="dark" className="dark min-h-dvh bg-background text-foreground"><ProtectedRoute requiredTokens={0}><AccountBilling /></ProtectedRoute></section>
}

