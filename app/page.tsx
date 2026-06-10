import { Navbar } from "@/components/ui/navbar"
import { CookieBanner } from "@/components/cookie-banner"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { CreateAfterLogin } from "@/components/create-after-login"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Blocks, ShieldCheck, Star, Gauge, ArrowRight, Quote } from "lucide-react"
import {
  lotusBuildFeatureItems,
  lotusBuildMetrics,
  lotusBuildTestimonials,
  lotusBuildUseCases,
} from "@/lib/lotus-build-site-content"

const featureIcons = [Star, Blocks, Gauge, ShieldCheck]

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      id={id}
      className={`relative px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </section>
  )
}

/* ─── Section heading ────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
      {children}
    </p>
  )
}

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <Navbar />

        {/* ── HERO — untouched ─────────────────────────────────────────────── */}
        <section className="relative isolate min-h-screen overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:px-8">
          <div
            className="absolute inset-0 -z-30 scale-105"
            style={{
              backgroundImage: "url('/Images/487c1040-cc7a-4bee-867e-84462280fe6e.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--primary)_72%,transparent),color-mix(in_oklch,var(--primary)_38%,transparent),color-mix(in_oklch,var(--primary)_84%,transparent))]" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_oklch,var(--primary-foreground)_26%,transparent),transparent_60%)]" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl items-center justify-center pb-20 text-center sm:pb-24">
            <div className="w-full">
              <h1 className="font-display text-5xl font-bold leading-[0.92] tracking-tight text-primary-foreground sm:text-6xl md:text-7xl lg:text-[5.5rem]">
                Describe your idea.
                <span className="mt-2 block text-primary-foreground/90">We build it.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg md:text-xl">
                Turn your ideas into full-stack web applications with AI.
                Just describe what you want to build and watch it come to life.
              </p>

              <div className="mx-auto mt-10 flex max-w-3xl justify-center">
                <AnimatedAIInput />
              </div>
            </div>
          </div>
        </section>

        {/* ── TAGLINE ──────────────────────────────────────────────────────── */}
        <Section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xl font-medium leading-snug tracking-tight text-foreground/70 sm:text-2xl md:text-3xl">
              The fastest way for founders to turn{" "}
              <span className="text-foreground">intent into a live website.</span>
            </p>
          </div>
        </Section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <Section id="features" className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center sm:mb-12">
              <SectionLabel>Features</SectionLabel>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Everything you need to ship
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/30 sm:grid-cols-2 lg:grid-cols-4">
              {lotusBuildFeatureItems.map((item, idx) => {
                const Icon = featureIcons[idx] ?? Star
                return (
                  <article
                    key={item.title}
                    className="group relative flex flex-col bg-card p-6 transition-colors duration-200 hover:bg-muted/60 sm:p-7"
                  >
                    {/* number */}
                    <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-muted text-foreground/30 transition-colors group-hover:border-border group-hover:text-foreground/60">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </Section>

        {/* ── METRICS ──────────────────────────────────────────────────────── */}
        <Section className="border-y border-border/50 bg-muted/40 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
              {lotusBuildMetrics.map((metric, i) => (
                <div key={metric.label} className="flex flex-col items-center gap-1">
                  <p className="font-display text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                    {metric.value}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── USE CASES ────────────────────────────────────────────────────── */}
        <Section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 sm:mb-12">
              <SectionLabel>Use cases</SectionLabel>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Built for every type of builder
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {lotusBuildUseCases.map((useCase, idx) => (
                <article
                  key={useCase.title}
                  className="group relative rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-border hover:shadow-sm"
                >
                  {/* index mark */}
                  <span className="absolute right-5 top-5 text-[11px] font-medium tabular-nums text-muted-foreground/30">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="pr-8 text-[15px] font-semibold leading-snug text-foreground">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {useCase.description}
                  </p>
                  {/* hover arrow */}
                  <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-muted-foreground/40 transition-all group-hover:text-foreground/60">
                    Learn more
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
        <Section
          id="testimonials"
          className="border-t border-border/50 bg-muted/30 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            {/* header */}
            <div className="mb-10 flex flex-col gap-1 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionLabel>Testimonials</SectionLabel>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Loved by builders
                </h2>
              </div>
            </div>

            {/* scrollable row */}
            <div
              className={`
                -mx-4 flex gap-3 overflow-x-auto px-4
                pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8
                [scrollbar-width:thin]
                [scrollbar-color:var(--border)_transparent]
                [&::-webkit-scrollbar]:h-[3px]
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb]:bg-border/60
              `}
            >
              {lotusBuildTestimonials.map((testimonial) => (
                <blockquote
                  key={testimonial.name}
                  className="flex w-[290px] shrink-0 flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-sm sm:w-[320px]"
                >
                  <div>
                    <Quote className="mb-3 h-4 w-4 text-muted-foreground/30" />
                    <p className="text-[13.5px] leading-relaxed text-foreground/75">
                      {testimonial.text}
                    </p>
                  </div>
                  <footer className="mt-5 flex items-center gap-2.5 border-t border-border/40 pt-4">
                    {/* avatar initials */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
                      {testimonial.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium leading-tight text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-[11.5px] leading-tight text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </Section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <Section className="py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Ready to build something?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Describe your idea below and we'll have a working prototype ready in minutes.
            </p>
            <div className="mx-auto mt-8 max-w-xl">
              <AnimatedAIInput />
            </div>
          </div>
        </Section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}