// Client-safe: no server imports. Single source of truth for plan-based rate limits.
// Pricing page and the server-side rate limiter both derive from this file.

export type PlanTier = "anonymous" | "free" | "pro" | "team"

const HOUR = 60 * 60 * 1000
const DAY  = 24 * HOUR
const MIN  = 60 * 1000

// Limits scale with each plan's token allowance:
//   Free = 10k tokens  (baseline)
//   Pro  = 120k tokens (12× free)
//   Team = 500k tokens (50× free, ~4× pro)
export const SCOPE_LIMITS: Record<string, Record<PlanTier, { limit: number; windowMs: number }>> = {
  session: {
    anonymous: { limit: 2,   windowMs: HOUR },
    free:      { limit: 10,  windowMs: HOUR },
    pro:       { limit: 40,  windowMs: HOUR },
    team:      { limit: 120, windowMs: HOUR },
  },
  deploy: {
    anonymous: { limit: 1,   windowMs: DAY  },
    free:      { limit: 3,   windowMs: DAY  },
    pro:       { limit: 15,  windowMs: DAY  },
    team:      { limit: 60,  windowMs: DAY  },
  },
  sync: {
    anonymous: { limit: 2,   windowMs: HOUR },
    free:      { limit: 5,   windowMs: HOUR },
    pro:       { limit: 20,  windowMs: HOUR },
    team:      { limit: 60,  windowMs: HOUR },
  },
  migration: {
    anonymous: { limit: 2,   windowMs: HOUR },
    free:      { limit: 5,   windowMs: HOUR },
    pro:       { limit: 30,  windowMs: HOUR },
    team:      { limit: 100, windowMs: HOUR },
  },
  provision: {
    anonymous: { limit: 1,   windowMs: HOUR },
    free:      { limit: 3,   windowMs: HOUR },
    pro:       { limit: 10,  windowMs: HOUR },
    team:      { limit: 40,  windowMs: HOUR },
  },
  restore: {
    anonymous: { limit: 2,   windowMs: HOUR },
    free:      { limit: 5,   windowMs: HOUR },
    pro:       { limit: 20,  windowMs: HOUR },
    team:      { limit: 60,  windowMs: HOUR },
  },
  workspace: {
    anonymous: { limit: 1,   windowMs: DAY  },
    free:      { limit: 3,   windowMs: DAY  },
    pro:       { limit: 20,  windowMs: DAY  },
    team:      { limit: 100, windowMs: DAY  },
  },
  referral: {
    anonymous: { limit: 1,   windowMs: DAY  },
    free:      { limit: 3,   windowMs: DAY  },
    pro:       { limit: 3,   windowMs: DAY  },
    team:      { limit: 3,   windowMs: DAY  },
  },
  default: {
    anonymous: { limit: 20,  windowMs: MIN  },
    free:      { limit: 30,  windowMs: MIN  },
    pro:       { limit: 60,  windowMs: MIN  },
    team:      { limit: 120, windowMs: MIN  },
  },
}

function fmt(limit: number, windowMs: number): string {
  return `${limit}/${windowMs >= DAY ? "day" : windowMs >= HOUR ? "hr" : "min"}`
}

const DISPLAY_SCOPES = ["session", "deploy", "sync", "migration", "provision"] as const
const SCOPE_LABELS: Record<typeof DISPLAY_SCOPES[number], string> = {
  session:   "AI builds",
  deploy:    "Deployments",
  sync:      "GitHub syncs",
  migration: "DB migrations",
  provision: "Supabase setup",
}

export const PLAN_RATE_LIMIT_TABLE = DISPLAY_SCOPES.map((scope) => {
  const s = SCOPE_LIMITS[scope]
  return {
    label:     SCOPE_LABELS[scope],
    free:      fmt(s.free.limit,      s.free.windowMs),
    pro:       fmt(s.pro.limit,       s.pro.windowMs),
    team:      fmt(s.team.limit,      s.team.windowMs),
  }
})
