import { Navbar } from "@/components/ui/navbar"
import { CookieBanner } from "@/components/cookie-banner"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { CreateAfterLogin } from "@/components/create-after-login"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { ColorfulBentoGrid } from "@/components/ui/colorful-bento-grid"
import { ArrowRight } from "lucide-react"
import {
  lotusBuildTestimonials,
  lotusBuildUseCases,
} from "@/lib/lotus-build-site-content"

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4"

const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"

const WORKSPACE_FLOW_STEPS = ["Prompt", "Preview", "Edits", "Launch"] as const
const WHY_LOTUS_POINTS = [
  "Prompt without losing context",
  "Preview the product as it changes",
  "Refine without starting over",
] as const

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
  const featuredUseCase = lotusBuildUseCases[0]
  const secondaryUseCases = lotusBuildUseCases.slice(1)

  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <Navbar />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="min-h-screen w-full bg-background p-3 font-sans sm:p-4">
          <div className="relative h-[calc(100vh-24px)] w-full overflow-hidden rounded-2xl bg-secondary sm:h-[calc(100vh-32px)] sm:rounded-3xl">
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_45%]"
              src={HERO_VIDEO_URL}
              poster={HERO_VIDEO_POSTER}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              disableRemotePlayback
              webkit-playsinline="true"
              x5-playsinline="true"
            />

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 pb-20 pt-20 text-center sm:pb-24 sm:pt-24">
              <h1
                className="max-w-4xl text-foreground"
                style={{
                  fontSize: "clamp(32px, 7vw, 72px)",
                  lineHeight: 1.05,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                Shaping{" "}
                <span
                  style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                  }}
                >
                  builders
                </span>
                <br />
                of tomorrow
              </h1>

              <p
                className="mt-4 max-w-xl px-2 text-muted-foreground sm:mt-6 sm:max-w-2xl"
                style={{ fontSize: "clamp(13px, 3vw, 16px)" }}
              >
                The AI workspace for turning ideas into production-ready websites, apps, live previews, and deployable code.
              </p>

              <div className="mx-auto mt-7 w-full max-w-2xl sm:mt-10 sm:max-w-3xl">
                <AnimatedAIInput />
              </div>
            </div>
          </div>
        </section>

        {/* ── TAGLINE ──────────────────────────────────────────────────────── */}
        <Section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-5 rounded-[2.25rem] bg-secondary/55 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:p-8">
              <div className="flex min-h-[300px] flex-col justify-between rounded-[1.75rem] bg-card p-6 sm:min-h-[340px] sm:p-8">
                <div>
                  <SectionLabel>Why Lotus.build</SectionLabel>
                  <h2 className="max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
                    A focused workspace for turning rough ideas into usable product surfaces.
                  </h2>
                </div>

                <p className="mt-10 max-w-md text-sm leading-7 text-muted-foreground">
                  Lotus keeps the prompt, preview, code, and next edit in one calm flow, so the first version feels polished instead of patched together.
                </p>
              </div>

              <div className="flex min-h-[300px] flex-col justify-between rounded-[1.75rem] bg-primary p-6 text-primary-foreground sm:min-h-[340px] sm:p-8">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/55">
                    What stays together
                  </p>
                  <p className="mt-6 max-w-sm text-2xl font-medium leading-[1.08] tracking-[-0.04em] sm:text-3xl">
                    Less jumping between tools. More momentum from idea to working screen.
                  </p>
                </div>

                <div className="mt-10 space-y-2">
                  {WHY_LOTUS_POINTS.map((point, index) => (
                    <div
                      key={point}
                      className="flex items-center justify-between rounded-2xl bg-primary-foreground/10 px-4 py-3 text-sm"
                    >
                      <span className="text-primary-foreground/80">{point}</span>
                      <span className="text-xs tabular-nums text-primary-foreground/40">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <Section id="features" className="pb-10 sm:pb-12">
          <ColorfulBentoGrid />
        </Section>

        {/* ── USE CASES ────────────────────────────────────────────────────── */}
        <Section id="use-cases" className="pb-24 pt-10 sm:pb-28 sm:pt-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div>
                <SectionLabel>Use cases</SectionLabel>
                <h2 className="max-w-xl text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl">
                  For the messy middle between idea and launch.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground lg:justify-self-end">
                Start with the surface you need most, then keep refining the product in the same workspace.
              </p>
            </div>

            {featuredUseCase ? (
              <article className="group mt-12 overflow-hidden rounded-[2.25rem] border border-border bg-primary text-primary-foreground">
                <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="flex min-h-[360px] flex-col justify-between p-7 sm:p-9 lg:p-10">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/55">
                        Featured flow
                      </p>
                      <h3 className="mt-8 max-w-2xl text-5xl font-medium leading-[0.98] tracking-[-0.07em] sm:text-6xl lg:text-7xl">
                        {featuredUseCase.title}
                      </h3>
                    </div>

                    <div className="mt-10 flex items-end justify-between gap-6 border-t border-primary-foreground/15 pt-6">
                      <p className="max-w-md text-sm leading-7 text-primary-foreground/70">
                        {featuredUseCase.description}
                      </p>
                      <ArrowRight className="h-5 w-5 shrink-0 text-primary-foreground/60 transition group-hover:translate-x-1" />
                    </div>
                  </div>

                  <div className="bg-secondary p-5 text-foreground sm:p-7 lg:p-8">
                    <div className="flex h-full min-h-[300px] flex-col justify-between rounded-[1.75rem] border border-border bg-card p-6">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        What Lotus keeps together
                      </p>
                      <div className="space-y-3">
                        {WORKSPACE_FLOW_STEPS.map((step, index) => (
                          <div key={step} className="flex items-center justify-between border-t border-border pt-3 text-sm">
                            <span className="font-medium text-foreground">{step}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {secondaryUseCases.map((useCase, idx) => (
                <article
                  key={useCase.title}
                  className="group grid gap-8 rounded-[1.75rem] border border-border bg-card p-6 transition hover:border-border-strong sm:grid-cols-[80px_1fr]"
                >
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {String(idx + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-2xl font-medium tracking-[-0.045em] text-foreground">
                      {useCase.title}
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                      {useCase.description}
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-sm font-medium text-foreground">
                      <span>Build this flow</span>
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
        <Section
          id="testimonials"
          className="bg-background pb-24 pt-16 sm:pb-28 sm:pt-20"
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
              <div className="lg:sticky lg:top-24">
                <SectionLabel>Testimonials</SectionLabel>
                <h2 className="max-w-md text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl">
                  A calmer way to build with AI.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
                  Founders use Lotus when they want the pace of prompting without the mess of a generic prototype.
                </p>
                <p className="mt-10 max-w-xs text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  No busy dashboards. Just the next useful step.
                </p>
              </div>

              <div className="rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_90px_-78px_var(--primary)] sm:p-4">
                {lotusBuildTestimonials[0] ? (
                  <blockquote className="rounded-[1.5rem] bg-primary p-7 text-primary-foreground sm:p-9">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-foreground/55">
                      Builder note
                    </p>
                    <p className="mt-8 max-w-2xl text-3xl font-medium leading-[1.08] tracking-[-0.05em] sm:text-4xl">
                      “{lotusBuildTestimonials[0].text}”
                    </p>
                    <footer className="mt-10 flex items-center justify-between gap-4 border-t border-primary-foreground/15 pt-5">
                      <div>
                        <p className="text-sm font-medium">{lotusBuildTestimonials[0].name}</p>
                        <p className="mt-1 text-xs text-primary-foreground/60">{lotusBuildTestimonials[0].role}</p>
                      </div>
                      <span className="text-5xl font-medium leading-none tracking-[-0.08em] text-primary-foreground/15">
                        01
                      </span>
                    </footer>
                  </blockquote>
                ) : null}

                <div className="divide-y divide-border px-2 sm:px-4">
                  {lotusBuildTestimonials.slice(1, 4).map((testimonial, index) => (
                    <blockquote
                      key={testimonial.name}
                      className="grid gap-5 py-7 sm:grid-cols-[72px_1fr] sm:py-8"
                    >
                      <span className="text-xs font-medium tabular-nums text-muted-foreground/60">
                        {String(index + 2).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="max-w-xl text-xl font-medium leading-snug tracking-[-0.035em] text-foreground">
                          “{testimonial.text}”
                        </p>
                        <footer className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-medium text-foreground">{testimonial.name}</span>
                          <span className="text-muted-foreground">{testimonial.role}</span>
                        </footer>
                      </div>
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <Section className="bg-background pb-24 pt-10 sm:pb-32 sm:pt-14">
          <div className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-[2.25rem] bg-card shadow-[0_28px_100px_-82px_var(--primary)]">
              <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
                <div className="flex min-h-[420px] flex-col justify-between p-7 sm:p-9">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Start with a sentence
                    </p>
                    <h2 className="mt-6 max-w-lg text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
                      Describe the thing you want live.
                    </h2>
                  </div>

                  <p className="mt-10 max-w-sm text-sm leading-7 text-muted-foreground">
                    Lotus turns a rough prompt into a project you can preview, edit, and keep shaping in one workspace.
                  </p>
                </div>

                <div className="flex min-h-[420px] flex-col justify-center bg-secondary/55 p-5 sm:p-8 lg:p-10">
                  <div className="mx-auto w-full max-w-2xl">
                    <AnimatedAIInput />

                    <div className="mt-6 grid gap-2 sm:grid-cols-3">
                      {[
                        "A launch page for a finance app",
                        "A booking flow for a studio",
                        "A mobile app prototype",
                      ].map((prompt) => (
                        <div
                          key={prompt}
                          className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-xs leading-5 text-muted-foreground"
                        >
                          {prompt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}