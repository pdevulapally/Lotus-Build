/**
 * Shared plan display config and fallbacks.
 * Used by the /pricing page for consistent, dynamic pricing UI.
 */
import type { UserPlan } from "@/lib/firebase"

/**
 * CANONICAL plan config — the single source of truth for plan name, price,
 * interval, priceId, tokensPerMonth, and features. Consumed by the metering
 * ledger, Stripe webhook, Stripe plans catalog, refresh-token-period, and
 * auth-context bootstrap/display. There is no other override layer — the
 * Firestore `plans/{planId}` collection and the `enterprise` plan tier were
 * both retired; see the plan-config audit for history.
 */
export interface CanonicalPlanConfig {
  id: UserPlan
  name: string
  price: number
  interval: string
  priceId: string | null
  tokensPerMonth: number
  features: string[]
}

export const PLAN_CONFIG: Record<UserPlan, CanonicalPlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: "forever",
    priceId: null,
    tokensPerMonth: 10000,
    features: [
      "10,000 credits/month",
      "Single personal workspace",
      "Community support",
      "Public projects",
      "Export to GitHub",
      "Deploy to Netlify or Vercel",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9900,
    interval: "month",
    priceId: null,
    tokensPerMonth: 120000,
    features: ["120,000 credits/month", "Create and switch workspaces", "Premium templates + visual edit", "Priority support"],
  },
  team: {
    id: "team",
    name: "Agency",
    price: 29900,
    interval: "month",
    priceId: null,
    tokensPerMonth: 500000,
    features: ["500,000 credits/month", "Create and switch workspaces", "Client handoff + white-label", "Priority support"],
  },
}

export type PlanId = "free" | "pro" | "team"

export interface PlanDisplayConfig {
  description: string
  recommended?: boolean
  features: string[]
}

export const PLAN_DISPLAY: Record<PlanId, PlanDisplayConfig> = {
  free: {
    description: "Perfect for trying Lotus.build before going live.",
    features: PLAN_CONFIG.free.features,
  },
  pro: {
    description: "For founders shipping production sites with AI speed.",
    recommended: true,
    features: [
      "120,000 credits/month",
      "Create and switch workspaces",
      "Premium templates + visual edit",
      "Priority support",
    ],
  },
  team: {
    description: "Agency-grade scale for teams shipping many client sites.",
    features: [
      "500,000 credits/month",
      "Create and switch workspaces",
      "Client handoff + white-label",
      "Priority support",
    ],
  },
}

export interface PlanForApi {
  id: string
  name: string
  price: number
  interval: string
  priceId: string | null
  tokensPerMonth: number
  features: string[]
}

/** Credit/token tier for paid plans; user selects one and pricing updates. */
export interface PlanTier {
  tokensPerMonth: number
  priceCents: number
  priceId: string | null
  quantity: number
}

/**
 * Get tiers for a paid plan based purely on live Stripe/plan data.
 * For now, each paid plan exposes a single tier that matches its
 * configured tokensPerMonth and price. If you add additional Stripe
 * prices per plan in the API, you can extend this to return multiple
 * tiers per plan.
 */
export function getPaidPlanTiers(plan: PlanForApi): PlanTier[] {
  const baseTokens = Math.max(1, plan.tokensPerMonth || 1)
  const basePrice = Math.max(0, plan.price || 0)

  const multipliers =
    baseTokens >= 500000
      ? [1, 2, 3, 4]
      : [1, 2, 3, 4, 6]

  return multipliers.map((quantity) => ({
    tokensPerMonth: baseTokens * quantity,
    priceCents: basePrice * quantity,
    priceId: plan.priceId,
    quantity,
  }))
}

/** Default plans when API returns empty or fails. */
export const DEFAULT_PLANS_FALLBACK: PlanForApi[] = [
  {
    id: "free",
    name: PLAN_CONFIG.free.name,
    price: 0,
    interval: "forever",
    priceId: null,
    tokensPerMonth: 10000,
    features: PLAN_DISPLAY.free.features,
  },
  {
    id: "pro",
    name: "Pro",
    price: 9900,
    interval: "month",
    priceId: null,
    tokensPerMonth: 120000,
    features: PLAN_DISPLAY.pro.features,
  },
  {
    id: "team",
    name: "Agency",
    price: 29900,
    interval: "month",
    priceId: null,
    tokensPerMonth: 500000,
    features: PLAN_DISPLAY.team.features,
  },
]

/** Normalize API plan id to PlanId for display config lookup. */
export function planIdForDisplay(id: string): PlanId {
  const lower = id.toLowerCase()
  if (lower === "free" || lower === "hobby" || lower === "starter") return "free"
  if (lower === "team" || lower === "business" || lower === "elite") return "team"
  return "pro"
}
