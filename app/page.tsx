import { Navbar } from "@/components/ui/navbar"
import { CookieBanner } from "@/components/cookie-banner"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { CreateAfterLogin } from "@/components/create-after-login"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { ColorfulBentoGrid } from "@/components/ui/colorful-bento-grid"
import {
  ArrowRight,
  Quote,
} from "lucide-react"
import {
  lotusBuildMetrics,
  lotusBuildTestimonials,
  lotusBuildUseCases,
} from "@/lib/lotus-build-site-content"

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4"

const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"

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

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 pb-12 pt-20 text-center sm:pb-16 sm:pt-24">
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
        <Section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <SectionLabel>Why Lotus.build</SectionLabel>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                A focused build environment for founders who need the work to feel polished, not prototyped.
              </p>
            </div>
            <p className="text-3xl font-medium leading-[1.05] tracking-[-0.045em] text-foreground sm:text-4xl lg:text-5xl">
              The fastest way to turn{" "}
              <span className="text-muted-foreground">a rough idea</span>{" "}
              into a live product surface people can actually use.
            </p>
          </div>
        </Section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <Section id="features" className="pb-24 sm:pb-28">
          <ColorfulBentoGrid />
        </Section>

        {/* ── METRICS ──────────────────────────────────────────────────────── */}
        <Section className="py-6">
          <div className="mx-auto max-w-6xl rounded-[2rem] border border-border bg-card p-4 shadow-[0_24px_90px_-72px_var(--primary)] sm:p-6">
            <div className="grid gap-px overflow-hidden rounded-[1.5rem] bg-border sm:grid-cols-2 lg:grid-cols-4">
              {lotusBuildMetrics.map((metric) => (
                <div key={metric.label} className="bg-secondary p-6 sm:p-7">
                  <p className="text-4xl font-semibold tabular-nums tracking-[-0.045em] text-foreground sm:text-5xl">
                    {metric.value}
                  </p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── USE CASES ────────────────────────────────────────────────────── */}
        <Section id="use-cases" className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl sm:mb-12">
              <SectionLabel>Use cases</SectionLabel>
              <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                Built for founders, agencies, and teams moving from idea to launch.
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {lotusBuildUseCases.map((useCase, idx) => (
                <article
                  key={useCase.title}
                  className="group relative min-h-[280px] overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_22px_70px_-58px_var(--primary)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-accent opacity-0 transition group-hover:opacity-100" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-10 text-2xl font-semibold tracking-[-0.035em] text-foreground">
                    {useCase.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {useCase.description}
                  </p>
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between border-t border-border pt-4 text-sm font-medium text-foreground">
                    <span>Build this flow</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
        <Section
          id="testimonials"
          className="border-y border-border bg-secondary/55 py-24 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <SectionLabel>Testimonials</SectionLabel>
                <h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                  Loved by builders who ship.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground lg:justify-self-end">
                Teams use Lotus to shorten the distance between what they want to build and what customers can actually open.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              {lotusBuildTestimonials[0] ? (
                <blockquote className="rounded-[2rem] border border-border bg-card p-7 shadow-[0_22px_80px_-68px_var(--primary)] sm:p-9">
                  <Quote className="h-7 w-7 text-accent" />
                  <p className="mt-8 max-w-2xl text-2xl font-medium leading-snug tracking-[-0.025em] text-foreground sm:text-3xl">
                    “{lotusBuildTestimonials[0].text}”
                  </p>
                  <footer className="mt-8 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-sm font-semibold text-accent-soft-foreground">
                      {lotusBuildTestimonials[0].name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{lotusBuildTestimonials[0].name}</p>
                      <p className="text-xs text-muted-foreground">{lotusBuildTestimonials[0].role}</p>
                    </div>
                  </footer>
                </blockquote>
              ) : null}

              <div className="grid gap-4">
                {lotusBuildTestimonials.slice(1, 4).map((testimonial) => (
                  <blockquote key={testimonial.name} className="rounded-[1.5rem] border border-border bg-card p-5">
                    <p className="text-sm leading-relaxed text-foreground/80">“{testimonial.text}”</p>
                    <footer className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-[11px] font-semibold text-muted-foreground">
                        {testimonial.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <Section className="border-t border-border py-28 sm:py-36">
          <div className="mx-auto flex min-h-[52vh] max-w-4xl flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Start with a sentence.
            </p>
            <h2 className="mt-4 text-4xl font-medium leading-[1.02] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
              What do you want to build?
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Lotus turns your prompt into a working project with code, preview, and edits in one place.
            </p>

            <div className="mt-10 w-full">
              <AnimatedAIInput />
            </div>

            <p className="mt-5 text-xs text-muted-foreground/70">
              Try: a launch page, a booking flow, a SaaS dashboard, or a mobile app prototype.
            </p>
          </div>
        </Section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}