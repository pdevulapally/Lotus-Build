import { CookieBanner } from "@/components/cookie-banner"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { CreateAfterLogin } from "@/components/create-after-login"
import { FooterSection } from "@/components/sections/footer-section"
import {
  LandingClosingSection,
  LandingFeaturesSection,
  LandingProductSection,
  LandingTestimonialsSection,
  LandingUseCasesSection,
} from "@/components/sections/landing-page-sections"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Navbar } from "@/components/ui/navbar"

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"

const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"

const HERO_NOISE_BACKGROUND =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="min-h-screen w-full bg-[oklch(0.18_0.012_60)] font-sans">
          <div className="relative h-screen w-full overflow-hidden bg-foreground">
            <video
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_50%]"
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

            <div
              className="pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay"
              style={{ backgroundImage: HERO_NOISE_BACKGROUND }}
              aria-hidden
            />

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/30 via-transparent to-foreground/60"
              aria-hidden
            />

            <div className="absolute left-1/2 top-0 z-20 w-full max-w-4xl -translate-x-1/2 px-4 sm:px-6">
              <div className="mx-auto w-full">
                <Navbar variant="hero" />
              </div>
            </div>

            <div className="relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-6 md:p-8">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden pt-14 sm:pt-16 md:pt-20">
                <div className="w-full max-w-3xl text-center lg:max-w-4xl">
                  <h1
                    className="mx-auto max-w-4xl text-background drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
                    style={{
                      fontSize: "clamp(28px, 5.5vw, 72px)",
                      lineHeight: 1.08,
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Turn bold ideas into live{" "}
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 400,
                      }}
                    >
                      products
                    </span>
                  </h1>

                  <p
                    className="mx-auto mt-4 max-w-xl px-2 text-background/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:mt-5 sm:max-w-2xl md:mt-6"
                    style={{ fontSize: "clamp(13px, 2.5vw, 16px)" }}
                  >
                    Describe what you want to build. Lotus turns it into a live preview, production-ready code, and a workspace you can keep shaping.
                  </p>

                  <div className="mx-auto mt-6 w-full sm:mt-8 md:mt-9 lg:mt-10">
                    <AnimatedAIInput
                      wrapperClassName="border-background/20 bg-background/86 shadow-[0_28px_90px_-56px_rgba(0,0,0,0.95)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/72 [&_textarea]:min-h-[76px] [&_.inline-flex.rounded-lg.bg-background]:rounded-full [&_.inline-flex.rounded-lg.bg-background]:bg-foreground/10 [&_.inline-flex.rounded-lg.bg-background]:ring-background/20 [&_.inline-flex.rounded-lg.bg-background_button]:rounded-full [&_.inline-flex.rounded-lg.bg-background_button.bg-foreground]:bg-foreground [&_.inline-flex.rounded-lg.bg-background_button.text-muted-foreground]:text-foreground/75 [&_button]:rounded-full [&_button:hover]:bg-foreground/10 [&_button:hover]:text-foreground [&_button.bg-muted]:bg-foreground/10 [&_button.bg-muted]:text-foreground/65 [&_button.bg-primary]:bg-foreground [&_button.bg-primary]:text-background [&_button.bg-primary:hover]:bg-foreground/90"
                      footerHintsClassName="text-background/80 [&_kbd]:border-background/30 [&_kbd]:bg-background/10 [&_kbd]:text-background/95"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingProductSection />
        <LandingFeaturesSection />
        <LandingUseCasesSection />
        <LandingTestimonialsSection />
        <LandingClosingSection />

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}
