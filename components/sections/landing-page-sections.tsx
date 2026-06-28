import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  Eye,
  GitBranch,
  Globe,
  History,
  KeyRound,
  Layers,
  MessageSquare,
  Monitor,
  PanelLeft,
  Play,
  Terminal,
  Zap,
} from "lucide-react"

import {
  CapabilityPills,
  Reveal,
  RevealItem,
  RevealStagger,
} from "@/components/sections/landing-reveal"
import { cn } from "@/lib/utils"

const capabilityPills = ["Prompt to repo", "Live preview", "Visual edits", "Deploy-ready"]

const feedMessages = [
  {
    role: "user",
    text: "Build a customer onboarding dashboard with pricing, account setup, and a clean preview.",
  },
  {
    role: "assistant",
    text: "I updated the app shell, added the dashboard route, and restarted the preview. I am checking the generated files now.",
  },
]

const timelineRows = [
  { title: "Understanding request", detail: "Dashboard, pricing, onboarding" },
  { title: "Generating app/dashboard/page.tsx", detail: "Writing product surface" },
  { title: "Preview ready", detail: "localhost:3000/dashboard" },
]

const workspaceTabs = ["Preview", "Browser", "Research"]

const generatedFiles = [
  "app/dashboard/page.tsx",
  "components/app-shell.tsx",
  "components/pricing-table.tsx",
  "lib/plans.ts",
]

const workflow = [
  {
    step: "01",
    title: "Prompt the computer",
    description: "Describe the app, routes, integrations, and style. Lotus turns it into a visible build plan before editing files.",
  },
  {
    step: "02",
    title: "Watch the run",
    description: "The feed shows planning, file edits, questions, preview state, and repair actions in the same place as the real workspace.",
  },
  {
    step: "03",
    title: "Inspect the preview",
    description: "Review the generated product in the workspace panel, switch tabs, reload the preview, and catch runtime issues quickly.",
  },
  {
    step: "04",
    title: "Continue from context",
    description: "Follow-up edits apply to the same project instead of starting over, so iteration feels closer to an IDE session.",
  },
]

const featureRows = [
  {
    icon: Terminal,
    label: "Agent runtime",
    title: "Generation stays close to the working tree.",
    description: "The builder plans, writes, verifies, and repairs inside one project context so follow-up requests land on the existing code instead of starting from scratch.",
    detail: "Files, preview, logs, and fixes stay in the same run.",
  },
  {
    icon: Eye,
    label: "Preview first",
    title: "Every change is judged as a live product surface.",
    description: "The preview is not a decoration. It is the main review loop, with responsive viewing, reloads, runtime errors, and repair actions close at hand.",
    detail: "See the app as users will see it, then refine directly.",
  },
  {
    icon: GitBranch,
    label: "Production path",
    title: "Move from exploration to a real branch.",
    description: "Lotus is built for real projects: generated files, integrations, GitHub sync, environment variables, and deployment handoff all sit behind the workspace.",
    detail: "Prototype speed without throwing away the code path.",
  },
]

const demoUseCases = [
  {
    title: "SaaS launch workspace",
    prompt: "Build a launch page, pricing, onboarding checklist, and authenticated dashboard shell.",
    output: "Routes, app shell, pricing table, onboarding states, preview URL.",
  },
  {
    title: "Internal operations tool",
    prompt: "Create a CRM workspace with lead filters, account details, notes, import status, and empty states.",
    output: "Table layout, filter controls, detail pane, sample data, export action.",
  },
  {
    title: "AI document review app",
    prompt: "Make a document review flow with upload, analysis queue, results, and export panel.",
    output: "Upload route, queue UI, review cards, status handling, preview checks.",
  },
  {
    title: "Preview repair run",
    prompt: "Fix the unresolved import and restart the preview without adding unsupported dependencies.",
    output: "Import repair, dependency validation, clean runtime log, refreshed preview.",
  },
]

const terminalEvents = [
  "dependency allowlist passed",
  "generated files normalized",
  "preview booted on port 3000",
  "runtime errors cleared",
  "ready for next edit",
]

