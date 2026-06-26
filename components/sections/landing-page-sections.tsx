import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import {
  CapabilityPills,
  Reveal,
  RevealItem,
  RevealStagger,
} from "@/components/sections/landing-reveal"
import { cn } from "@/lib/utils"
import {
  landingCapabilities,
  landingCodeLines,
  landingEditHint,
  landingEditResults,
  landingWorkflowSteps,
  landingWorkspaceLines,
} from "@/lib/landing-page-config"
import {
  lotusBuildFeatureItems,
  lotusBuildTestimonials,
  lotusBuildUseCases,
} from "@/lib/lotus-build-site-content"

const serif = {
  fontFamily: "'Instrument Serif', Georgia, serif",
  fontStyle: "italic" as const,
  fontWeight: 400,
}

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

function WorkspacePreviewMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[2rem] border border-border/55 bg-card/88 shadow-[0_36px_120px_-84px_var(--foreground)] backdrop-blur-2xl",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/60 bg-muted/35 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <span className="mx-auto truncate text-[11px] text-muted-foreground">
          workspace.lotus.build / finance-launch
        </span>
      </div>

      <div className="grid min-h-[500px] lg:grid-cols-[minmax(0,28%)_1fr]">
        <div className="flex flex-col border-b border-border/60 bg-secondary/55 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Agent</span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-foreground">
              Building
            </span>
          </div>

          <div className="space-y-2.5">
          {landingWorkspaceLines.map((line, index) => (
            <div
              key={`${line.role}-${index}`}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] leading-5",
                line.role === "you"
                  ? "ml-3 bg-card text-foreground shadow-sm"
                  : "mr-1 bg-muted/75 text-muted-foreground"
              )}
            >
              {line.text}
            </div>
          ))}
          </div>

          <div className="rounded-2xl border border-dashed border-border-strong/60 bg-card/60 px-3 py-2 text-[12px] text-foreground">
            {landingEditHint}
          </div>

          <div className="mt-auto rounded-2xl border border-border/60 bg-card/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Files touched
            </p>
            <div className="mt-3 space-y-1.5">
              {landingCodeLines.map((file) => (
                <div
                  key={file.name}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-2.5 py-2 text-[12px]",
                    file.active ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground"
                  )}
                >
                  <span>{file.name}</span>
                  {file.active ? <span className="text-background/65">open</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[color-mix(in_oklch,var(--background)_78%,var(--foreground)_22%)] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="truncate">localhost:3000</span>
            </div>
            <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success-soft-foreground shadow-sm">
              Running
            </span>
          </div>

          <div className="grid h-[430px] overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/92 shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
            <div className="flex min-h-0 flex-col border-b border-border/60 bg-foreground text-background lg:border-b-0 lg:border-r lg:border-background/10">
              <div className="flex items-center gap-1 border-b border-background/10 px-3 py-2 text-[11px] text-background/58">
                {landingCodeLines.map((file) => (
                  <span
                    key={file.name}
                    className={cn(
                      "rounded-lg px-2 py-1",
                      file.active ? "bg-background/10 text-background" : "text-background/50"
                    )}
                  >
                    {file.name}
                  </span>
                ))}
              </div>
              <pre className="min-h-0 flex-1 overflow-hidden p-4 text-[11px] leading-5 text-background/76">
                <code>{`export default function Page() {
  return (
    <main className="launch-page">
      <section className="hero">
        <p>Finance app</p>
        <h1>Launch with a premium first impression.</h1>
        <button>Join waitlist</button>
      </section>
      <Pricing />
      <Onboarding />
    </main>
  )
}`}</code>
              </pre>
              <div className="border-t border-background/10 px-4 py-3 text-[11px] text-background/58">
                Preview synced after edit
              </div>
            </div>

            <div className="relative overflow-hidden bg-background p-4">
              <div className="absolute inset-x-0 top-0 h-20 bg-secondary/55" aria-hidden />
              <div className="relative mx-auto flex h-full max-w-sm flex-col rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-[12px] font-semibold text-foreground">Finance app</span>
                  <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">
                    Preview
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Launch page
                  </p>
                  <h4 className="mt-4 text-3xl font-medium leading-[1.02] tracking-[-0.05em] text-foreground">
                    Premium finance onboarding, ready to refine.
                  </h4>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    A mobile-first hero, pricing surface, and onboarding flow generated from the original prompt.
                  </p>
                  <div className="mt-auto grid gap-2">
                    {landingWorkflowSteps.slice(1, 4).map((step) => (
                      <div
                        key={step.step}
                        className="flex items-center justify-between rounded-xl border border-border bg-muted/55 px-3 py-2 text-[12px]"
                      >
                        <span className="font-medium text-foreground">{step.title}</span>
                        <span className="text-muted-foreground">{step.step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CodePanelMini() {
  return (
    <div className="mt-auto rounded-2xl border border-border/60 bg-muted/55 p-3">
      {landingCodeLines.map((file) => (
        <div
          key={file.name}
          className={cn(
            "rounded-lg px-2 py-1.5 text-[11px]",
            file.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {file.name}
        </div>
      ))}
    </div>
  )
}

function EditPanelMini() {
  return (
    <div className="mt-auto space-y-2 rounded-2xl border border-background/12 bg-background/8 p-3">
      {landingEditResults.map((result) => (
        <div key={result} className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-background">{result}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-background/70" />
        </div>
      ))}
    </div>
  )
}

export function LandingProductSection() {
  return (
    <>
      <Section className="relative overflow-hidden border-t border-border bg-background pt-20 sm:pt-28">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
            <p className="text-sm font-medium text-muted-foreground">The workspace</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
              Prompt, preview, and refine in{" "}
              <span style={serif}>one place</span>.
            </h2>
            </div>
            <div className="lg:justify-self-end">
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Lotus is built for the moment after the idea — when you need a real surface fast,
              and you need to keep shaping it without starting over.
            </p>
            <div className="mt-7">
              <CapabilityPills items={landingCapabilities} />
            </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section bleed className="bg-background pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Reveal delay={0.08}>
          <div className="mx-auto max-w-[72rem] px-4 sm:px-6 lg:px-8">
            <WorkspacePreviewMock />
          </div>
        </Reveal>

        <div className="mx-auto mt-16 max-w-6xl">
          <RevealStagger className="grid gap-0 border-y border-border/70 sm:grid-cols-2 lg:grid-cols-4">
            {landingWorkflowSteps.map((item) => (
              <RevealItem key={item.step}>
                <article className="group h-full border-border/70 py-6 transition duration-300 sm:px-5 sm:odd:border-r lg:border-r lg:last:border-r-0">
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {item.step}
                  </p>
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
  const [lead, second, third, fourth] = lotusBuildFeatureItems

  return (
    <Section id="features" className="border-t border-border bg-foreground py-20 text-background sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <h2 className="max-w-xl text-3xl font-medium tracking-[-0.04em] text-background sm:text-4xl lg:text-5xl">
            Everything you need to ship the first version.
          </h2>
          <p className="max-w-md text-sm leading-7 text-background/62 lg:pb-1">
            Not a pile of disconnected tools — a single flow from generation to live preview to
            production-ready code.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
        {lead ? (
          <Reveal delay={0.05} className="lg:col-span-2 lg:row-span-2">
            <article className="flex h-full min-h-[390px] flex-col rounded-[1.75rem] border border-background/12 bg-background p-7 text-foreground shadow-[0_30px_100px_-72px_rgba(0,0,0,0.7)] sm:p-9">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Core flow
              </p>
              <h3 className="mt-5 max-w-md text-3xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-4xl">
                {lead.title}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
                {lead.description}
              </p>
              <CodePanelMini />
            </article>
          </Reveal>
        ) : null}

        {[second, third, fourth].filter(Boolean).map((item, index) => (
          <Reveal key={item!.title} delay={0.1 + index * 0.05}>
            <article className="flex h-full min-h-[190px] flex-col rounded-[1.5rem] border border-background/12 bg-background/8 p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-background/12 sm:p-7">
              <h3 className="text-lg font-medium tracking-[-0.02em] text-background">
                {item!.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-background/62">
                {item!.description}
              </p>
              {index === 0 ? <EditPanelMini /> : null}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}

export function LandingUseCasesSection() {
  const [featured, ...others] = lotusBuildUseCases

  return (
    <Section id="use-cases" className="border-t border-border bg-background py-20 sm:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
          Start from where you are.
        </h2>
      </Reveal>

      {featured ? (
        <Reveal delay={0.06}>
          <article className="mt-12 overflow-hidden rounded-[2rem] border border-border/60 bg-card/86 shadow-[0_30px_100px_-82px_var(--foreground)] backdrop-blur-xl transition duration-300 hover:border-border-strong">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-border/60 p-7 sm:p-9 lg:border-b-0 lg:border-r">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Most common
                </p>
                <h3 className="mt-4 text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
                  {featured.title}
                </h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
                  {featured.description}
                </p>
              </div>
              <div className="flex items-end bg-secondary/45 p-7 sm:p-9">
                <div className="w-full rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-[12px] font-semibold text-foreground">
                      Workspace flow
                    </span>
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-soft-foreground">
                      Live
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {landingWorkflowSteps.slice(0, 3).map((step) => (
                      <div
                        key={step.step}
                        className="rounded-xl border border-border bg-muted/55 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{step.title}</span>
                          <span className="text-[11px] text-muted-foreground">{step.step}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </Reveal>
      ) : null}

      <RevealStagger className="mt-4 grid gap-4 sm:grid-cols-2">
        {others.map((useCase) => (
          <RevealItem key={useCase.title}>
            <article className="group flex h-full flex-col rounded-[1.5rem] border border-border/60 bg-card/78 p-6 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-border-strong sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-medium tracking-[-0.03em] text-foreground">
                  {useCase.title}
                </h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </div>
              <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                {useCase.description}
              </p>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </Section>
  )
}

export function LandingTestimonialsSection() {
  const [featured, ...rest] = lotusBuildTestimonials

  return (
    <Section id="testimonials" className="border-t border-border bg-secondary/30 py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <h2 className="max-w-sm text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
            Trusted by builders who care about the first version.
          </h2>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            Less context switching. More momentum from idea to something you&apos;d actually show.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
        {featured ? (
          <Reveal delay={0.05}>
            <blockquote className="flex h-full flex-col justify-between rounded-[2rem] bg-foreground p-8 text-background shadow-[0_30px_100px_-80px_var(--foreground)] sm:p-10 lg:min-h-[360px]">
              <p className="max-w-2xl text-2xl font-medium leading-snug tracking-[-0.03em] sm:text-4xl">
                &ldquo;{featured.text}&rdquo;
              </p>
              <footer className="mt-10 border-t border-background/15 pt-5 text-sm">
                <p className="font-medium">{featured.name}</p>
                <p className="mt-1 text-background/65">{featured.role}</p>
              </footer>
            </blockquote>
          </Reveal>
        ) : null}

        <RevealStagger className="space-y-4">
          {rest.slice(0, 2).map((testimonial) => (
            <RevealItem key={testimonial.name}>
              <blockquote className="rounded-[1.5rem] border border-border/60 bg-card/82 p-6 shadow-sm backdrop-blur-xl sm:p-7">
                <p className="text-sm leading-7 text-foreground">&ldquo;{testimonial.text}&rdquo;</p>
                <footer className="mt-5 text-sm">
                  <p className="font-medium text-foreground">{testimonial.name}</p>
                  <p className="mt-1 text-muted-foreground">{testimonial.role}</p>
                </footer>
              </blockquote>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </Section>
  )
}

export function LandingClosingSection() {
  return (
    <Section className="border-t border-border bg-background pb-24 pt-16 sm:pb-32 sm:pt-20">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-8 rounded-[2rem] border border-border/60 bg-card/86 p-8 shadow-[0_28px_90px_-76px_var(--foreground)] backdrop-blur-xl sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground sm:text-3xl">
              Start from the hero. Build from there.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
              Your prompt already lives at the top of the page — scroll up, describe what you
              want, and Lotus opens the workspace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
            >
              Open workspace
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
