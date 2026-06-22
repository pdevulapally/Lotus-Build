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
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260602_150901_c45b90ec-18d7-42ff-90e2-b95d7109e330.mp4"

const HERO_VIDEO_POSTER =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="min-h-screen w-full bg-background p-3 font-sans sm:p-4">
          <div className="relative h-[calc(100vh-24px)] w-full overflow-hidden rounded-2xl bg-secondary sm:h-[calc(100vh-32px)] sm:rounded-3xl">
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
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40"
              aria-hidden
            />

            <div className="relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-6 md:p-8">
              <div className="mx-auto w-full max-w-3xl shrink-0 lg:max-w-4xl">
                <Navbar variant="hero" />
              </div>

              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden py-4 sm:py-5 md:py-6 lg:py-8">
                <div className="w-full max-w-3xl text-center lg:max-w-4xl">
                  <h1
                    className="mx-auto max-w-4xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
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
                    className="mx-auto mt-4 max-w-xl px-2 text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:mt-5 sm:max-w-2xl md:mt-6"
                    style={{ fontSize: "clamp(13px, 2.5vw, 16px)" }}
                  >
                    Describe what you want to build. Lotus turns it into a live preview, production-ready code, and a workspace you can keep shaping.
                  </p>

                  <div className="mx-auto mt-6 w-full sm:mt-8 md:mt-9 lg:mt-10">
                    <AnimatedAIInput
                      footerHintsClassName="text-white/65 [&_kbd]:border-white/25 [&_kbd]:bg-white/10 [&_kbd]:text-white/85"
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
