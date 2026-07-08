import { Check, FileCode2 } from "lucide-react"

import { CookieBanner } from "@/components/cookie-banner"
import { CreateAfterLogin } from "@/components/create-after-login"
import { LenisProvider } from "@/components/providers/lenis-provider"
import { FooterSection } from "@/components/sections/footer-section"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { Navbar } from "@/components/ui/navbar"
import { cn } from "@/lib/utils"

const buildSteps = [
  {
    title: "Prompt understood",
    copy: "The brief becomes a structured plan the agent can execute.",
    state: "done",
  },
  {
    title: "Components generated",
    copy: "Real React, TypeScript, and Tailwind files, not placeholder blocks.",
    state: "done",
  },
  {
    title: "Preview deployed",
    copy: "The build runs live in the workspace, ready for the next change.",
    state: "live",
  },
] as const

function CodeLine({
  n,
  indent = 0,
  children,
}: {
  n: number
  indent?: number
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <span className="w-6 shrink-0 select-none text-right text-white/25">{n}</span>
      <span className="text-white/85" style={{ paddingLeft: `${1 + indent * 1.1}rem` }}>
        {children}
      </span>
    </div>
  )
}
const Kw = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#c9a7f5]">{children}</span>
)
const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#eab479]">{children}</span>
)
const Id = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#7ec9e8]">{children}</span>
)
const Str = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[#a8d8a0]">{children}</span>
)
const Pn = ({ children }: { children: React.ReactNode }) => (
  <span className="text-white/35">{children}</span>
)

function BuildPreview() {
  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-secondary p-3 shadow-[0_34px_120px_-84px_var(--foreground)]">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted-foreground">
          <span>Live workspace</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-medium text-success-soft-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </span>
        </div>

        <div className="bg-[#0b0b0e] p-1.5">
          <div className="overflow-hidden rounded-[7px]">
            <div className="flex items-center gap-1 border-b border-white/[0.08] bg-[#111114] px-2 pt-2">
              <div className="flex items-center gap-1.5 rounded-t-md bg-[#0b0b0e] px-3 py-2 text-xs font-medium text-white/85">
                <FileCode2 className="h-3.5 w-3.5 text-[#eab479]" aria-hidden="true" />
                Hero.tsx
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/35">
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                App.tsx
              </div>
            </div>

            <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-6">
              <code>
                <CodeLine n={1}>
                  <Kw>export function</Kw> <Id>Hero</Id>
                  <Pn>{"() {"}</Pn>
                </CodeLine>
                <CodeLine n={2} indent={1}>
                  <Kw>return</Kw> <Pn>(</Pn>
                </CodeLine>
                <CodeLine n={3} indent={2}>
                  <Pn>{"<"}</Pn>
                  <Tag>section</Tag> <Id>className</Id>
                  <Pn>=</Pn>
                  <Str>&quot;max-w-4xl px-6 py-24&quot;</Str>
                  <Pn>{">"}</Pn>
                </CodeLine>
                <CodeLine n={4} indent={3}>
                  <Pn>{"<"}</Pn>
                  <Tag>h1</Tag> <Id>className</Id>
                  <Pn>=</Pn>
                  <Str>&quot;text-5xl font-semibold&quot;</Str>
                  <Pn>{">"}</Pn>
                </CodeLine>
                <CodeLine n={5} indent={4}>
                  Ship your idea today
                </CodeLine>
                <CodeLine n={6} indent={3}>
                  <Pn>{"</"}</Pn>
                  <Tag>h1</Tag>
                  <Pn>{">"}</Pn>
                </CodeLine>
                <CodeLine n={7} indent={3}>
                  <Pn>{"<"}</Pn>
                  <Tag>Button</Tag> <Id>className</Id>
                  <Pn>=</Pn>
                  <Str>&quot;mt-8&quot;</Str>
                  <Pn>{">"}</Pn>
                  Get started
                  <Pn>{"</"}</Pn>
                  <Tag>Button</Tag>
                  <Pn>{">"}</Pn>
                </CodeLine>
                <CodeLine n={8} indent={2}>
                  <Pn>{"</"}</Pn>
                  <Tag>section</Tag>
                  <Pn>{">"}</Pn>
                </CodeLine>
                <CodeLine n={9} indent={1}>
                  <Pn>)</Pn>
                </CodeLine>
                <CodeLine n={10}>
                  <Pn>{"}"}</Pn>
                </CodeLine>
              </code>
            </pre>

            <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#111114] px-5 py-2.5 font-mono text-[11px] uppercase tracking-wide text-white/40">
              <span className="inline-flex items-center gap-2 text-[#7cd992]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7cd992]" aria-hidden="true" />
                Compiled &middot; Ready
              </span>
              <span>0 errors</span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}

export default function Home() {
  return (
    <LenisProvider>
      <CreateAfterLogin />

      <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
        <section className="relative overflow-hidden border-b border-border bg-background px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <Navbar variant="hero" />

          <section className="relative mx-auto max-w-5xl pt-16 text-center sm:pt-20 lg:pt-24">
            <p
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground duration-700"
            >
              Lotus.build
            </p>

            <h1
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto mt-5 max-w-3xl text-4xl font-medium leading-[1.05] text-foreground duration-700 sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              What can I <span className="font-editorial font-normal">build</span> for you?
            </h1>

            <p
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground duration-700 sm:text-xl sm:leading-8"
              style={{ animationDelay: "140ms" }}
            >
              Describe the site or app you need. Lotus turns the brief into a
              live preview you can keep refining.
            </p>

            <section
              className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative mx-auto mt-10 max-w-3xl duration-700"
              style={{ animationDelay: "200ms" }}
            >
              <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-x-8 -top-8 -z-10 h-28" />
              <AnimatedAIInput
                placeholder="Build a refined site for..."
                wrapperClassName="rounded-2xl border-border-strong/70 bg-card [&_textarea]:min-h-[88px] [&_button]:rounded-full [&_button.bg-primary]:bg-accent [&_button.bg-primary]:text-accent-foreground [&_button.bg-primary:hover]:bg-accent/90"
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
              <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                What you see is the code that ships.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                Lotus writes production React, TypeScript, and Tailwind, then
                opens a live preview of the exact build. No mockups standing
                in for the real thing.
              </p>

              <ol className="mt-8 space-y-6">
                {buildSteps.map((step, index) => (
                  <li key={step.title} className="relative flex gap-4">
                    {index < buildSteps.length - 1 && (
                      <span
                        className="absolute left-[9px] top-6 h-[calc(100%-0.25rem)] w-px bg-border"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
                        step.state === "live" ? "bg-success/15" : "bg-foreground",
                      )}
                    >
                      {step.state === "done" ? (
                        <Check
                          className="h-3 w-3 text-background"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      ) : (
                        <>
                          <span
                            className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success opacity-75"
                            aria-hidden="true"
                          />
                          <span
                            className="relative inline-flex h-2 w-2 rounded-full bg-success"
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-medium text-foreground">
                          {step.title}
                        </h3>
                        {step.state === "live" && (
                          <span className="text-xs font-medium text-success">
                            Live
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {step.copy}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <BuildPreview />
          </section>
        </section>

        <FooterSection />
      </main>

      <CookieBanner />
    </LenisProvider>
  )
}
