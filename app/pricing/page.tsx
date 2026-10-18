"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { Navbar } from '@/components/ui/navbar'
import { Button } from '@/components/ui/button'
import { FooterSection } from '@/components/sections/footer-section'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendPlan } from '@/lib/backend/client'
import styles from './pricing.module.css'

function priceLabel(plan: BackendPlan) {
  if (!plan.price) return 'Price not listed'
  const format = new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.price.currency })
  const digits = format.resolvedOptions().maximumFractionDigits
  if (typeof digits !== 'number') throw new Error('Currency precision is unavailable.')
  return format.format(plan.price.amountMinor / 10 ** digits)
}
export default function PricingPage() {
  const { user, account } = useAuth(); const router = useRouter()
  const [plans, setPlans] = useState<BackendPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null)
  const submitting = useRef(false); const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setError(null); setPlans(null)
    void (async () => {
      try { const result = await currentBackend().plans(controller.signal); if (!controller.signal.aborted) setPlans(result.plans) }
      catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load plans.') }
    })()
    return () => controller.abort()
  }, [revision])
  const subscribe = async (plan: BackendPlan) => {
    if (!user) { router.push('/login?redirect=/pricing'); return }
    if (submitting.current) return
    submitting.current = true; setBusy(plan.key); setError(null)
    try { const result = await currentBackend().checkout(plan.key); window.location.assign(result.url) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start checkout.') }
    finally { submitting.current = false; setBusy(null) }
  }
  return <>
    <Navbar />
    <main className={`site-shell ${styles.main}`}>
      <Link href="/" className={styles.backLink}>
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to Lotus
      </Link>

      <header className={styles.intro}>
        <div>
          <p className="site-eyebrow">Plans & pricing</p>
          <h1 className={`site-title ${styles.title}`}>Make room for<br />your next idea.</h1>
        </div>
        <p className={`site-lead ${styles.lead}`}>
          Compare what’s included and choose a plan for what you want to build.
          Prices and usage limits are listed below, side by side.
        </p>
      </header>

      <section aria-labelledby="compare-plans-heading" className={styles.comparison}>
        <div className={styles.sectionHeading}>
          <h2 id="compare-plans-heading" className="text-lg font-semibold tracking-tight">Compare plans</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {account ? 'Your current plan is highlighted below.' : 'Compare included usage and limits before you choose.'}
          </p>
        </div>

        {error && <div role="alert" className={styles.statePanel}>
          <h3 className="text-base font-semibold">{plans ? 'Checkout couldn’t open' : 'We couldn’t load the plans'}</h3>
          <p className="mt-2 break-words text-sm leading-relaxed text-destructive">{error}</p>
          <Button type="button" variant="outline" disabled={busy !== null} className="mt-5" onClick={() => setRevision((value) => value + 1)}>
            Reload plans
          </Button>
        </div>}

        {!plans && !error && <div role="status" className={styles.statePanel}>
          <div className="flex items-center gap-3">
            <LoaderCircle aria-hidden="true" className="size-5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
            <h3 className="text-base font-semibold">Loading plans…</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Getting the latest prices and included usage.</p>
        </div>}

        {plans?.length === 0 && <div role="status" className={styles.statePanel}>
          <h3 className="text-base font-semibold">No plans available right now</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">There are no plans to compare yet. You can check again below.</p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => setRevision((value) => value + 1)}>Check again</Button>
        </div>}

        {plans && plans.length > 0 && <div className={styles.plans}>
          {plans.map((plan) => {
            const isCurrent = account?.plan.key === plan.key
            return <article key={plan.key} className={styles.plan} data-current={isCurrent || undefined}>
              <h3 className="break-words text-xl font-semibold tracking-tight">{plan.name}</h3>
              <div className={styles.price}>
                <p className={plan.price ? styles.amount : 'text-lg font-medium'}>{priceLabel(plan)}</p>
                {plan.price && <p className="mt-2 text-sm text-muted-foreground">{plan.price.currency.toUpperCase()} / {plan.price.interval}</p>}
              </div>

              <div className={styles.allowances}>
                <p className="mb-5 text-xs font-semibold text-muted-foreground">Included usage & limits</p>
                {plan.allowances.length > 0 ? <dl className={styles.allowanceList}>
                  {plan.allowances.map((allowance) => <div key={allowance.key}>
                    <dt className="text-sm font-medium">{allowance.label}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">{allowance.included.toLocaleString()}</span> {allowance.unit} included
                      <span className="mt-1 block">Limit: <span className="tabular-nums">{allowance.limit.toLocaleString()}</span> {allowance.unit}</span>
                    </dd>
                  </div>)}
                </dl> : <p className="text-sm leading-relaxed text-muted-foreground">No usage allowances are listed for this plan.</p>}
              </div>

              <div className={styles.planAction}>
                {isCurrent ? <Button type="button" variant="outline" disabled className="h-auto min-h-12 w-full whitespace-normal opacity-100 disabled:opacity-100">
                  <Check aria-hidden="true" /> Current plan
                </Button> : plan.price ? <Button type="button" disabled={busy !== null} onClick={() => void subscribe(plan)} className="h-auto min-h-12 w-full whitespace-normal py-3" aria-busy={busy === plan.key}>
                  {busy === plan.key ? <><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Opening checkout…</> : <>Choose {plan.name}<ArrowRight aria-hidden="true" /></>}
                </Button> : <p className="text-sm leading-relaxed text-muted-foreground">Online checkout isn’t available for this plan.</p>}
              </div>
            </article>
          })}
        </div>}
        <p role="status" className="sr-only">{busy ? 'Opening checkout…' : ''}</p>
      </section>

      <aside className={styles.help} aria-labelledby="pricing-help-heading">
        <div>
          <h2 id="pricing-help-heading" className="text-base font-semibold">A question before you choose?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Visit Help for more about using LotusBuild.</p>
        </div>
        <Button asChild variant="outline" className="min-h-11"><Link href="/help">Visit Help<ArrowRight aria-hidden="true" /></Link></Button>
      </aside>
    </main>
    <FooterSection />
  </>
}
