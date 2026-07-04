import { ArrowUpRight } from "lucide-react"

import { CookieBanner } from "@/components/cookie-banner"
import { CreateAfterLogin } from "@/components/create-after-login"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Navbar } from "@/components/ui/navbar"

const proofPoints = [
  {
    title: "Start with the idea",
    copy: "Write the product, audience, pages, and tone in plain language.",
  },
  {
    title: "See the first version",
    copy: "Lotus opens a live preview so the work feels tangible quickly.",
  },
  {
    title: "Refine from there",
    copy: "Ask for changes in the same workspace instead of starting again.",
  },
] as const

const previewSteps = ["Brief understood", "Preview drafted", "Ready to refine"] as const

function ProductPreview() {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-secondary p-3 shadow-[0_34px_120px_-84px_var(--foreground)]">
      <section className="grid min-h-[30rem] overflow-hidden rounded-md border border-border bg-card lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="flex flex-col border-b border-border bg-card p-5 lg:border-b-0 lg:border-r">
          <figcaption className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Lotus workspace</span>
            <span className="rounded-full bg-success-soft px-2.5 py-1 font-medium text-success-soft-foreground">
              Live
            </span>
          </figcaption>

          <p className="mt-10 text-sm font-medium text-accent-soft-foreground">
            What we are building
          </p>
          <h3 className="mt-3 text-3xl font-medium leading-tight text-foreground">
            A booking site that feels clear before it feels clever.
          </h3>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Services, availability, warm editorial styling, and one direct path
            to book.
          </p>

          <ul className="mt-auto divide-y divide-border border-y border-border text-sm">
            {previewSteps.map((item) => (
              <li key={item} className="flex items-center justify-between py-3">
                <span className="text-foreground">{item}</span>
                <span className="text-success">Done</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[23rem] flex-col bg-slate-soft p-4 text-slate-soft-foreground">
          <header className="flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground">
            <span>Live preview</span>
            <span>Responsive</span>
          </header>

          <section className="mt-5 flex flex-1 flex-col justify-between rounded-md bg-background p-6 shadow-[inset_0_0_0_1px_var(--border)]">
            <span className="w-fit rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">
              New booking site
            </span>
            <h4 className="mt-10 max-w-md text-4xl font-medium leading-none text-foreground sm:text-5xl">
              Every visit starts with less friction.
            </h4>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              A focused first draft with calm copy, clear structure, and a
              preview ready to edit.
            </p>
            <span className="mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
              Book a visit
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </section>
        </section>
      </section>
    </figure>
  )
}

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <section className="relative overflow-hidden border-b border-border bg-secondary px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
          <Navbar variant="hero" />

          <section className="mx-auto max-w-5xl pt-16 text-center sm:pt-20 lg:pt-24">
            <p className="text-sm font-medium text-accent-soft-foreground">
              Lotus.build
            </p>

            <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.04] text-foreground sm:text-5xl lg:text-6xl">
              What can I build for you?
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-xl sm:leading-8">
              Describe the site or app you need. Lotus turns the brief into a
              live preview you can keep refining.
            </p>

            <section className="mx-auto mt-10 max-w-3xl">
              <AnimatedAIInput
                placeholder="Build a refined site for..."
                wrapperClassName="rounded-lg border-border-strong bg-card shadow-[0_30px_110px_-78px_var(--foreground)] [&_textarea]:min-h-[88px] [&_button]:rounded-full [&_button.bg-primary]:bg-accent [&_button.bg-primary]:text-accent-foreground [&_button.bg-primary:hover]:bg-accent/90"
              />
            </section>
          </section>
        </section>

        <section id="product" className="bg-background px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <section>
              <p className="text-sm font-medium text-accent-soft-foreground">
                From idea to live preview
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium leading-tight text-foreground sm:text-5xl">
                A calmer way to make the first version feel real.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                Lotus keeps the path short: prompt, preview, refine. The work
                stays visible, focused, and ready for the next change.
              </p>

              <ul className="mt-8 divide-y divide-border border-y border-border">
                {proofPoints.map((point) => (
                  <li key={point.title} className="py-5">
                    <h3 className="text-base font-medium text-foreground">
                      {point.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {point.copy}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <ProductPreview />
          </section>
        </section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}
