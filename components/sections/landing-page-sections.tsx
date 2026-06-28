import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Database,
  Eye,
  FileCode2,
  GitBranch,
  Globe2,
  History,
  KeyRound,
  Layers,
  LayoutPanelLeft,
  Monitor,
  Pencil,
  Play,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Terminal,
  Wrench,
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

const agentMessages = [
  {
    speaker: "You",
    text: "Create a B2B onboarding app with auth, pricing, a dashboard, and a clean product tour.",
  },
  {
    speaker: "Lotus",
    text: "I found the required routes, added the UI shell, connected the preview, and I am checking the generated imports now.",
  },
]

const runEvents = [
  { icon: Search, title: "Understanding request", detail: "Routes, audience, integrations" },
  { icon: FileCode2, title: "Writing files", detail: "12 files changed" },
  { icon: Monitor, title: "Preview ready", detail: "localhost:3000/dashboard" },
]

const workspaceTabs = ["Preview", "Browser", "Research"]

const feedItems = [
  { label: "Plan", value: "Create dashboard shell and pricing route", state: "done" },
  { label: "Edit", value: "Update components/AppShell.tsx", state: "active" },
  { label: "Check", value: "Validate imports before preview", state: "queued" },
]

const fileTree = [
  { name: "app/dashboard/page.tsx", active: true },
  { name: "components/app-shell.tsx", active: false },
  { name: "components/pricing-table.tsx", active: false },
  { name: "lib/plans.ts", active: false },
]

const codeTabs = ["page.tsx", "app-shell.tsx", "pricing-table.tsx"]

const codeSample = `export default function DashboardPage() {
  return (
    <AppShell>
      <MetricGrid />
      <OnboardingChecklist />
      <ActivityTimeline />
      <DeployPanel />
    </AppShell>
  )
}`

const workflow = [
  {
    step: "01",
    title: "Prompt the computer",
    description: "Describe the app, audience, routes, integrations, and style. Lotus turns it into a visible build plan before editing files.",
  },
  {
    step: "02",
    title: "Watch the run",
    description: "The left feed shows reasoning, tool calls, file edits, questions, fixes, and preview state like the real computer workspace.",
  },
  {
    step: "03",
    title: "Inspect the product",
    description: "Use the workspace tabs to review preview, browser research, runtime errors, and deployment state in one surface.",
  },
  {
    step: "04",
    title: "Keep iterating",
    description: "Ask follow-ups against the same project context, repair failures, connect services, and push toward a real deploy.",
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
    label: "SaaS launch",
    title: "Marketing site plus app shell",
    prompt: "Build a launch page, pricing table, auth-ready dashboard, and onboarding checklist for a sales tool.",
    output: "Hero, pricing, dashboard route, settings screen, deploy notes",
  },
  {
    label: "Internal tool",
    title: "Operations dashboard",
    prompt: "Create a CRM-style workspace with lead filters, account detail pages, notes, and import status.",
    output: "Tables, filters, detail pane, empty states, mocked data layer",
  },
  {
    label: "AI product",
    title: "Document review app",
    prompt: "Make an AI document reviewer with upload flow, analysis queue, results view, and export panel.",
    output: "Upload UI, job timeline, review cards, export actions",
  },
  {
    label: "Repair run",
    title: "Fix a broken preview",
    prompt: "The preview fails with an unresolved import. Fix the app without adding unsupported packages.",
    output: "Dependency check, import repair, preview restart, clean logs",
  },
]

