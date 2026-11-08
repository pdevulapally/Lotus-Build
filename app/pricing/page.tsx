"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { LogoMark } from '@/components/ui/logo-loader'
import { ArrowRightIcon, CheckIcon } from '@/components/ui/lotus-icons'
import { Navbar } from '@/components/ui/navbar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { FooterSection } from '@/components/sections/footer-section'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsDialog } from '@/components/settings/settings-dialog'
import { currentBackend } from '@/lib/backend/browser'
import { clearCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt, type CheckoutAttempt } from '@/lib/backend/checkout-attempt'
import type { BackendPlan } from '@/lib/backend/client'
import { describeAllowance, describeCountCapabilities, featuredPlanKey, formatPlanPrice } from '@/lib/plans/format'
import styles from './pricing.module.css'
import billingStyles from '@/components/billing/billing-dialog.module.css'

export default function PricingPage() {
  const { user, account, loading: authLoading } = useAuth(); const router = useRouter()
  const { openSettings } = useSettingsDialog()
  const [plans, setPlans] = useState<BackendPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null)
  const submitting = useRef(false); const [revision, setRevision] = useState(0)
  const [checkoutCancelled, setCheckoutCancelled] = useState(false)
  const [checkoutAttempt, setCheckoutAttempt] = useState<CheckoutAttempt | null>(null)
  const canResumeCheckout = Boolean(checkoutAttempt && user?.uid === checkoutAttempt.uid
    && account && !account.subscriptionStatus)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') !== 'cancelled') return
    params.delete('checkout')
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
    setCheckoutCancelled(true)
  }, [])
  useEffect(() => {
    if (!checkoutCancelled || authLoading) return
    setCheckoutAttempt(user ? readCheckoutAttempt(window.sessionStorage, user.uid) : null)
  }, [checkoutCancelled, authLoading, user])
  useEffect(() => {
    if (account?.subscriptionStatus && user) {
      try { clearCheckoutAttempt(window.sessionStorage, user.uid) } catch {}
    }
  }, [account?.subscriptionStatus, user])
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
    // An existing subscriber changes plan in place from Settings; checkout would refuse a second subscription.
    if (account?.subscriptionStatus) { openSettings('plan'); return }
    if (submitting.current) return
    submitting.current = true; setBusy(plan.key); setError(null)
    try {
      const result = await currentBackend().checkout(plan.key)
      saveCheckoutAttempt(window.sessionStorage, { uid: user.uid, planKey: plan.key, url: result.url })
      window.location.assign(result.url)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open checkout. Please try again.') }
    finally { submitting.current = false; setBusy(null) }
  }
  return <section data-product-theme="dark" className="dark min-h-svh bg-background text-foreground">
    <Navbar />
    <Dialog open={checkoutCancelled} onOpenChange={setCheckoutCancelled}>
      <DialogContent overlayClassName="bg-black/60" data-product-theme="dark" className={`dark ${billingStyles.dialog}`}>
        <DialogHeader className="space-y-3 text-left">
          <div data-billing-icon className="flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground"><ArrowLeft className="size-5" aria-hidden /></div>
          <DialogTitle className="text-balance text-[22px] font-semibold leading-tight tracking-[-0.035em]">You left checkout</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground">
            {authLoading ? 'Checking your checkout…'
              : canResumeCheckout
                ? 'Your secure checkout page is ready when you are. Pick up where you left off without starting again.'
                : user ? 'Your original checkout link isn’t available in this browser. We won’t start a different checkout for you.'
                  : 'Log in to pick up your checkout where you left off.'}
          </DialogDescription>
        </DialogHeader>
        <footer className={billingStyles.actions}>
          <Button type="button" variant="outline" className="min-h-12 flex-1 rounded-xl" onClick={() => setCheckoutCancelled(false)}>Cancel</Button>
          {canResumeCheckout && checkoutAttempt ? <Button asChild className="min-h-12 flex-1 rounded-xl">
            <a href={checkoutAttempt.url} rel="noreferrer">Resume checkout</a>
          </Button> : !authLoading && !user ? <Button asChild className="min-h-12 flex-1 rounded-xl">
            <Link href="/login?redirect=%2Fpricing%3Fcheckout%3Dcancelled">Log in to resume</Link>
          </Button> : <Button type="button" disabled className="min-h-12 flex-1 rounded-xl" aria-busy={authLoading}>
            {authLoading ? 'Checking checkout…' : 'Resume checkout'}
          </Button>}
        </footer>
      </DialogContent>
    </Dialog>
    <main className={styles.main}>
      <RevealGroup as="header" className={styles.intro} animateOnMount>
        <RevealItem as="p" className={styles.eyebrow}>Plans & pricing</RevealItem>
        <RevealItem as="h1" className={styles.title}>Simple plans. Serious software.</RevealItem>
        <RevealItem as="p" className={styles.lead}>Every plan includes the full workspace: planning, building, live preview, terminal and saved versions. Pick the usage that fits.</RevealItem>
      </RevealGroup>

      <section aria-labelledby="compare-plans-heading" className={styles.comparison}>
        <h2 id="compare-plans-heading" className="sr-only">Compare plans</h2>

        {error && <div role="alert" className={styles.statePanel}>
          <h3>{plans ? 'Checkout couldn’t open' : 'We couldn’t load the plans'}</h3>
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="outline" disabled={busy !== null} className="mt-5 rounded-full" onClick={() => setRevision((value) => value + 1)}>Reload plans</Button>
        </div>}

        {!plans && !error && <div role="status" className={styles.statePanel}>
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <h3>Loading plans…</h3>
          </div>
          <p>Getting the latest prices and included usage.</p>
        </div>}

        {plans?.length === 0 && <div role="status" className={styles.statePanel}>
          <h3>No plans available right now</h3>
          <p>There are no plans to compare yet. You can check again below.</p>
          <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={() => setRevision((value) => value + 1)}>Check again</Button>
        </div>}

        {plans && plans.length > 0 && <RevealGroup className={styles.plans} animateOnMount delayChildren={0.15} step={0.08}>
          {plans.map((plan) => {
            const isCurrent = account?.plan.key === plan.key
            const featured = !account && plan.key === featuredPlanKey(plans)
            const price = plan.price ? formatPlanPrice(plan.price) : null
            return <RevealItem as="article" key={plan.key} className={styles.plan} data-current={isCurrent || undefined} data-featured={featured || undefined}>
              <div className={styles.planHead}>
                <h3>{plan.name}</h3>
                {isCurrent && <span className={styles.badge}>Your plan</span>}
                {featured && <span className={styles.badge}>Most popular</span>}
              </div>
              <div className={styles.price}>
                {price && plan.billing.perSeat ? <><span className={styles.amount}>{price.amount}</span><span className={styles.interval}>per seat {price.interval} · {plan.billing.minSeats} seats minimum</span></>
                  : price ? <><span className={styles.amount}>{price.amount}</span><span className={styles.interval}>{price.interval}</span></>
                  : <><span className={styles.amount}>{plan.name}</span><span className={styles.interval}>included with every account</span></>}
              </div>
              <div className={styles.planAction}>
                {isCurrent ? <span className={styles.currentAction}><CheckIcon width={16} height={16} />Current plan</span>
                  : plan.billing.perSeat ? <Link href={user ? '/settings' : '/signup?redirect=%2Fsettings'} className={styles.chooseQuiet}>{user ? 'Set up in Settings' : 'Create an account to start'}<ArrowRightIcon width={16} height={16} /></Link>
                  : plan.price ? <button type="button" disabled={busy !== null} onClick={() => void subscribe(plan)} className={styles.choose} aria-busy={busy === plan.key}>
                    {busy === plan.key ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> Opening checkout…</> : <>Choose {plan.name}<ArrowRightIcon width={16} height={16} /></>}
                  </button>
                  : <Link href={user ? '/' : '/signup'} className={styles.chooseQuiet}>{user ? 'Open workspace' : 'Create a free account'}<ArrowRightIcon width={16} height={16} /></Link>}
              </div>
              <div className={styles.allowances}>
                <p className={styles.allowanceLabel}>What’s included</p>
                {plan.allowances.length > 0 || describeCountCapabilities(plan.capabilities).length > 0 ? <ul className={styles.allowanceList}>
                  {describeCountCapabilities(plan.capabilities).map((capability) => <li key={capability.key}>
                    <span className={styles.allowanceName}>{capability.label}</span>
                    <span className={styles.allowanceValue}>{capability.value}</span>
                  </li>)}
                  {plan.allowances.map((allowance) => {
                    const described = describeAllowance(allowance)
                    return <li key={allowance.key}>
                      <span className={styles.allowanceName}>{allowance.label}</span>
                      <span className={styles.allowanceValue}>{described.included}{described.ceiling && <small>{described.ceiling}</small>}</span>
                    </li>
                  })}
                </ul> : <p className={styles.allowanceEmpty}>No usage allowances are listed for this plan.</p>}
              </div>
            </RevealItem>
          })}
        </RevealGroup>}
        <p role="status" className="sr-only">{busy ? 'Opening checkout…' : ''}</p>
      </section>

      <aside className={styles.help} aria-labelledby="pricing-help-heading">
        <div>
          <h2 id="pricing-help-heading">Not sure which plan?</h2>
          <p>Start free and upgrade when you need more usage. Your projects and history come with you.</p>
        </div>
        <Link href="/help" className={styles.helpLink}>Visit Help<ArrowRightIcon width={16} height={16} /></Link>
      </aside>
    </main>
    <FooterSection />
  </section>
}
