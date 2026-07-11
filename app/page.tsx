"use client"

import { CookieBanner } from "@/components/cookie-banner"
import { CreateAfterLogin } from "@/components/create-after-login"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Navbar } from "@/components/ui/navbar"
import { ProjectsWorkspace } from "@/components/projects/projects-workspace"
import { useAuth } from "@/contexts/auth-context"

const productFlow = [
  {
    label: "Plan",
    copy: "Clarify the brief and shape the product before generation starts.",
  },
  {
    label: "Build",
    copy: "Generate the real interface and keep refining it in one workspace.",
  },
  {
    label: "Preview",
    copy: "Run every change live across web and mobile before it goes out.",
  },
  {
    label: "Publish",
    copy: "Deploy the finished product when it is ready—not before.",
  },
] as const

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="animate-pulse text-sm text-muted-foreground" role="status" aria-live="polite">
          Loading your workspace…
        </p>
      </main>
    )
  }

  if (user) return <ProjectsWorkspace />

  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <section className="relative isolate overflow-hidden border-b border-border px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
          <Navbar variant="hero" />

          <section className="relative mx-auto max-w-5xl pt-20 text-center sm:pt-24 lg:pt-32">
            <p
              className="lotus-glass-control animate-in fade-in slide-in-from-bottom-2 fill-mode-both inline-flex items-center rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-semibold text-accent duration-700"
            >
              Lotus.build
            </p>

            <h1
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto mt-5 max-w-3xl text-4xl font-medium leading-[1.04] tracking-[-0.04em] text-foreground duration-700 sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              What can I <span className="font-editorial font-normal">build</span> for you?
            </h1>

            <p
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto mt-6 max-w-2xl text-base leading-7 text-foreground/75 duration-700 sm:text-xl sm:leading-8"
              style={{ animationDelay: "140ms" }}
            >
              Describe the site or app you need. Lotus turns the brief into a
              live preview you can keep refining.
            </p>

            <section
              className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative mx-auto mt-10 max-w-3xl duration-700"
              style={{ animationDelay: "200ms" }}
            >
              <AnimatedAIInput
                placeholder="Build a refined site for..."
                wrapperClassName="liquid-composer rounded-[1.75rem] border-border-strong/60 bg-card/70 [&_textarea]:min-h-[88px] [&_textarea]:text-foreground [&_textarea]:placeholder:text-foreground/55 [&_button]:rounded-full [&_button[aria-pressed=true]]:bg-accent [&_button[aria-pressed=true]]:text-accent-foreground [&_button.bg-primary]:bg-accent [&_button.bg-primary]:text-accent-foreground [&_button.bg-primary:hover]:bg-accent/90"
                footerHintsClassName="text-foreground/60"
              />
            </section>
          </section>
        </section>

        <section id="product" className="border-b border-border bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <section className="mx-auto max-w-6xl">
            <header className="grid gap-8 border-b border-border pb-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:pb-16">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
                  One continuous workspace
                </p>
                <h2 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                  From first thought to a product people can use.
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-muted-foreground lg:justify-self-end">
                Lotus keeps planning, generation, preview, and publishing in the
                same flow, so the work stays connected as the idea changes.
              </p>
            </header>

            <ol className="divide-y divide-border">
              {productFlow.map((item, index) => (
                <li
                  key={item.label}
                  className="group grid gap-4 py-7 sm:grid-cols-[4rem_0.55fr_1fr] sm:items-baseline sm:gap-8 sm:py-9"
                >
                  <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-2xl font-medium tracking-[-0.03em] text-foreground transition-colors group-hover:text-accent sm:text-3xl">
                    {item.label}
                  </h3>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                    {item.copy}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}
