import type { Metadata } from "next"
import Link from "next/link"
import { FooterSection } from "@/components/sections/footer-section"
import { Navbar } from "@/components/ui/navbar"

export const metadata: Metadata = {
  title: "Teams | Lotus.build",
  description:
    "Shared Lotus workspaces for teams that need consistent product builds, previews, version history, and deployment handoff.",
}

const teamRows = [
  {
    title: "Shared workspace",
    description:
      "One place for the prompt, agent feed, generated files, preview, and follow-up edits. Teammates review the same working surface instead of passing screenshots around.",
  },
  {
    title: "Version history",
    description:
      "Restore earlier runs, compare progress, and keep experiments separate from the version the team wants to ship.",
  },
  {
    title: "Deployment handoff",
    description:
      "Keep GitHub sync, environment variables, Supabase setup, and deploy actions close to the generated project.",
  },
]

const workflowRows = [
  ["01", "Start from a real product request", "Define the app, audience, routes, integrations, and quality bar before generation starts."],
  ["02", "Review the generated surface", "Use the preview and feed together so design, product, and engineering can judge the same result."],
  ["03", "Keep edits grounded", "Follow-up requests apply to the current project context instead of creating disconnected one-off outputs."],
  ["04", "Prepare for handoff", "Sync code, add configuration, and move toward deploy when the workspace is ready."],
]

export default function TeamsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Teams</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                A shared computer workspace for product teams.
              </h1>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                Lotus keeps prompts, generated code, preview state, versions, and deploy work in one consistent UI so teams can review and ship without context drift.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Open workspace
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  View plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-[#f7f5ef] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-medium text-muted-foreground">What changes for teams</p>
              <h2 className="mt-3 max-w-sm text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
                Less handoff friction. More shared review.
              </h2>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {teamRows.map((row) => (
                <article key={row.title} className="grid gap-4 py-7 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{row.title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{row.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <h2 className="max-w-xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
              A team workflow that matches the product surface.
            </h2>
            <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
              The page uses the same calm structure as the rest of Lotus: clear rows, restrained type, and no fake quote wall.
            </p>
          </div>

          <div className="mt-12 divide-y divide-border border-y border-border">
            {workflowRows.map(([step, title, description]) => (
              <article key={step} className="grid gap-5 py-8 lg:grid-cols-[120px_minmax(0,0.7fr)_minmax(0,1fr)] lg:items-start">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">{step}</span>
                <h3 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-3xl">{title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 border-y border-border py-10 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ready for a shared run</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-5xl">
              Open the workspace with your team.
            </h2>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Start building
          </Link>
        </div>
      </section>

      <FooterSection />
    </main>
  )
}