const signalRows = [
  { label: "Context", value: "Prompt, files, preview" },
  { label: "Tabs", value: "Preview, browser, research" },
  { label: "Actions", value: "Deploy, history, integrations" },
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

function WorkspaceSurface({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-border/70 bg-[#090908] text-background shadow-[0_42px_140px_-96px_var(--foreground)]",
        className
      )}
    >
      <div className="flex h-13 min-h-13 items-center justify-between border-b border-background/10 bg-[#141412] px-3 text-[11px] text-background/52 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button className="hidden h-8 w-8 items-center justify-center rounded-lg text-background/55 transition hover:bg-background/10 sm:flex" aria-label="Collapse chat panel">
            <LayoutPanelLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[12px] font-medium text-background/85">Customer onboarding build</span>
              <span className="hidden rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 sm:inline-flex">
                Building
              </span>
            </div>
            <p className="hidden truncate text-[10px] text-background/36 sm:block">computer / b2b-onboarding / main</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full border border-background/10 bg-background/[0.055] px-2.5 py-1 text-background/54">Pro plan</span>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-background/60 transition hover:bg-background/10" aria-label="Version history">
            <History className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-background/60 transition hover:bg-background/10" aria-label="Share project">
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-full bg-background px-3 text-[11px] font-semibold text-foreground">
            <Rocket className="h-3.5 w-3.5" />
            Deploy
          </button>
        </div>
      </div>

      <div className="grid min-h-[680px] lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-background/10 bg-[#11110f] lg:border-b-0 lg:border-r">
          <div className="border-b border-background/10 p-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-background/38">
              <span>Agent feed</span>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">live</span>
            </div>
            <div className="mt-4 space-y-3">
              {agentMessages.map((message, index) => (
                <div
                  key={message.text}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-[12px] leading-5",
                    index === 0
                      ? "border-background/12 bg-background/10 text-background"
                      : "border-background/8 bg-background/[0.045] text-background/68"
                  )}
                >
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-background/36">
                    {message.speaker}
                  </span>
                  {message.text}
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="rounded-2xl border border-background/10 bg-background/[0.045] p-3">
              <div className="flex items-center gap-2 text-[12px] text-background/72">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Run timeline</span>
              </div>
              <div className="mt-3 space-y-3">
                {runEvents.map((event, index) => {
                  const Icon = event.icon
                  return (
                    <div key={event.title} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-[11px]">
                      <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-lg border",
                        index === 1
                          ? "border-background/20 bg-background text-foreground"
                          : "border-background/10 bg-background/[0.055] text-background/54"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-background/76">{event.title}</span>
                        <span className="block truncate text-background/40">{event.detail}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-background/10 bg-black/25 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-background/34">Files touched</div>
              <div className="space-y-1.5">
                {fileTree.map((file) => (
                  <div
                    key={file.name}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px]",
                      file.active ? "bg-background text-foreground" : "bg-background/[0.055] text-background/48"
                    )}
                  >
                    <span className="truncate">{file.name}</span>
                    {file.active ? <Pencil className="h-3 w-3 text-foreground/45" /> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-background/10 bg-background/[0.045] p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-background/34">Next actions</div>
              <div className="grid gap-2">
                {[
                  { icon: Database, label: "Connect Supabase" },
                  { icon: KeyRound, label: "Add env variables" },
                  { icon: GitBranch, label: "Sync GitHub" },
                ].map((action) => {
                  const Icon = action.icon
                  return (
                    <div key={action.label} className="flex items-center gap-2 rounded-lg bg-background/[0.055] px-2.5 py-2 text-[11px] text-background/56">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{action.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_170px] bg-[#0d0d0c]">
          <div className="flex min-h-12 items-center justify-between border-b border-background/10 bg-[#151513] px-3">
            <div className="flex min-w-0 items-center gap-1 rounded-full border border-background/10 bg-background/[0.055] p-1">
              {workspaceTabs.map((tab, index) => (
                <span
                  key={tab}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px]",
                    index === 0 ? "bg-background text-foreground" : "text-background/48"
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="hidden items-center gap-2 text-[11px] text-background/40 sm:flex">
              <Globe2 className="h-3.5 w-3.5" />
              <span>preview.lotus.local</span>
            </div>
          </div>

          <div className="grid min-h-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
            <div className="min-h-0 border-b border-background/10 lg:border-b-0 lg:border-r">
              <div className="flex h-10 items-center gap-1 border-b border-background/10 px-3 text-[11px]">
                {codeTabs.map((tab, index) => (
                  <span
                    key={tab}
                    className={cn(
                      "rounded-lg px-2.5 py-1",
                      index === 0 ? "bg-background/10 text-background" : "text-background/42"
                    )}
                  >
                    {tab}
                  </span>
                ))}
              </div>
              <pre className="h-[260px] overflow-hidden p-5 text-[12px] leading-6 text-background/68 sm:h-[330px] lg:h-[430px]">
                <code>{codeSample}</code>
              </pre>
            </div>

            <div className="bg-[#f3f1e8] p-4 text-foreground sm:p-5">
              <div className="mb-3 flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground">/</span>
                <span className="min-w-0 flex-1 truncate">localhost:3000/dashboard</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Live</span>
              </div>

              <div className="flex h-[430px] flex-col overflow-hidden rounded-[1.1rem] border border-border bg-background shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <span className="block text-[12px] font-semibold">AcmeDesk</span>
                    <span className="block text-[10px] text-muted-foreground">Generated preview</span>
                  </div>
                  <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] text-background">Invite team</span>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-[148px_minmax(0,1fr)]">
                  <div className="border-r border-border bg-muted/35 p-3">
                    {['Overview', 'Customers', 'Billing', 'Settings'].map((item, index) => (
                      <div key={item} className={cn(
                        "mb-1 rounded-lg px-2.5 py-2 text-[11px]",
                        index === 0 ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground"
                      )}>
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace dashboard</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
                    <div className="mt-4 rounded-xl border border-border">
                      {['Design onboarding checklist', 'Add pricing comparison', 'Wire settings form'].map((item, index) => (
                        <div key={item} className="flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0">
                          <span className="text-[12px] text-foreground">{item}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            index === 0 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                          )}>
                            {index === 0 ? "done" : "queued"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl bg-foreground p-4 text-background">
                      <p className="text-[11px] text-background/60">Next deploy target</p>
                      <p className="mt-1 text-lg font-medium tracking-[-0.03em]">Push dashboard to Vercel after review</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid border-t border-background/10 bg-background/[0.03] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] text-background/38">
                <span>Computer state</span>
                <span>validating output</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {signalRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-background/8 bg-background/[0.045] p-3">
                    <p className="text-[11px] text-background/38">{row.label}</p>
                    <p className="mt-1 text-[12px] font-medium text-background/78">{row.value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                  <p className="text-[11px] text-emerald-100/70">Status</p>
                  <p className="mt-1 text-[12px] font-medium text-emerald-100">Preview ready</p>
                </div>
              </div>
            </div>
            <div className="border-t border-background/10 p-4 lg:border-l lg:border-t-0">
              <div className="font-mono text-[11px] leading-5 text-background/54">
                <p className="text-background/34">terminal</p>
                <p><span className="text-emerald-300">ok</span> npm install completed</p>
                <p><span className="text-emerald-300">ok</span> vite ready on :3000</p>
                <p><span className="text-background/40">run</span> waiting for edits</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
                The same Lotus computer your project opens into.
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                The landing demo now mirrors the real computer page: agent feed, file edits, preview tabs, deployment actions, and integration prompts in one workspace.
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
          <div className="mx-auto max-w-[80rem] px-4 sm:px-6 lg:px-8">
            <WorkspaceSurface />
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
              Show the computer doing real product work.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            Each demo starts from a realistic prompt and ends with visible product artifacts: routes, components, preview state, and the next deploy step.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 lg:grid-cols-2">
        {demoUseCases.map((useCase, index) => (
          <RevealItem key={useCase.title}>
            <article className="group grid h-full gap-5 border border-border/70 bg-background p-5 transition duration-300 hover:border-foreground/30 sm:grid-cols-[132px_minmax(0,1fr)] sm:p-6">
              <div>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">0{index + 1}</span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{useCase.label}</p>
              </div>
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-3xl">
                    {useCase.title}
                  </h3>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prompt</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/78">{useCase.prompt}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Computer output</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{useCase.output}</p>
                  </div>
                </div>
              </div>
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
