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
  landingPreviewBlocks,
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
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-48px_rgba(0,0,0,0.18)]",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <span className="mx-auto truncate text-[11px] text-muted-foreground">
          workspace.lotus.build / finance-launch
        </span>
      </div>

      <div className="grid min-h-[360px] lg:grid-cols-[minmax(0,32%)_1fr]">
        <div className="space-y-2.5 border-b border-border bg-sidebar p-4 lg:border-b-0 lg:border-r">
          {landingWorkspaceLines.map((line, index) => (
            <div
              key={`${line.role}-${index}`}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] leading-5",
                line.role === "you"
                  ? "ml-3 bg-card text-foreground shadow-sm"
                  : "mr-1 bg-muted/80 text-muted-foreground"
              )}
            >
              {line.text}
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-primary/25 bg-accent-soft/30 px-3 py-2 text-[12px] text-accent-soft-foreground">
            {landingEditHint}
          </div>
        </div>

        <div className="bg-secondary/40 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Live preview</span>
            <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success-soft-foreground">
              Running
            </span>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            {landingPreviewBlocks.map((block, index) => (
              <div
                key={index}
                className={cn("rounded-lg bg-muted/90", block.width, block.height)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CodePanelMini() {
  return (
    <div className="mt-auto rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3">
      {landingCodeLines.map((file) => (
        <div
          key={file.name}
          className={cn(
            "rounded-lg px-2 py-1.5 text-[11px]",
            file.active ? "bg-primary-foreground/15 text-primary-foreground" : "text-primary-foreground/50"
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
    <div className="mt-auto space-y-2 rounded-xl border border-border bg-background p-3">
      {landingEditResults.map((result) => (
        <div key={result} className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-foreground">{result}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
      ))}
    </div>
  )
}

export function LandingProductSection() {
  return (
    <>
      <Section className="border-t border-border pt-20 sm:pt-28">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium text-primary">The workspace</p>
            <h2 className="mt-4 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
              Prompt, preview, and refine in{" "}
              <span style={serif}>one place</span>.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
              Lotus is built for the moment after the idea — when you need a real surface fast,
              and you need to keep shaping it without starting over.
            </p>
            <div className="mt-8 flex justify-center">
              <CapabilityPills items={landingCapabilities} />
            </div>
          </div>
        </Reveal>
      </Section>

      <Section bleed className="pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Reveal delay={0.08}>
          <div className="mx-auto max-w-[72rem] px-4 sm:px-6 lg:px-8">
            <WorkspacePreviewMock />
          </div>
        </Reveal>

        <div className="mx-auto mt-16 max-w-6xl">
          <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {landingWorkflowSteps.map((item) => (
              <RevealItem key={item.step}>
                <article className="group h-full rounded-2xl border border-border bg-card p-5 transition duration-300 hover:border-border-strong hover:shadow-sm">
                  <p className="text-xs font-semibold tabular-nums text-primary">{item.step}</p>
                  <h3 className="mt-3 text-base font-medium text-foreground">{item.title}</h3>
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
    <Section id="features" className="border-t border-border bg-secondary/20 py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <h2 className="max-w-xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
            Everything you need to ship the first version.
          </h2>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:pb-1">
            Not a pile of disconnected tools — a single flow from generation to live preview to
            production-ready code.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
        {lead ? (
          <Reveal delay={0.05} className="lg:col-span-2 lg:row-span-2">
            <article className="flex h-full min-h-[360px] flex-col rounded-2xl bg-primary p-7 text-primary-foreground sm:p-9">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground/55">
                Core flow
              </p>
              <h3 className="mt-5 max-w-md text-3xl font-medium leading-[1.02] tracking-[-0.04em] sm:text-4xl">
                {lead.title}
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-primary-foreground/75">
                {lead.description}
              </p>
              <CodePanelMini />
            </article>
          </Reveal>
        ) : null}

        {[second, third, fourth].filter(Boolean).map((item, index) => (
          <Reveal key={item!.title} delay={0.1 + index * 0.05}>
            <article className="flex h-full min-h-[180px] flex-col rounded-2xl border border-border bg-card p-6 transition duration-300 hover:border-border-strong hover:shadow-sm sm:p-7">
              <h3 className="text-lg font-medium tracking-[-0.02em] text-foreground">
                {item!.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
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
    <Section id="use-cases" className="border-t border-border py-20 sm:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
          Start from where you are.
        </h2>
      </Reveal>

      {featured ? (
        <Reveal delay={0.06}>
          <article className="mt-12 overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:border-border-strong hover:shadow-sm">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b border-border p-7 sm:p-9 lg:border-b-0 lg:border-r">
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
              <div className="flex items-end bg-secondary/35 p-7 sm:p-9">
                <div className="w-full rounded-xl border border-border bg-card p-4">
                  <p className="text-[11px] text-muted-foreground">Included in one session</p>
                  <ul className="mt-3 space-y-2 text-sm font-medium text-foreground">
                    <li>Homepage</li>
                    <li>Pricing</li>
                    <li>Onboarding flow</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </Reveal>
      ) : null}

      <RevealStagger className="mt-4 grid gap-4 sm:grid-cols-2">
        {others.map((useCase) => (
          <RevealItem key={useCase.title}>
            <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-300 hover:border-border-strong hover:shadow-sm sm:p-7">
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
    <Section id="testimonials" className="border-t border-border bg-secondary/15 py-20 sm:py-28">
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

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {featured ? (
          <Reveal delay={0.05}>
            <blockquote className="flex h-full flex-col justify-between rounded-2xl bg-primary p-8 text-primary-foreground sm:p-10">
              <p className="text-2xl font-medium leading-snug tracking-[-0.03em] sm:text-3xl">
                &ldquo;{featured.text}&rdquo;
              </p>
              <footer className="mt-10 border-t border-primary-foreground/15 pt-5 text-sm">
                <p className="font-medium">{featured.name}</p>
                <p className="mt-1 text-primary-foreground/65">{featured.role}</p>
              </footer>
            </blockquote>
          </Reveal>
        ) : null}

        <RevealStagger className="space-y-4">
          {rest.slice(0, 2).map((testimonial) => (
            <RevealItem key={testimonial.name}>
              <blockquote className="rounded-2xl border border-border bg-card p-6 sm:p-7">
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
    <Section className="border-t border-border pb-24 pt-16 sm:pb-32 sm:pt-20">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:p-10">
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
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Open workspace
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
