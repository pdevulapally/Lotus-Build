import { NextRequest } from "next/server"
import Stripe from "stripe"
import { PLAN_CONFIG } from "@/lib/plans"

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

export const dynamic = "force-dynamic"

const DEFAULT_PAID_PLANS = {
  pro: {
    name: PLAN_CONFIG.pro.name,
    priceCents: PLAN_CONFIG.pro.price,
    interval: PLAN_CONFIG.pro.interval as Stripe.PriceCreateParams.Recurring.Interval,
    tokensPerMonth: PLAN_CONFIG.pro.tokensPerMonth,
    features: PLAN_CONFIG.pro.features,
  },
  team: {
    name: PLAN_CONFIG.team.name,
    priceCents: PLAN_CONFIG.team.price,
    interval: PLAN_CONFIG.team.interval as Stripe.PriceCreateParams.Recurring.Interval,
    tokensPerMonth: PLAN_CONFIG.team.tokensPerMonth,
    features: PLAN_CONFIG.team.features,
  },
}

type PlanRow = {
  id: string
  name: string
  price: number
  interval: string
  priceId: string | null
  tokensPerMonth: number
  features: string[]
}

/** Ensure a paid plan exists in Stripe (create product + price if missing); returns priceId. */
async function ensurePlanPrice(
  s: Stripe,
  planId: "pro" | "team"
): Promise<string> {
  const config = DEFAULT_PAID_PLANS[planId]
  const prices = await s.prices.list({
    active: true,
    type: "recurring",
    expand: ["data.product"],
  })
  for (const p of prices.data) {
    const product = p.product as Stripe.Product
    if (typeof product === "string" || !product) continue
    const meta = (p as Stripe.Price & { metadata?: Record<string, string> }).metadata || {}
    const name = (product.name || "").toLowerCase()
    const planIdFromMeta = meta.plan_id?.toLowerCase()
    const matches = planIdFromMeta === planId || (planId === "pro" && name.includes("pro")) || (planId === "team" && name.includes("team"))
    if (matches) return p.id
  }
  const product = await s.products.create({
    name: config.name,
    metadata: { plan_id: planId, tokens_per_month: String(config.tokensPerMonth) },
  })
  const price = await s.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: config.priceCents,
    recurring: { interval: config.interval },
    metadata: { plan_id: planId, tokens_per_month: String(config.tokensPerMonth) },
  })
  return price.id
}

export async function GET(req: NextRequest) {
  if (!stripe) {
    return Response.json({
      plans: [
        { id: "free", name: PLAN_CONFIG.free.name, price: PLAN_CONFIG.free.price, interval: PLAN_CONFIG.free.interval, priceId: null, tokensPerMonth: PLAN_CONFIG.free.tokensPerMonth, features: PLAN_CONFIG.free.features },
        { id: "pro", name: DEFAULT_PAID_PLANS.pro.name, price: DEFAULT_PAID_PLANS.pro.priceCents, interval: DEFAULT_PAID_PLANS.pro.interval, priceId: null, tokensPerMonth: DEFAULT_PAID_PLANS.pro.tokensPerMonth, features: DEFAULT_PAID_PLANS.pro.features },
        { id: "team", name: DEFAULT_PAID_PLANS.team.name, price: DEFAULT_PAID_PLANS.team.priceCents, interval: DEFAULT_PAID_PLANS.team.interval, priceId: null, tokensPerMonth: DEFAULT_PAID_PLANS.team.tokensPerMonth, features: DEFAULT_PAID_PLANS.team.features },
      ],
    })
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
    })

    const plans: PlanRow[] = [
      {
        id: "free",
        name: PLAN_CONFIG.free.name,
        price: PLAN_CONFIG.free.price,
        interval: PLAN_CONFIG.free.interval,
        priceId: null,
        tokensPerMonth: PLAN_CONFIG.free.tokensPerMonth,
        features: PLAN_CONFIG.free.features,
      },
    ]

    for (const p of prices.data) {
      const product = p.product as Stripe.Product
      if (typeof product === "string" || !product) continue
      const meta = (p as Stripe.Price & { metadata?: Record<string, string> }).metadata || {}
      const name = (product.name || p.nickname || "Plan").trim()
      const planId = meta.plan_id?.toLowerCase() || (name.toLowerCase().includes("pro") ? "pro" : name.toLowerCase().includes("team") ? "team" : "pro")
      const tokensPerMonth = meta.tokens_per_month
        ? parseInt(meta.tokens_per_month, 10)
        : planId === "team" ? PLAN_CONFIG.team.tokensPerMonth : PLAN_CONFIG.pro.tokensPerMonth
      const amount = p.unit_amount ?? 0
      plans.push({
        id: planId,
        name,
        price: amount,
        interval: p.recurring?.interval === "year" ? "year" : "month",
        priceId: p.id,
        tokensPerMonth,
        features: product.metadata?.features ? (typeof product.metadata.features === "string" ? product.metadata.features.split(",").map((s) => s.trim()) : []) : [`${tokensPerMonth.toLocaleString()} tokens/month`],
      })
    }

    const hasPro = plans.some((pl) => pl.id === "pro")
    const hasTeam = plans.some((pl) => pl.id === "team")

    if (!hasPro) {
      const priceIdPro = await ensurePlanPrice(stripe, "pro")
      const config = DEFAULT_PAID_PLANS.pro
      plans.push({
        id: "pro",
        name: config.name,
        price: config.priceCents,
        interval: config.interval,
        priceId: priceIdPro,
        tokensPerMonth: config.tokensPerMonth,
        features: config.features,
      })
    }
    if (!hasTeam) {
      const priceIdTeam = await ensurePlanPrice(stripe, "team")
      const config = DEFAULT_PAID_PLANS.team
      plans.push({
        id: "team",
        name: config.name,
        price: config.priceCents,
        interval: config.interval,
        priceId: priceIdTeam,
        tokensPerMonth: config.tokensPerMonth,
        features: config.features,
      })
    }

    return Response.json({ plans })
  } catch (err) {
    console.error("[Stripe plans]", err)
    return Response.json({
      plans: [
        { id: "free", name: PLAN_CONFIG.free.name, price: PLAN_CONFIG.free.price, interval: PLAN_CONFIG.free.interval, priceId: null, tokensPerMonth: PLAN_CONFIG.free.tokensPerMonth, features: PLAN_CONFIG.free.features },
        { id: "pro", name: DEFAULT_PAID_PLANS.pro.name, price: DEFAULT_PAID_PLANS.pro.priceCents, interval: DEFAULT_PAID_PLANS.pro.interval, priceId: null, tokensPerMonth: DEFAULT_PAID_PLANS.pro.tokensPerMonth, features: DEFAULT_PAID_PLANS.pro.features },
        { id: "team", name: DEFAULT_PAID_PLANS.team.name, price: DEFAULT_PAID_PLANS.team.priceCents, interval: DEFAULT_PAID_PLANS.team.interval, priceId: null, tokensPerMonth: DEFAULT_PAID_PLANS.team.tokensPerMonth, features: DEFAULT_PAID_PLANS.team.features },
      ],
    })
  }
}
