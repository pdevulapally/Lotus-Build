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

            <div className="relative z-10 flex h-full items-center justify-center p-4 pb-10 sm:p-6 sm:pb-12 md:p-8 md:pb-14">
              <div className="w-full max-w-3xl translate-y-2 sm:translate-y-4 md:translate-y-6">
                <div className="-translate-y-4 sm:-translate-y-5 md:-translate-y-6">
                  <Navbar variant="hero" />
                </div>

                <div className="mt-8 translate-y-3 text-center sm:mt-10 sm:translate-y-4 md:translate-y-5">
                  <h1
                    className="mx-auto max-w-4xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
                    style={{
                      fontSize: "clamp(32px, 7vw, 72px)",
                      lineHeight: 1.05,
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
                    className="mx-auto mt-4 max-w-xl px-2 text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)] sm:mt-5 sm:max-w-2xl"
                    style={{ fontSize: "clamp(13px, 3vw, 16px)" }}
                  >
                    Describe what you want to build. Lotus turns it into a live preview, production-ready code, and a workspace you can keep shaping.
                  </p>

                  <div className="mx-auto mt-6 mb-2 w-full sm:mt-8 sm:mb-4">
                    <AnimatedAIInput />
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
