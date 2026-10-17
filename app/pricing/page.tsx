"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { FooterSection } from '@/components/sections/footer-section'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendPlan } from '@/lib/backend/client'

function priceLabel(plan: BackendPlan) {
  if (!plan.price) return 'No self-service price'
  const format = new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.price.currency })
  const digits = format.resolvedOptions().maximumFractionDigits
  if (typeof digits !== 'number') throw new Error('Currency precision is unavailable.')
  return `${format.format(plan.price.amountMinor / 10 ** digits)} / ${plan.price.interval}`
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
  return <><Navbar /><main className="mx-auto min-h-screen max-w-6xl px-5 pb-20 pt-16 text-foreground">
    <Link href="/" className="text-sm underline">Back to Lotus</Link>
    <h1 className="mt-8 font-display text-4xl font-medium">Plans</h1>
    <p className="mt-4 text-muted-foreground">Available plans and allowances from your current LotusBuild service.</p>
    {error && <div role="alert" className="mt-6 text-sm text-destructive"><p>{error}</p><button type="button" className="mt-2 underline" onClick={() => setRevision((value) => value + 1)}>Reload plans</button></div>}
    {!plans && !error && <p role="status" className="mt-8">Loading plans…</p>}
    {plans?.length === 0 && <p className="mt-8">No plans are currently available.</p>}
    {plans && <div className="mt-10 grid gap-5 md:grid-cols-3">{plans.map((plan) => <article key={plan.key} className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{plan.name}</h2><p className="mt-4 text-xl">{priceLabel(plan)}</p>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">{plan.allowances.map((allowance) => <li key={allowance.key}>{allowance.label}: {allowance.included.toLocaleString()} {allowance.unit} included; {allowance.limit.toLocaleString()} limit</li>)}</ul>
      {account?.plan.key === plan.key ? <p className="mt-6 text-sm font-medium">Current plan</p> : plan.price && <button type="button" disabled={busy !== null} onClick={() => void subscribe(plan)} className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy === plan.key ? 'Opening checkout…' : `Choose ${plan.name}`}</button>}
    </article>)}</div>}
  </main><FooterSection /></>
}
