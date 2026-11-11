'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { BackendAccount } from '@/lib/backend/client'
import type { BillingSummaryState } from '@/hooks/use-billing-summary'
import { billingDate, subscriptionPrice, subscriptionStatus } from '@/lib/billing/format'
import { SettingsButton as Button } from '@/components/settings/settings-button'

export function SubscriptionSummary({ account, summary }: { account: BackendAccount; summary: BillingSummaryState }) {
  const { subscription, loading, error } = summary
  return <section aria-label="Subscription">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <section><p className="text-xs text-muted-foreground">Current plan</p><h3 className="mt-2 text-2xl font-semibold tracking-tight">{account.plan.name}</h3></section>
      {subscription && <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{subscriptionStatus(subscription)}</span>}
    </header>
    {loading ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading subscription details…</p> : error ? <p role="alert" className="mt-4 text-sm text-muted-foreground">Subscription details are unavailable. You can still open Stripe billing to review your account.</p> : subscription ? <>
      <p className="mt-4 text-lg font-medium tabular-nums">{subscriptionPrice(subscription)}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Base recurring price. Final invoices may reflect taxes, discounts, credits or prorations.</p>
      <section className="mt-5 divide-y divide-border/60 border-t border-border/60 text-sm">
        {subscription.planKey !== account.plan.key && <dl className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Billed subscription</dt><dd>{subscription.planName}</dd></dl>}
        <dl className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Billing period (UTC)</dt><dd>{billingDate(subscription.currentPeriodStart)} – {billingDate(subscription.currentPeriodEnd)}</dd></dl>
        <dl className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">{subscription.cancelAt || subscription.cancelAtPeriodEnd ? 'Scheduled cancellation' : 'Current period ends'}</dt><dd>{billingDate(subscription.cancelAt ?? subscription.currentPeriodEnd)}</dd></dl>
      </section>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Plan usage resets separately from your billing period. See Usage for allowance reset dates.</p>
    </> : <p className="mt-4 text-sm text-muted-foreground">No active paid subscription.</p>}
  </section>
}

export function BillingPanel({ account, summary, onOpenCredits, onClose }: { account: BackendAccount; summary: BillingSummaryState; onOpenCredits: () => void; onClose: () => void }) {
  return <section className="space-y-6">
    <SubscriptionSummary account={account} summary={summary} />
    <footer className="flex flex-wrap gap-2">
      <Button asChild><Link href="/account/billing" onClick={onClose}>Manage billing<ArrowUpRight aria-hidden="true" /></Link></Button>
      <Button asChild variant="outline"><Link href="/pricing" onClick={onClose}>Compare plans</Link></Button>
    </footer>
    <section className="border-t border-border/60 pt-5">
      <h3 className="text-sm font-semibold">Need more AI usage?</h3>
      <p className="mt-2 text-sm text-muted-foreground">View extra credits and one-time top-ups without changing your subscription.</p>
      <Button className="mt-4" variant="outline" onClick={onOpenCredits}>View on-demand usage</Button>
    </section>
  </section>
}

