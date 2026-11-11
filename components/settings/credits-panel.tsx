'use client'

import { useId, useState } from 'react'
import { SettingsButton as Button } from './settings-button'
import type { CreditsController } from '@/hooks/use-credits'
import { creditExpiry, creditPrice, creditPurchaseMessage } from '@/lib/billing/credits'

/** Share the same controller with the billing page so portal eligibility and balances stay together. */
export function CreditsPanel({ credits }: { credits: CreditsController }) {
  const { data, loading, unavailable, busy, error, purchaseError, checkoutBlockedReason, purchase, refresh, checkout, canRecoverCheckout, recoverCheckout } = credits
  const [selected, setSelected] = useState<string | null>(null)
  const groupName = useId()
  const offer = data?.offers.find(item => `${item.id}:${item.version}` === selected)
  return <section className="space-y-4" aria-label="On-demand usage" aria-busy={loading || busy}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold">Extra AI credits</h3>
      <Button variant="outline" size="sm" disabled={loading || busy} onClick={() => void refresh()}>Refresh credits</Button>
    </header>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data?.purchasing.enabled ? 'Buy extra AI credits with a one-time payment. Your subscription stays the same.' : 'Extra AI credits let you continue after your included allowance.'}</p>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Credits cover extra AI usage after your included allowance. They are not a cash balance and do not add storage or other plan features.</p>
    {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">Loading on-demand usage…</p>}
    {unavailable && !loading && <p role="status" className="mt-4 text-sm text-muted-foreground">On-demand usage is not available yet. Your plan and billing options are still available.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {purchaseError && <p role="alert" className="mt-4 text-sm text-destructive">{purchaseError}</p>}
    {checkoutBlockedReason && <p role="status" className="mt-4 text-sm text-muted-foreground">{checkoutBlockedReason}</p>}
    {canRecoverCheckout && <Button className="mt-3" variant="outline" disabled={loading || busy} onClick={() => void recoverCheckout()}>Resume previous checkout</Button>}
    {purchase && <p role="status" className="mt-4 text-sm">{creditPurchaseMessage(purchase)}</p>}
    {data && !loading && <>
      {data.wallet ? <section aria-label="Credit balance" className="my-6 grid gap-5 border-y border-border/60 py-6 text-sm sm:grid-cols-2">
        <dl><dt className="text-muted-foreground">Available credits</dt><dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{data.wallet.availableCredits.toLocaleString('en-GB')}</dd></dl>
        <dl><dt className="text-muted-foreground">Reserved for work in progress</dt><dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{data.wallet.reservedCredits.toLocaleString('en-GB')}</dd></dl>
      </section> : <p className="my-5 text-sm text-muted-foreground">Credit balance is unavailable.</p>}
      {!data.purchasing.enabled ? <p className="text-sm text-muted-foreground">{data.purchasing.reason || 'Top-ups are not available for this account.'}</p> : data.offers.length === 0 ? <p className="text-sm text-muted-foreground">No top-up options are available right now.</p> : <>
        <fieldset disabled={busy || Boolean(checkoutBlockedReason)} className="space-y-3">
          <legend className="mb-3 text-sm font-medium">Choose a top-up</legend>
          {data.offers.map(item => {
            const value = `${item.id}:${item.version}`
            return <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input className="mt-1 size-4 accent-primary" type="radio" name={groupName} value={value} checked={selected === value} onChange={() => setSelected(value)} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap justify-between gap-2 text-sm font-medium"><span>{item.credits.toLocaleString('en-GB')} credits</span><span className="tabular-nums">{creditPrice(item)} once</span></span>
                <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{creditExpiry(item)} {item.pacingPolicy === 'respect' ? 'The daily usage limit still applies.' : 'Paid credits can cover usage beyond the daily allowance. Other limits still apply.'}</span>
              </span>
            </label>
          })}
        </fieldset>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">One-time purchase, not an automatic top-up. Review your payment in Stripe before paying. Credits are added only after payment is verified.</p>
        <Button className="mt-4" disabled={!offer || busy || Boolean(checkoutBlockedReason)} onClick={() => { if (offer) void checkout(offer) }}>{busy ? 'Opening checkout…' : 'Continue to checkout'}</Button>
      </>}
    </>}
  </section>
}
