import { LotusLogo } from "@/components/ui/lotus-logo"

const features = [
  {
    title: "Plan before you build.",
    description: "Plan your approach before implementing changes.",
  },
  {
    title: "Stay close to your code.",
    description: "Read your saved source files in the workspace.",
  },
  {
    title: "See what changed.",
    description: "Review saved versions and compare what changed.",
  },
]

export function AuthMarketingPanel() {
  return (
    <aside className="hidden max-w-lg py-4 lg:block" aria-labelledby="auth-workspace-title">
      <div className="flex items-center gap-3 text-muted-foreground">
        <LotusLogo size={28} className="text-foreground" />
        <span className="site-eyebrow">From idea to software</span>
      </div>
      <h2 id="auth-workspace-title" className="mt-8 text-balance text-5xl font-semibold leading-[1.08] tracking-[-0.055em] text-foreground xl:text-6xl">
        Build what you<br />have in mind.
      </h2>
      <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
        Describe the software you want to build. Plan the approach, make changes and review your saved work in one place.
      </p>

      <ul className="mt-12 max-w-sm divide-y divide-border border-y border-border">
        {features.map(({ title, description }, index) => (
          <li key={title} className="flex gap-5 py-5">
            <span className="pt-0.5 text-xs font-medium tabular-nums text-muted-foreground" aria-hidden>
              0{index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