function Section({
  id,
  children,
  className = "",
  bleed = false,
}: {
  id?: string
  children: React.ReactNode
  className?: string
  bleed?: boolean
}) {
  return (
    <section id={id} className={cn("px-4 sm:px-6 lg:px-8", className)}>
      <div className={cn(!bleed && "mx-auto max-w-6xl")}>{children}</div>
    </section>
  )
}

function StaticComputerShell({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-[760px] flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-background text-foreground shadow-[0_42px_140px_-96px_var(--foreground)]",
        className
      )}
    >
      <header className="lotus-glass relative z-30 shrink-0">
        <div className="relative flex h-[52px] w-full items-center">
          <div className="flex h-full min-w-0 shrink-0 items-center gap-1 px-3 sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px]">
            <button
              type="button"
              aria-label="Open sidebar"
              className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/55 transition-all duration-150 hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              className="group -mx-1 hidden w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/60 sm:flex"
              aria-label="Session menu"
            >
              <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                Customer onboarding dashboard
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/35" />
            </button>
          </div>

          <div className="hidden h-full min-w-0 flex-1 items-center justify-center px-3 sm:flex">
            <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 text-[11px] text-muted-foreground">
              {workspaceTabs.map((tab, index) => (
                <span
                  key={tab}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    index === 0 ? "bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>

          <div className="ml-auto hidden h-full items-center gap-2 px-3 text-[13px] sm:flex">
            <button className="hidden h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-flex">
              <KeyRound className="h-3.5 w-3.5" />
              Integrations
            </button>
            <button className="hidden h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-flex">
              <History className="h-3.5 w-3.5" />
              History
            </button>
            <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 font-semibold text-background transition hover:bg-foreground/85">
              <Globe className="h-3.5 w-3.5" />
              Deploy
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        <div className="flex w-full shrink-0 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_76%,transparent)] backdrop-blur-2xl sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="chat-scrollbar flex h-full flex-col overflow-y-auto px-4 lg:px-5">
              <div className="flex-1 pt-4" />
              <div className="space-y-4 pb-4">
                {feedMessages.map((message) => (
                  <div key={message.text} className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {message.role === "user" ? "You" : "Lotus"}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/82">{message.text}</p>
                  </div>
                ))}

                <div className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                  <p className="text-[12px] font-semibold text-foreground">Run timeline</p>
                  <div className="mt-3 space-y-3">
                    {timelineRows.map((row, index) => (
                      <div key={row.title} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[12px]">
                        <span className={cn(
                          "mt-1.5 h-2 w-2 rounded-full",
                          index < 2 ? "bg-foreground" : "bg-success"
                        )} />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{row.title}</span>
                          <span className="block truncate text-muted-foreground">{row.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                  <p className="text-[12px] font-semibold text-foreground">Generated files</p>
                  <div className="mt-2 space-y-1.5">
                    {generatedFiles.map((file, index) => (
                      <div key={file} className={cn(
                        "rounded-lg px-2.5 py-2 text-[12px]",
                        index === 0 ? "bg-muted text-foreground" : "text-muted-foreground"
                      )}>
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-3 pb-3 pt-2 lg:px-4">
            <div className="lotus-glass-control rounded-2xl border border-border/60 p-2 shadow-sm">
              <div className="min-h-[58px] rounded-xl px-3 py-2 text-[13px] text-muted-foreground">
                Message the agent...
              </div>
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] text-muted-foreground">Ask for a change or fix</span>
                <span className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background">Send</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lotus-glass-strong m-2 hidden min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 shadow-[0_28px_90px_-64px_rgba(0,0,0,0.9)] sm:flex">
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_88%,transparent)]">
              <div className="lotus-glass-inset flex h-10 shrink-0 items-center justify-center border-b border-border/40 px-4">
                <div className="lotus-glass-control group flex w-full max-w-sm items-center gap-0.5 overflow-hidden rounded-full border border-border/60 px-1">
                  <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70" aria-label="Go to root">
                    <span className="text-[13px]">/</span>
                  </button>
                  <span className="max-w-[130px] shrink truncate select-none text-[11px] text-foreground/50">
                    localhost:3000
                  </span>
                  <div className="flex min-w-[40px] flex-1 items-center">
                    <span className="shrink-0 select-none text-[12px] text-foreground/40">/</span>
                    <span className="min-w-0 flex-1 truncate py-0.5 text-[12px] text-foreground">dashboard</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden bg-background p-3 lg:p-4">
                <div className="h-full overflow-hidden rounded-xl border border-border/60 bg-card">
                  <div className="flex h-full flex-col bg-background">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">AcmeDesk</p>
                        <p className="text-[11px] text-muted-foreground">Generated preview</p>
                      </div>
                      <span className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">Invite team</span>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-[156px_minmax(0,1fr)]">
                      <aside className="border-r border-border bg-muted/35 p-3">
                        {['Overview', 'Customers', 'Billing', 'Settings'].map((item, index) => (
                          <div key={item} className={cn(
                            "mb-1 rounded-lg px-2.5 py-2 text-[12px]",
                            index === 0 ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground"
                          )}>
                            {item}
                          </div>
                        ))}
                      </aside>
                      <main className="min-w-0 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overview</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground">Customer onboarding</h3>
                          </div>
                          <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">Preview ready</span>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          {[
                            ["482", "active users"],
                            ["31", "trial accounts"],
                            ["0", "build errors"],
                          ].map(([value, label]) => (
                            <div key={label} className="rounded-xl border border-border bg-muted/25 p-3">
                              <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
                              <p className="text-[11px] text-muted-foreground">{label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 rounded-xl border border-border">
                          {['Design onboarding checklist', 'Add pricing comparison', 'Wire settings form'].map((item, index) => (
                            <div key={item} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0">
                              <span className="text-[12px] text-foreground">{item}</span>
                              <span className="text-[11px] text-muted-foreground">{index === 0 ? "done" : "queued"}</span>
                            </div>
                          ))}
                        </div>
                      </main>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Switch between chat and preview"
        className="lotus-glass-strong absolute inset-x-3 bottom-3 z-20 mx-auto max-w-xs rounded-xl border border-border/50 px-1 py-1 shadow-[0_22px_70px_-42px_rgba(0,0,0,0.9)] sm:hidden"
      >
        <div className="grid grid-cols-2 gap-1">
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground text-[12.5px] font-medium text-background">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Chat
          </span>
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium text-muted-foreground">
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </span>
        </div>
      </nav>
    </div>
  )
}

function TerminalLog() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-background/10 bg-black/35 font-mono text-[12px] text-background/65">
      <div className="flex items-center justify-between border-b border-background/10 px-4 py-3 text-[11px] text-background/42">
        <span>runtime.log</span>
        <span>clean</span>
      </div>
      <div className="space-y-2 p-4">
        {terminalEvents.map((event) => (
          <div key={event} className="flex items-center gap-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>{event}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingProductSection() {
  return (
    <>
      <Section className="relative overflow-hidden border-t border-border bg-[#f7f5ef] pt-20 sm:pt-28">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">The computer workspace</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                The landing demo should look like the product.
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                This section mirrors the actual computer page: the same top bar, chat panel, workspace panel, preview URL bar, and mobile switcher pattern.
              </p>
              <div className="mt-7">
                <CapabilityPills items={capabilityPills} />
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section bleed className="bg-[#f7f5ef] pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Reveal delay={0.08}>
          <div className="mx-auto max-w-[82rem] px-4 sm:px-6 lg:px-8">
            <StaticComputerShell />
          </div>
        </Reveal>

        <div className="mx-auto mt-14 max-w-6xl">
          <RevealStagger className="grid border-y border-border/70 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => (
              <RevealItem key={item.step}>
                <article className="group h-full border-border/70 py-7 transition duration-300 sm:px-5 sm:odd:border-r lg:border-r lg:last:border-r-0">
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">{item.step}</p>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </Section>
    </>
  )
}

export function LandingFeaturesSection() {
  return (
    <Section id="features" className="border-t border-border bg-[#10100f] py-20 text-background sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            Less magic show. More working system.
          </h2>
          <p className="max-w-md text-sm leading-7 text-background/62 lg:justify-self-end">
            The middle of the product is built around feedback loops: write, preview, inspect, repair, and keep moving.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 divide-y divide-background/10 border-y border-background/10">
        {featureRows.map((item, index) => {
          const Icon = item.icon
          return (
            <Reveal key={item.title} delay={index * 0.05}>
              <article className="grid gap-6 py-9 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:items-center">
                <div className="flex items-center gap-3 text-sm text-background/52">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-background/12 bg-background/6 text-background">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{item.label}</span>
                </div>
                <div>
                  <h3 className="max-w-2xl text-2xl font-medium leading-tight tracking-[-0.035em] text-background sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-background/58">{item.description}</p>
                </div>
                <p className="rounded-2xl border border-background/10 bg-background/[0.045] p-4 text-sm leading-6 text-background/64">
                  {item.detail}
                </p>
              </article>
            </Reveal>
          )
        })}
      </div>

      <Reveal delay={0.16} className="mt-12">
        <TerminalLog />
      </Reveal>
    </Section>
  )
}

export function LandingUseCasesSection() {
  return (
    <Section id="use-cases" className="border-t border-border bg-background py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Demo use cases</p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
              Real prompts, real workspace outcomes.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            These are the kinds of runs that should feel natural inside the computer page, without dressing them up as fake product claims.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-12 divide-y divide-border/70 border-y border-border/70">
        {demoUseCases.map((useCase, index) => (
          <RevealItem key={useCase.title}>
            <article className="grid gap-5 py-8 lg:grid-cols-[120px_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">0{index + 1}</span>
              <h3 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-3xl">
                {useCase.title}
              </h3>
              <p className="text-sm leading-7 text-foreground/78">{useCase.prompt}</p>
              <p className="text-sm leading-7 text-muted-foreground">{useCase.output}</p>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </Section>
  )
}

export function LandingTestimonialsSection() {
  return (
    <Section id="testimonials" className="border-t border-border bg-[#efebe1] py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <h2 className="max-w-md text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
            Proof should look like the product working.
          </h2>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            No fake quote wall. The useful signal is whether the builder can keep context, recover from errors, and hand you code you can continue with.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal delay={0.05}>
          <div className="h-full rounded-[1.5rem] bg-[#10100f] p-6 text-background sm:p-8">
            <div className="flex items-center justify-between border-b border-background/10 pb-4 text-[12px] text-background/50">
              <span>session health</span>
              <span>last run</span>
            </div>
            <div className="mt-7 grid gap-6 sm:grid-cols-3">
              {[
                ["1", "workspace"],
                ["4", "validation gates"],
                ["0", "fake dependencies allowed"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-5xl font-medium tracking-[-0.06em] text-background">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-background/52">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-background/10 bg-background/[0.045] p-4">
              {[
                "Generate files",
                "Validate imports",
                "Start preview",
                "Repair from logs",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-background/8 py-3 last:border-b-0">
                  <span className="text-sm text-background/72">{item}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: Code2, title: "Code remains inspectable", text: "Generated files stay visible as project artifacts, not hidden behind a one-off prompt result." },
              { icon: Layers, title: "Preview drives quality", text: "The live surface is where layout, responsiveness, runtime errors, and polish are judged." },
              { icon: Zap, title: "Follow-ups stay grounded", text: "Edits are applied against the current project state, so iteration feels like an IDE session." },
            ].map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="rounded-[1.25rem] border border-border/70 bg-background/75 p-5">
                  <Icon className="h-4 w-4 text-foreground" />
                  <h3 className="mt-4 text-lg font-medium tracking-[-0.02em] text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              )
            })}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

export function LandingClosingSection() {
  return (
    <Section className="border-t border-border bg-background pb-24 pt-16 sm:pb-32 sm:pt-20">
      <Reveal>
        <div className="grid gap-8 border-y border-border/70 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ready when the idea is</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-5xl">
              Open the workspace. Keep the preview honest.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Start from the prompt in the hero, then use Lotus like a focused AI IDE for the first working version.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/projects"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
            >
              Open workspace
              <Play className="h-4 w-4 fill-current" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
