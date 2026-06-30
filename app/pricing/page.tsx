"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/ui/navbar"
import { FooterSection } from "@/components/sections/footer-section"
import { Check, ArrowLeft, Loader2, Leaf, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  PLAN_DISPLAY,
  DEFAULT_PLANS_FALLBACK,
  planIdForDisplay,
  getPaidPlanTiers,
  type PlanForApi,
  type PlanId,
} from "@/lib/plans"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── all backend logic untouched ──────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter()
  const { user, userData, loading: authLoading } = useAuth()
  const [plans, setPlans] = useState<PlanForApi[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [selectedTierByPlanId, setSelectedTierByPlanId] = useState<Record<string, number>>({})

  // Persist referral attribution so it survives the login/signup round-trip and
  // is recorded on the new account when it's created.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")?.trim()
      if (ref) window.localStorage.setItem("lotus_ref", ref)
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
    if (cents === 0) return { price: "$0", period: interval === "forever" ? "forever" : "/mo" }
    const dollars = cents / 100
    return {
      price: `$${dollars % 1 === 0 ? dollars : dollars.toFixed(2)}`,
      period: interval === "year" ? "/year" : "/mo",
    }
  }

  const handleSubscribe = async (priceId: string, quantity = 1) => {
    if (!user) {
      router.push("/login?redirect=/pricing")
      return
    }
    setCheckoutLoading(priceId)
    try {
      const idToken = await user.getIdToken()
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          priceId,
          quantity,
          successUrl: `${baseUrl}/projects?checkout=success`,
          cancelUrl: `${baseUrl}/pricing?checkout=cancelled`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Checkout failed")
      if (data.url) window.location.href = data.url
      else throw new Error("No checkout URL")
    } catch (e) {
      console.error(e)
      setCheckoutLoading(null)
      alert(e instanceof Error ? e.message : "Checkout failed")
    }
  }

  const displayPlans = plans.length > 0 ? plans : DEFAULT_PLANS_FALLBACK

  const currentPlanId = userData?.planId ? planIdForDisplay(userData.planId) : null
  const fallbackPlanName =
    currentPlanId ? currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1) : "Free"
  const planName = userData?.planName || fallbackPlanName
  const tokensUsed = userData?.tokenUsage?.used ?? 0
  const baselineLimitByPlan: Record<PlanId, number> = { free: 10000, pro: 120000, team: 500000 }
  const tokensLimit = userData
    ? Math.max(
        0,
        Number(userData.tokensLimit ?? 0),
        Number(userData.tokenUsage?.used ?? 0) + Number(userData.tokenUsage?.remaining ?? 0),
        currentPlanId ? baselineLimitByPlan[currentPlanId as PlanId] : 0
      )
    : 0
  const remaining = userData
    ? Math.max(0, userData.tokenUsage?.remaining ?? tokensLimit - tokensUsed)
    : 0
  const normalizeFeatureCopy = (feature: string) => {
    const f = feature.toLowerCase()
    if (f.includes("api")) return "Website publishing and growth-ready workflows"
    if (f.includes("webhook")) return "Smart automation triggers for your website updates"
    if (f.includes("sdk")) return "Built-in visual tools and guided editing controls"
    if (f.includes("rate limit")) return "Higher generation capacity for growing teams"
    return feature
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-20 sm:px-6 sm:pt-28 lg:px-8">

        {/* ── Back nav ─────────────────────────────────────────── */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back
          </Link>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70 sm:block">
            Monthly billing · USD
          </span>
        </div>

        {/* ── Page header ──────────────────────────────────────── */}
        <section className="mb-14 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1">
            <Leaf className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Pricing
            </span>
          </div>
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground sm:text-[44px]">
            Pick the plan that matches this stage.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Start free, upgrade when the work needs more credits, and keep every plan change tied to your existing account.
          </p>
        </section>

        {/* ── Current plan usage (logged-in only) ──────────────── */}
        {user && userData && (
          <div className="mb-12 flex flex-col items-start gap-6 rounded-2xl border border-border/70 bg-card px-7 py-6 shadow-sm sm:flex-row sm:items-center sm:gap-8">
            {/* Plan name */}
            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Current plan
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{planName}</p>
            </div>

            <div className="hidden h-10 w-px bg-border sm:block" />

            {/* Usage bar */}
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-foreground">
                  {remaining.toLocaleString()}
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  of {tokensLimit.toLocaleString()} credits remaining
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${tokensLimit ? Math.min(100, (remaining / tokensLimit) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                {userData.tokenUsage?.periodEnd
                  ? `Renews ${new Date(userData.tokenUsage.periodEnd).toLocaleDateString()} · `
                  : ""}
                Usage refreshes each billing period
              </p>
            </div>

            <div className="hidden h-10 w-px bg-border sm:block" />

            {/* Manage */}
            <Link href="/settings" className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-border bg-transparent px-5 text-[13px] font-medium text-foreground hover:bg-muted"
              >
                Manage
              </Button>
            </Link>
          </div>
        )}

        {/* ── Plans section header ──────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Plans
          </span>
          <span className="text-[12px] text-muted-foreground">Upgrade or downgrade anytime</span>
        </div>

        {/* ── Plans grid ───────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">Loading plans…</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {displayPlans.map((plan) => {
              const planKey = planIdForDisplay(plan.id) as PlanId
              const display = PLAN_DISPLAY[planKey] || PLAN_DISPLAY.pro
              const recommended = display.recommended ?? false
              const isFree = plan.id === "free" || planKey === "free"
              const tiers = !isFree ? getPaidPlanTiers(plan) : []
              const selectedTierIndex = tiers.length ? (selectedTierByPlanId[plan.id] ?? 0) : 0
              const selectedTier = tiers[selectedTierIndex] ?? null
              const effectivePrice = selectedTier ? selectedTier.priceCents : plan.price
              const effectiveTokens = selectedTier ? selectedTier.tokensPerMonth : plan.tokensPerMonth
              const effectiveQuantity = selectedTier?.quantity ?? 1
              const effectivePriceId = selectedTier?.priceId ?? plan.priceId
              const hasPriceId = !!effectivePriceId
              const { price: priceStr, period } = formatPrice(effectivePrice, plan.interval)
              const features = display.features.length ? display.features : plan.features

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border transition-shadow",
                    recommended
                      ? "border-primary bg-primary shadow-lg shadow-primary/10"
                      : "border-border/70 bg-card hover:shadow-sm"
                  )}
                >
                  {recommended && (
                    <div className="absolute -top-3 left-6 rounded-full bg-primary-foreground px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-primary shadow-sm">
                      Recommended
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="px-7 pb-5 pt-8">
                    <div className={cn("mb-5", recommended ? "text-primary-foreground" : "text-foreground")}>
                      {planKey === "free" ? (
                        <img src="/Images/leaf-svgrepo-com.svg" className="h-7 w-7" alt="Starter" />
                      ) : planKey === "pro" ? (
                        <img src="/Images/lotus-flower-svgrepo-com.svg" className="h-7 w-7" alt="Pro" />
                      ) : (
                        <img src="/Images/enterprise-svgrepo-com.svg" className="h-7 w-7" alt="Enterprise" />
                      )}
                    </div>
                    <h2
                      className={cn(
                        "text-[17px] font-semibold tracking-tight",
                        recommended ? "text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {plan.name}
                    </h2>
                    <p
                      className={cn(
                        "mt-1.5 text-[12.5px] leading-relaxed",
                        recommended ? "text-primary-foreground/65" : "text-muted-foreground"
                      )}
                    >
                      {display.description}
                    </p>

                    {/* Price row */}
                    <div className="mt-5 flex items-baseline gap-1">
                      <span
                        className={cn(
                          "text-[36px] font-semibold leading-none tracking-[-0.03em]",
                          recommended ? "text-primary-foreground" : "text-foreground"
                        )}
                      >
                        {priceStr}
                      </span>
                      <span
                        className={cn(
                          "text-[12.5px]",
                          recommended ? "text-primary-foreground/45" : "text-muted-foreground"
                        )}
                      >
                        {period}
                      </span>
                    </div>
                  </div>

                  {/* Credits / tier selector */}
                  <div className="px-7 pb-5">
                    {isFree ? (
                      <div
                        className={cn(
                          "rounded-xl px-4 py-3",
                          recommended ? "bg-primary-foreground/10" : "bg-muted/60"
                        )}
                      >
                        <p className={cn("text-[12.5px]", recommended ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          <span className={cn("font-semibold", recommended ? "text-primary-foreground" : "text-foreground")}>
                            {plan.tokensPerMonth.toLocaleString()}
                          </span>{" "}
                          credits / month
                        </p>
                      </div>
                    ) : tiers.length > 0 ? (
                      <div>
                        <p
                          className={cn(
                            "mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]",
                            recommended ? "text-primary-foreground/45" : "text-muted-foreground"
                          )}
                        >
                          Monthly credits
                        </p>
                        <Select
                          value={String(selectedTierIndex)}
                          onValueChange={(v) =>
                            setSelectedTierByPlanId((prev) => ({ ...prev, [plan.id]: Number(v) }))
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-10 w-full rounded-xl border text-[12.5px] font-medium",
                              recommended
                                ? "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground focus:ring-primary-foreground/20"
                                : "border-border bg-muted/40 text-foreground focus:ring-ring/20"
                            )}
                          >
                            <SelectValue>
                              <span>
                                {effectiveTokens >= 1000
                                  ? `${(effectiveTokens / 1000).toFixed(effectiveTokens % 1000 === 0 ? 0 : 1)}k`
                                  : effectiveTokens.toLocaleString()}{" "}
                                credits /mo
                              </span>
                              <span className={cn("ml-1.5 font-normal", recommended ? "text-primary-foreground/45" : "text-muted-foreground")}>
                                · {priceStr}{period}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card p-1">
                            {tiers.map((tier, i) => {
                              const tierPrice = formatPrice(tier.priceCents, plan.interval)
                              return (
                                <SelectItem
                                  key={i}
                                  value={String(i)}
                                  className="rounded-lg py-2.5 pl-3 pr-8 text-foreground focus:bg-muted"
                                >
                                  <span className="font-medium">
                                    {tier.tokensPerMonth >= 1000
                                      ? `${(tier.tokensPerMonth / 1000).toFixed(tier.tokensPerMonth % 1000 === 0 ? 0 : 1)}k`
                                      : tier.tokensPerMonth.toLocaleString()}{" "}
                                    credits /mo
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {tierPrice.price}{tierPrice.period}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "rounded-xl px-4 py-3",
                          recommended ? "bg-primary-foreground/10" : "bg-muted/60"
                        )}
                      >
                        <p className={cn("text-[12.5px]", recommended ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          <span className={cn("font-semibold", recommended ? "text-primary-foreground" : "text-foreground")}>
                            {plan.tokensPerMonth.toLocaleString()}
                          </span>{" "}
                          credits / month
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={cn("mx-7 h-px", recommended ? "bg-primary-foreground/10" : "bg-border/60")} />

                  {/* Features */}
                  <div className="flex flex-1 flex-col gap-3 px-7 py-6">
                    {features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full",
                            recommended ? "bg-primary-foreground/15" : "bg-muted"
                          )}
                        >
                          <Check
                            className={cn(
                              "h-[8px] w-[8px]",
                              recommended ? "text-primary-foreground/85" : "text-foreground/70"
                            )}
                            strokeWidth={3}
                          />
                        </span>
                        <span
                          className={cn(
                            "text-[12.5px] leading-snug",
                            recommended ? "text-primary-foreground/75" : "text-muted-foreground"
                          )}
                        >
                          {normalizeFeatureCopy(feature)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="px-7 pb-7 pt-1">
                    {isFree ? (
                      <Link href="/projects" className="block w-full">
                        <Button
                          variant="outline"
                          className="h-11 w-full rounded-full border-border bg-transparent text-[13.5px] font-medium text-foreground hover:bg-muted"
                        >
                          Start building free
                        </Button>
                      </Link>
                    ) : hasPriceId ? (
                      <Button
                        disabled={!!checkoutLoading || authLoading}
                        className={cn(
                          "h-11 w-full rounded-full border-0 text-[13.5px] font-medium transition-all active:scale-[0.99]",
                          recommended
                            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                        onClick={() => handleSubscribe(effectivePriceId!, effectiveQuantity)}
                      >
                        {checkoutLoading === effectivePriceId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          `Subscribe to ${plan.name}`
                        )}
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className={cn(
                          "h-11 w-full rounded-full border-0 text-[13.5px] font-medium opacity-60",
                          recommended
                            ? "bg-primary-foreground text-primary"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        Subscribe to {plan.name}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Footer note ──────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">
            Prices in USD · Upgrade or downgrade at any time
          </p>
          <Link
            href="/help"
            className="text-[12px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Need help choosing? Visit Help &amp; Support →
          </Link>
        </div>

      </div>

      <FooterSection />
    </main>
  )
}