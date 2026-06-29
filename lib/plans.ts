/**
 * Shared plan display config and fallbacks.
 * Used by the /pricing page for consistent, dynamic pricing UI.
 */

import { TEAM_MINIMUM_SEATS } from "@/lib/team-workspace"

export type PlanId = "free" | "pro" | "team"

export interface PlanDisplayConfig {
  description: string
  recommended?: boolean
  features: string[]
}

export const PLAN_DISPLAY: Record<PlanId, PlanDisplayConfig> = {
  free: {
    description: "Perfect for trying Lotus Build before going live.",
    features: [
      "10,000 credits/month",
      "Single personal workspace",
      "Community support",
      "Public projects",
      "Export to GitHub",
    ],
  },
  pro: {
    description: "For founders shipping production apps with AI speed.",
    recommended: true,
    features: [
      "120,000 credits/month",
      "Create and switch workspaces",
      "Premium templates + visual edit",
      "Priority support",
    ],
  },
  team: {
    description: "A shared AI engineering workspace for teams building Lotus projects together.",
    features: [
      `${TEAM_MINIMUM_SEATS}+ seats with centralized billing`,
      "Shared team workspaces and projects",
      "Member roles, permissions, and admin controls",
      "Workspace knowledge, AI rules, and approval mode",
      "Audit logs, usage analytics, and GitHub review flows",
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
 * Team plans are seat based and always enforce the workspace minimum.
 */
export function getPaidPlanTiers(plan: PlanForApi): PlanTier[] {
  const baseTokens = Math.max(1, plan.tokensPerMonth || 1)
  const basePrice = Math.max(0, plan.price || 0)
  const planId = plan.id.toLowerCase()

  const multipliers =
    planId === "team" || planId === "business"
      ? [TEAM_MINIMUM_SEATS, 3, 4, 5, 10]
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
    name: "Starter",
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
    name: "Team",
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
  if (lower === "team" || lower === "business" || lower === "elite" || lower === "agency") return "team"
  return "pro"
}
