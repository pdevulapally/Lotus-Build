export type ProjectPlatform = "web" | "mobile"

export type OrchestratorTier = "starter" | "pro" | "team"

export interface PlatformOption {
  id: ProjectPlatform
  label: string
  keywords: readonly RegExp[]
}

export const PLATFORM_OPTIONS: readonly PlatformOption[] = [
  {
    id: "web",
    label: "Website",
    keywords: [
      /\bwebsite\b/i,
      /\bweb\s*app\b/i,
      /\blanding\s*page\b/i,
      /\bportfolio\b/i,
      /\bmarketing\s*site\b/i,
    ],
  },
  {
    id: "mobile",
    label: "Mobile app",
    keywords: [
      /\bmobile\b/i,
      /\bapp\b/i,
      /\bios\b/i,
      /\biphone\b/i,
      /\bandroid\b/i,
      /\breact\s*native\b/i,
      /\bexpo\b/i,
      /\bflutter\b/i,
    ],
  },
] as const

const PLATFORM_IDS = new Set<ProjectPlatform>(PLATFORM_OPTIONS.map((option) => option.id))

export function normalizePlatform(value: unknown): ProjectPlatform {
  return value === "mobile" ? "mobile" : "web"
}

export function inferPlatformFromPrompt(prompt: string): ProjectPlatform {
  const trimmed = prompt.trim()
  if (!trimmed) return "web"

  const scores = PLATFORM_OPTIONS.map((option) => ({
    id: option.id,
    score: option.keywords.reduce(
      (total, pattern) => total + (pattern.test(trimmed) ? 1 : 0),
      0,
    ),
  }))

  const best = scores.reduce((current, candidate) =>
    candidate.score > current.score ? candidate : current,
  )

  return best.score > 0 && PLATFORM_IDS.has(best.id) ? best.id : "web"
}

export function isProjectPlatform(value: unknown): value is ProjectPlatform {
  return value === "web" || value === "mobile"
}
