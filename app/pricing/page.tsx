"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import {
  PLAN_DISPLAY,
  DEFAULT_PLANS_FALLBACK,
  planIdForDisplay,
  getPaidPlanTiers,
  type PlanForApi,
  type PlanId,
} from "@/lib/plans"
import { PLAN_RATE_LIMIT_TABLE } from "@/lib/plan-limits"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Persisted just before redirecting to Stripe Checkout so a cancelled payment
// can offer a real retry of the exact plan/tier the user attempted.
const CHECKOUT_ATTEMPT_KEY = "lotus_checkout_attempt"

type CheckoutAttempt = {
  priceId: string
  quantity: number
  planName: string
}

export default function PricingPage() {
  const router = useRouter()
  const { user, userData, loading: authLoading } = useAuth()
  const [plans, setPlans] = useState<PlanForApi[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [selectedTierByPlanId, setSelectedTierByPlanId] = useState<Record<string, number>>({})
  const [checkoutCancelledOpen, setCheckoutCancelledOpen] = useState(false)
  const [cancelledAttempt, setCancelledAttempt] = useState<CheckoutAttempt | null>(null)

  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")?.trim()
      if (ref) window.localStorage.setItem("lotus_ref", ref)
    } catch {}
  }, [])

  // Stripe redirects back here with ?checkout=cancelled when the user aborts
  // Checkout. Surface it as a modal with a real retry of the attempted plan,
  // then strip the param so a refresh doesn't re-trigger the dialog.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get("checkout") !== "cancelled") return

      const raw = window.sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CheckoutAttempt> | null
        if (parsed && typeof parsed.priceId === "string" && parsed.priceId) {
          setCancelledAttempt({
            priceId: parsed.priceId,
            quantity: Number(parsed.quantity) >= 1 ? Number(parsed.quantity) : 1,
            planName: typeof parsed.planName === "string" ? parsed.planName : "",
          })
        }
      }
      setCheckoutCancelledOpen(true)

      params.delete("checkout")
      const query = params.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
    } catch {}
  }, [])

  useEffect(() => {
    fetch("/api/stripe/plans")
      .then((r) => r.json())
      .then((data) => {
        const apiPlans = Array.isArray(data.plans) ? data.plans : []
        const merged = DEFAULT_PLANS_FALLBACK.map((fallback) => {
          const fromApi = apiPlans.find(
            (p: PlanForApi) => planIdForDisplay(p.id) === planIdForDisplay(fallback.id)
          )
          return fromApi
            ? { ...fallback, ...fromApi, priceId: fromApi.priceId ?? fallback.priceId }
            : fallback
        })
        setPlans(merged)
      })
      .catch(() => setPlans(DEFAULT_PLANS_FALLBACK))
      .finally(() => setLoading(false))
  }, [])

  const formatPrice = (cents: number, interval: string) => {
    if (cents === 0) return { price: "$0", period: "/mo" }
    const dollars = cents / 100
    return {
      price: `$${dollars % 1 === 0 ? dollars : dollars.toFixed(2)}`,
      period: interval === "year" ? "/yr" : "/mo",
    }
  }

  const handleSubscribe = async (priceId: string, quantity = 1, planName = "") => {
    if (!user) { router.push("/login?redirect=/pricing"); return }
    setCheckoutLoading(priceId)
    try {
      const idToken = await user.getIdToken()
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken, priceId, quantity,
          successUrl: `${baseUrl}/projects?checkout=success`,
          cancelUrl:  `${baseUrl}/pricing?checkout=cancelled`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Checkout failed")
      if (data.url) {
        // Remembered so ?checkout=cancelled can offer a retry of this exact attempt.
        try {
          window.sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ priceId, quantity, planName }))
        } catch {}
        window.location.href = data.url
      }
      else throw new Error("No checkout URL")
    } catch (e) {
      console.error(e)
      setCheckoutLoading(null)
      alert(e instanceof Error ? e.message : "Checkout failed")
    }
  }

  const handleCancelledDialogChange = (open: boolean) => {
    setCheckoutCancelledOpen(open)
    if (!open) {
      setCancelledAttempt(null)
      try { window.sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch {}
    }
  }

  // Dialog stays open while retrying so the button can show its busy state;
  // a successful retry navigates away to Stripe Checkout.
  const handleRetryCheckout = () => {
    if (!cancelledAttempt || checkoutLoading) return
    void handleSubscribe(cancelledAttempt.priceId, cancelledAttempt.quantity, cancelledAttempt.planName)
  }

  const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS_FALLBACK
  const currentPlanId = userData?.planId ? planIdForDisplay(userData.planId) : null
  const planName = userData?.planName ?? (currentPlanId ? currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1) : "Free")
  const tokensUsed   = userData?.tokenUsage?.used ?? 0
  const baselineLimitByPlan: Record<PlanId, number> = { free: 10000, pro: 120000, team: 500000 }
  const tokensLimit  = userData
    ? Math.max(0, Number(userData.tokensLimit ?? 0), Number(userData.tokenUsage?.used ?? 0) + Number(userData.tokenUsage?.remaining ?? 0), currentPlanId ? baselineLimitByPlan[currentPlanId as PlanId] : 0)
    : 0
  const remaining = userData ? Math.max(0, userData.tokenUsage?.remaining ?? tokensLimit - tokensUsed) : 0

  return (
    <main className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-20 sm:px-6 sm:pt-28 lg:px-8">

        {/* ── Back ───────────────────────────────────────────────── */}
        <Link
          href="/"
          className="group mb-12 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back
        </Link>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-16 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
              Pricing · USD · Monthly
            </p>
            <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[52px]">
              One plan per stage.
            </h1>
            <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
              Credits power every AI generation. Rate limits scale with your plan so you never hit a wall mid-project.
            </p>
          </div>
          <p className="shrink-0 text-[12px] text-muted-foreground">
            Upgrade or downgrade anytime
          </p>
        </div>

        {/* ── Current plan usage ─────────────────────────────────── */}
        {user && userData && (
          <div className="mb-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/40 sm:grid-cols-3">
            <div className="flex flex-col justify-between bg-card px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current plan</p>
              <p className="mt-3 text-[22px] font-semibold tracking-tight text-foreground">{planName}</p>
            </div>
            <div className="col-span-1 bg-card px-6 py-5 sm:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Credits remaining</p>
                {userData.tokenUsage?.periodEnd && (
                  <p className="text-[11px] text-muted-foreground">
                    Renews {new Date(userData.tokenUsage.periodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tabular-nums tracking-tight text-foreground">
                  {remaining.toLocaleString()}
                </span>
                <span className="text-[12.5px] text-muted-foreground">of {tokensLimit.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${tokensLimit ? Math.min(100, (remaining / tokensLimit) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 shrink-0" />
                  Resets each billing period
                </p>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="h-8 rounded-full border-border bg-transparent px-4 text-[12px] font-medium hover:bg-muted">
                    Manage
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Plans ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {displayPlans.map((plan) => {
              const planKey    = planIdForDisplay(plan.id) as PlanId
              const display    = PLAN_DISPLAY[planKey] || PLAN_DISPLAY.pro
              const isFree     = planKey === "free"
              const isRecom    = display.recommended ?? false
              const tiers      = !isFree ? getPaidPlanTiers(plan) : []
              const tierIdx    = tiers.length ? (selectedTierByPlanId[plan.id] ?? 0) : 0
              const tier       = tiers[tierIdx] ?? null
              const effPrice   = tier ? tier.priceCents      : plan.price
              const effTokens  = tier ? tier.tokensPerMonth  : plan.tokensPerMonth
              const effQty     = tier?.quantity ?? 1
              const effPriceId = tier?.priceId ?? plan.priceId
              const { price: priceStr, period } = formatPrice(effPrice, plan.interval)
              const features   = display.features.length ? display.features : plan.features
              const isCurrentPlan = currentPlanId === planKey

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border",
                    isRecom
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-card"
                  )}
                >
                  {isRecom && (
                    <div className="absolute -top-3 left-5 rounded-full bg-background px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-foreground">
                      Recommended
                    </div>
                  )}

                  <div className="px-6 pb-5 pt-7">
                    {/* Plan name + icon */}
                    <div className="mb-4 flex items-center gap-2.5">
                      {planKey === "free" ? (
                        <img src="/Images/leaf-svgrepo-com.svg" className="h-5 w-5 opacity-70" alt="" />
                      ) : planKey === "pro" ? (
                        <img src="/Images/lotus-flower-svgrepo-com.svg" className="h-5 w-5 opacity-70" alt="" />
                      ) : (
                        <img src="/Images/enterprise-svgrepo-com.svg" className="h-5 w-5 opacity-70" alt="" />
                      )}
                      <span className={cn("text-[13px] font-semibold uppercase tracking-[0.1em]", isRecom ? "text-background/70" : "text-muted-foreground")}>
                        {plan.name}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-[40px] font-semibold leading-none tracking-[-0.04em]", isRecom ? "text-background" : "text-foreground")}>
                        {priceStr}
                      </span>
                      <span className={cn("text-[12px]", isRecom ? "text-background/40" : "text-muted-foreground")}>
                        {period}
                      </span>
                    </div>

                    <p className={cn("mt-2.5 text-[12.5px] leading-relaxed", isRecom ? "text-background/60" : "text-muted-foreground")}>
                      {display.description}
                    </p>
                  </div>

                  {/* Credits / tier selector */}
                  <div className="px-6 pb-5">
                    {isFree ? (
                      <div className={cn("rounded-xl px-4 py-3", isRecom ? "bg-background/10" : "bg-muted/50")}>
                        <p className={cn("text-[12.5px]", isRecom ? "text-background/60" : "text-muted-foreground")}>
                          <span className={cn("font-semibold tabular-nums", isRecom ? "text-background" : "text-foreground")}>
                            {plan.tokensPerMonth.toLocaleString()}
                          </span>{" "}credits / month
                        </p>
                      </div>
                    ) : tiers.length > 0 ? (
                      <div>
                        <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]", isRecom ? "text-background/40" : "text-muted-foreground")}>
                          Monthly credits
                        </p>
                        <Select
                          value={String(tierIdx)}
                          onValueChange={(v) => setSelectedTierByPlanId((prev) => ({ ...prev, [plan.id]: Number(v) }))}
                        >
                          <SelectTrigger className={cn(
                            "h-10 w-full rounded-xl border text-[12.5px] font-medium",
                            isRecom
                              ? "border-background/20 bg-background/10 text-background focus:ring-background/20"
                              : "border-border bg-muted/40 text-foreground focus:ring-ring/20"
                          )}>
                            <SelectValue>
                              <span className="tabular-nums">
                                {effTokens >= 1000
                                  ? `${(effTokens / 1000).toFixed(effTokens % 1000 === 0 ? 0 : 1)}k`
                                  : effTokens.toLocaleString()}{" "}credits /mo
                              </span>
                              <span className={cn("ml-1.5 font-normal", isRecom ? "text-background/40" : "text-muted-foreground")}>
                                · {priceStr}{period}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card p-1">
                            {tiers.map((t, i) => {
                              const tp = formatPrice(t.priceCents, plan.interval)
                              return (
                                <SelectItem key={i} value={String(i)} className="rounded-lg py-2.5 pl-3 pr-8 text-foreground focus:bg-muted">
                                  <span className="tabular-nums font-medium">
                                    {t.tokensPerMonth >= 1000
                                      ? `${(t.tokensPerMonth / 1000).toFixed(t.tokensPerMonth % 1000 === 0 ? 0 : 1)}k`
                                      : t.tokensPerMonth.toLocaleString()}{" "}credits /mo
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">{tp.price}{tp.period}</span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className={cn("rounded-xl px-4 py-3", isRecom ? "bg-background/10" : "bg-muted/50")}>
                        <p className={cn("text-[12.5px]", isRecom ? "text-background/60" : "text-muted-foreground")}>
                          <span className={cn("tabular-nums font-semibold", isRecom ? "text-background" : "text-foreground")}>
                            {plan.tokensPerMonth.toLocaleString()}
                          </span>{" "}credits / month
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={cn("mx-6 h-px", isRecom ? "bg-background/10" : "bg-border/50")} />

                  {/* Features */}
                  <div className="flex flex-1 flex-col gap-2.5 px-6 py-5">
                    {features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5">
                        <span className={cn("mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full", isRecom ? "bg-background/15" : "bg-muted")}>
                          <Check className={cn("h-[8px] w-[8px]", isRecom ? "text-background/80" : "text-foreground/60")} strokeWidth={3} />
                        </span>
                        <span className={cn("text-[12.5px] leading-snug", isRecom ? "text-background/65" : "text-muted-foreground")}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6 pt-1">
                    {isFree ? (
                      <Link href="/projects" className="block w-full">
                        <Button variant="outline" className="h-11 w-full rounded-full border-border bg-transparent text-[13px] font-medium hover:bg-muted">
                          Start free
                        </Button>
                      </Link>
                    ) : isCurrentPlan ? (
                      <Link href="/settings" className="block w-full">
                        <Button variant="outline" className={cn("h-11 w-full rounded-full text-[13px] font-medium", isRecom ? "border-background/20 bg-background/10 text-background hover:bg-background/20" : "border-border bg-transparent text-foreground hover:bg-muted")}>
                          Manage plan
                        </Button>
                      </Link>
                    ) : effPriceId ? (
                      <Button
                        disabled={!!checkoutLoading || authLoading}
                        className={cn(
                          "h-11 w-full rounded-full text-[13px] font-medium transition-all active:scale-[0.99]",
                          isRecom
                            ? "bg-background text-foreground hover:bg-background/90"
                            : "bg-foreground text-background hover:bg-foreground/85"
                        )}
                        onClick={() => handleSubscribe(effPriceId!, effQty, plan.name)}
                      >
                        {checkoutLoading === effPriceId ? <Loader2 className="h-4 w-4 animate-spin" /> : `Subscribe to ${plan.name}`}
                      </Button>
                    ) : (
                      <Button disabled className={cn("h-11 w-full rounded-full text-[13px] font-medium opacity-50", isRecom ? "bg-background text-foreground" : "bg-foreground text-background")}>
                        Subscribe to {plan.name}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Platform limits table ──────────────────────────────── */}
        <section className="mt-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
                Rate limits
              </p>
              <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
                What each plan allows
              </h2>
            </div>
            <p className="hidden text-[12px] text-muted-foreground sm:block">Enforced per user · resets each window</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40">
                  <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Operation
                  </th>
                  {(["Starter", "Pro", "Agency"] as const).map((name) => (
                    <th key={name} className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_RATE_LIMIT_TABLE.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-border/50 transition-colors last:border-0",
                      i % 2 === 0 ? "bg-card" : "bg-muted/20"
                    )}
                  >
                    <td className="px-6 py-4 text-[13px] font-medium text-foreground">
                      {row.label}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[13px] text-muted-foreground tabular-nums">
                      {row.free}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[13px] text-foreground tabular-nums">
                      {row.pro}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[13px] text-foreground tabular-nums">
                      {row.team}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground/70">
            Unauthenticated requests use conservative IP-based limits. Limits are applied per-account and reset on each window.
          </p>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-8 sm:flex-row sm:items-center">
          <p className="text-[12px] text-muted-foreground">Prices in USD · Cancel anytime</p>
          <Link href="/help" className="text-[12px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground">
            Need help choosing? →
          </Link>
        </div>

      </div>

      {/* ── Checkout cancelled dialog ─────────────────────────────── */}
      <Dialog open={checkoutCancelledOpen} onOpenChange={handleCancelledDialogChange}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card p-8 sm:p-10">
          <DialogHeader className="items-center space-y-3 text-center sm:text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <CreditCard className="h-7 w-7 text-foreground" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-[20px] font-semibold tracking-tight text-foreground">
              {cancelledAttempt?.planName
                ? `Payment for ${cancelledAttempt.planName} was unsuccessful`
                : "Payment was unsuccessful"}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-muted-foreground">
              {cancelledAttempt?.planName
                ? `The payment for the ${cancelledAttempt.planName} plan couldn't be completed. You haven't been charged.`
                : "The payment couldn't be completed. You haven't been charged."}
            </DialogDescription>
          </DialogHeader>
          {cancelledAttempt ? (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                onClick={() => handleCancelledDialogChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!!checkoutLoading}
                className="h-11 rounded-full bg-foreground text-[13px] font-medium text-background transition-all hover:bg-foreground/85 active:scale-[0.99]"
                onClick={handleRetryCheckout}
              >
                {checkoutLoading === cancelledAttempt.priceId
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "Retry"}
              </Button>
            </div>
          ) : (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full border-border bg-transparent text-[13px] font-medium hover:bg-muted"
                onClick={() => handleCancelledDialogChange(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FooterSection />
    </main>
  )
}
