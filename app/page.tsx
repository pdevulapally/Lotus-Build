import { Navbar } from "@/components/ui/navbar"
import { CookieBanner } from "@/components/cookie-banner"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { CreateAfterLogin } from "@/components/create-after-login"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Blocks, ShieldCheck, Star, Gauge } from "lucide-react"
import {
  lotusBuildFeatureItems,
  lotusBuildMetrics,
  lotusBuildTestimonials,
  lotusBuildUseCases,
} from "@/lib/lotus-build-site-content"

const featureIcons = [Star, Blocks, Gauge, ShieldCheck]

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <Navbar />

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

          <div className="absolute inset-0 -z-20 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.25),transparent_60%)]" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl items-center justify-center pb-20 text-center sm:pb-24">
            <div className="w-full">
              <h1 className="font-display text-5xl font-bold leading-[0.92] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
                Describe your idea.
                <span className="mt-2 block text-white/90">We build it.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
                Turn your ideas into full-stack web applications with AI.
                Just describe what you want to build and watch it come to life.
              </p>

              <div className="mx-auto mt-10 flex max-w-3xl justify-center">
                <AnimatedAIInput />
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-lg font-medium tracking-tight text-foreground/80 sm:text-xl">
              The fastest way for founders to turn intent into a live website.
            </p>
          </div>
        </section>

        <section id="features" className="relative px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lotusBuildFeatureItems.map((item, idx) => {
              const Icon = featureIcons[idx] ?? Star

              return (
                <article
                  key={item.title}
                  className={`rounded-3xl px-5 py-6 ${
                    idx % 2 === 0 ? "bg-muted" : "bg-muted"
                  }`}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-foreground/80">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="relative mt-6 bg-muted px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center md:grid-cols-4">
            {lotusBuildMetrics.map((metric) => (
              <div key={metric.label}>
                <p className="font-display text-4xl font-bold text-foreground sm:text-5xl">{metric.value}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-muted px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lotusBuildUseCases.map((useCase) => (
              <article key={useCase.title} className="rounded-2xl bg-white/70 p-6">
                <h3 className="text-lg font-semibold text-foreground">{useCase.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{useCase.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="testimonials" className="bg-muted px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Testimonials</p>
              <h2 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">Loved by builders</h2>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300/80 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400/80">
              {lotusBuildTestimonials.map((testimonial) => (
                <blockquote
                  key={testimonial.name}
                  className="w-[300px] shrink-0 rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-sm text-foreground/80">"{testimonial.text}"</p>
                  <footer className="mt-4">
                    <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
        <FooterSection />
      </main>
      <CookieBanner />
    </LenisProvider>
  )
}
