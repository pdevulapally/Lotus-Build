import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Eye,
  GitBranch,
  Layers,
  Play,
  Sparkles,
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

const agentMessages = [
  {
    speaker: "You",
    text: "Build a fintech launch page with pricing, onboarding, and a sharper hero.",
  },
  {
    speaker: "Lotus",
    text: "I’ll update the visual system, generate the missing sections, then run the preview.",
  },
]

const planSteps = [
  { label: "Plan routes", state: "done" },
  { label: "Write components", state: "active" },
  { label: "Validate imports", state: "queued" },
]

const fileTree = [
  { name: "src/App.tsx", active: true },
  { name: "src/components/Pricing.tsx", active: false },
  { name: "src/components/Onboarding.tsx", active: false },
  { name: "src/index.css", active: false },
]

const codeTabs = ["App.tsx", "Pricing.tsx", "index.css"]

const codeSample = `export default function App() {
  return (
    <SiteShell>
      <Hero intent="fintech" />
      <ProofStrip />
      <PricingTable />
      <OnboardingFlow />
    </SiteShell>
  )
}`

const workflow = [
  {
    step: "01",
    title: "Describe the product",
    description: "Start with the outcome, audience, style, and any product constraints. Lotus turns that into a build plan instead of guessing from a thin prompt.",
  },
  {
    step: "02",
    title: "Watch the workspace form",
    description: "The agent writes files, keeps the preview alive, and shows what changed so you can judge the product instead of reading raw logs.",
  },
  {
    step: "03",
    title: "Edit like an IDE, not a chatbot",
    description: "Ask for changes, select visual context, repair build errors, and keep the project moving without resetting the whole page.",
  },
  {
    step: "04",
    title: "Ship from the same surface",
    description: "Connect the repo, push the result, and move toward deployment once the first version is sharp enough to share.",
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

const buildModes = [
  {
    title: "New product surfaces",
    description: "Landing pages, SaaS flows, onboarding, dashboards, and product shells that need a credible first version fast.",
  },
  {
    title: "Iteration on existing code",
    description: "Change sections, add routes, clean layout problems, or keep refining the same generated project after the first pass.",
  },
  {
    title: "Repair and hardening",
    description: "Use compiler errors, preview logs, and validation feedback to get broken output back into a buildable state.",
  },
]

const signalRows = [
  { label: "Context kept", value: "Files + prompt + preview" },
  { label: "Review surface", value: "Live browser, not screenshots" },
  { label: "Handoff", value: "Code, branch, deployment path" },
]

const terminalEvents = [
  "validated package.json dependencies",
  "normalized generated files",
  "started preview on port 3000",
  "captured runtime error context",
  "ready for follow-up edit",
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
        "overflow-hidden rounded-[1.35rem] border border-border/70 bg-[#0b0b0a] text-background shadow-[0_42px_140px_-96px_var(--foreground)]",
        className
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-background/10 bg-background/[0.035] px-4 text-[11px] text-background/52">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
          </div>
          <span className="hidden text-background/70 sm:inline">Lotus Computer</span>
          <span className="truncate rounded-full border border-background/10 bg-background/[0.055] px-2.5 py-1">
            fintech-launch / main
          </span>
        </div>
        <div className="hidden items-center gap-1 rounded-full border border-background/10 bg-background/[0.055] p-1 sm:flex">
          {['Preview', 'Browser', 'Research'].map((tab, index) => (
            <span
              key={tab}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px]",
                index === 0 ? "bg-background text-foreground" : "text-background/48"
              )}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[308px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-background/10 bg-[#11110f] p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-background/38">
            <span>Agent</span>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
              building
            </span>
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

          <div className="mt-5 rounded-2xl border border-background/10 bg-background/[0.045] p-3">
            <div className="flex items-center gap-2 text-[12px] text-background/72">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Run plan</span>
            </div>
            <div className="mt-3 space-y-2">
              {planSteps.map((step) => (
                <div key={step.label} className="flex items-center justify-between gap-3 text-[11px] text-background/58">
                  <span>{step.label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      step.state === "done" && "bg-emerald-300",
                      step.state === "active" && "bg-background animate-pulse",
                      step.state === "queued" && "bg-background/25"
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-background/10 bg-black/25 p-3">
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
                  {file.active ? <span className="text-foreground/45">open</span> : null}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid min-h-0 lg:grid-rows-[minmax(0,1fr)_168px]">
          <div className="grid min-h-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
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
              <pre className="h-[260px] overflow-hidden p-5 text-[12px] leading-6 text-background/68 sm:h-[330px] lg:h-[410px]">
                <code>{codeSample}</code>
              </pre>
            </div>

            <div className="bg-[#f4f2eb] p-4 text-foreground sm:p-5">
              <div className="mb-3 flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground">/</span>
                <span className="min-w-0 flex-1 truncate">localhost:3000/pricing</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Live</span>
              </div>

              <div className="flex h-[410px] flex-col overflow-hidden rounded-[1.1rem] border border-border bg-background shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Finpilot</span>
                    <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] text-background">
                      Join waitlist
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col px-5 py-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Generated preview
                  </p>
                  <h3 className="mt-5 text-4xl font-medium leading-[0.95] tracking-[-0.055em] text-foreground">
                    Finance onboarding that feels ready to fund.
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    A composed hero, pricing logic, and early product narrative generated from one brief.
                  </p>
                  <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-4">
                    {[
                      ["12", "screens"],
                      ["4", "flows"],
                      ["0", "errors"],
                    ].map(([value, label]) => (
                      <div key={label}>
                        <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid border-t border-background/10 bg-background/[0.03] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] text-background/38">
                <span>Timeline</span>
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
                <p><span className="text-emerald-300">✓</span> npm install completed</p>
                <p><span className="text-emerald-300">✓</span> vite ready on :3000</p>
                <p><span className="text-background/40">›</span> waiting for edits</p>
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
              <p className="text-sm font-medium text-muted-foreground">The workspace</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                A coding agent with a live product surface attached.
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                Inspired by the speed of Bolt and the focus of Cursor, Lotus keeps prompt, code, logs, and preview in one continuous build loop.
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
          <div className="mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
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
            <p className="text-sm font-medium text-muted-foreground">Build modes</p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
              Start fast without losing the thread.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            Use Lotus when you want the speed of generation, but still need a place to inspect the result like a product engineer.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-12 divide-y divide-border/70 border-y border-border/70">
        {buildModes.map((mode, index) => (
          <RevealItem key={mode.title}>
            <article className="group grid gap-5 py-8 transition duration-300 lg:grid-cols-[120px_minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                0{index + 1}
              </span>
              <h3 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-3xl">
                {mode.title}
              </h3>
              <div className="flex items-start justify-between gap-5">
                <p className="max-w-xl text-sm leading-7 text-muted-foreground">{mode.description}</p>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
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
