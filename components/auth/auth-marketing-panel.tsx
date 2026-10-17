import { History, Code2, ListChecks } from "lucide-react"
import { LotusLogo } from "@/components/ui/lotus-logo"

const features = [
  {
    icon: ListChecks,
    label: "Plan your approach before implementing changes",
  },
  {
    icon: Code2,
    label: "Read your saved source files in the workspace",
  },
  {
    icon: History,
    label: "Review saved versions and compare changes",
  },
]

export function AuthMarketingPanel() {
  return (
    <div className="hidden max-w-md flex-1 lg:block">
      <LotusLogo size={40} />
      <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-foreground xl:text-5xl">
        Keep your software work moving.
      </h1>
      <p className="mt-4 text-base leading-7 text-muted-foreground">
        Describe the software you want to build. Plan the approach, implement
        changes, and review your saved work in one workspace.
      </p>

      <ul className="mt-8 space-y-4 border-t border-border pt-8">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="lotus-glass-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-foreground">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm text-foreground/85">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
