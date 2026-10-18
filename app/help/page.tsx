"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Search } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ContactForm } from "@/components/help/contact-form"
import { FooterSection } from "@/components/sections/footer-section"
import { Navbar } from "@/components/ui/navbar"
import { lotusBuildFaqs, lotusBuildSupportAreas, lotusBuildSupportEmail } from "@/lib/lotus-build-site-content"
import { cn } from "@/lib/utils"

const FAQ_CATEGORIES = [
  { key: "all", label: "All questions" },
  { key: "getting-started", label: "Getting started" },
  { key: "saved-work", label: "Saved work" },
  { key: "billing", label: "Usage and billing" },
] as const

type CategoryKey = (typeof FAQ_CATEGORIES)[number]["key"]

const FAQ_CATEGORY_MAP: CategoryKey[] = [
  "getting-started", "getting-started", "saved-work", "billing", "billing",
]

export default function HelpPage() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all")

  const filteredFaqs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return lotusBuildFaqs
      .map((faq, index) => ({ ...faq, originalIndex: index }))
      .filter(({ q: question, a: answer, originalIndex }) => {
        const matchesCategory = activeCategory === "all" || FAQ_CATEGORY_MAP[originalIndex] === activeCategory
        const matchesSearch =
          !normalizedQuery ||
          question.toLowerCase().includes(normalizedQuery) ||
          answer.toLowerCase().includes(normalizedQuery)
        return matchesCategory && matchesSearch
      })
  }, [activeCategory, query])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="site-shell pb-12 pt-14 sm:pb-16 sm:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="site-eyebrow">Help centre</p>
            <h1 className="site-title mt-5 max-w-2xl">
              How can we help?
            </h1>
            <p className="site-lead mt-5">
              Search common questions, filter by workflow area, or contact support when the project needs a human look.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="#contact"
                className="site-action"
              >
                Contact support
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Open projects
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="site-shell" aria-labelledby="faq-title">
        <div className="grid gap-8 border-t border-border py-10 sm:py-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="site-eyebrow">Find an answer</p>
            <h2 id="faq-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              Common questions
            </h2>
            {!query && (
              <div className="mt-6 flex flex-wrap gap-2 lg:flex-col lg:items-start" role="group" aria-label="Filter questions by topic">
                {FAQ_CATEGORIES.map((category) => {
                  const isActive = activeCategory === category.key
                  return (
                    <button
                      key={category.key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveCategory(category.key)}
                      className={cn(
                        "min-h-11 rounded-lg border px-3.5 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isActive
                          ? "border-border bg-muted text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="help-search" className="text-sm font-medium text-foreground">
              Search help
            </label>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-4 size-5 text-muted-foreground" aria-hidden="true" />
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (event.target.value) setActiveCategory("all")
                }}
                placeholder="Search projects, planning, saved files, usage..."
                className="h-13 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25"
              />
            </div>
            <p className="mb-4 mt-5 text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
              {filteredFaqs.length === lotusBuildFaqs.length
                ? `${lotusBuildFaqs.length} questions`
                : `${filteredFaqs.length} of ${lotusBuildFaqs.length} questions`}
            </p>

            {filteredFaqs.length > 0 ? (
              <div className="border-y border-border">
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem key={faq.originalIndex} value={`faq-${faq.originalIndex}`} className="border-border">
                      <AccordionTrigger className="gap-5 py-6 text-left text-base font-semibold tracking-[-0.015em] text-foreground hover:no-underline sm:text-lg">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="max-w-prose pb-7 pr-5 text-sm leading-7 text-muted-foreground sm:text-base">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : (
              <div className="border-y border-border py-12 text-center">
                <p className="text-sm font-medium text-foreground">No results for "{query}"</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different term or browse all categories.</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-5 min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="site-shell" aria-labelledby="support-title">
        <div className="grid gap-8 border-t border-border py-12 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="site-eyebrow">Support areas</p>
            <h2 id="support-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em]">What we can help with</h2>
          </div>
          <div className="divide-y divide-border">
            {lotusBuildSupportAreas.map(({ title, description }) => (
              <article key={title} className="grid gap-3 py-6 first:pt-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
                <p className="max-w-prose text-sm leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="site-shell scroll-mt-24"
      >
        <div className="grid gap-8 break-words border-t border-border py-12 sm:py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 [&>*]:min-w-0">
          <div>
            <p className="site-eyebrow">Contact us</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              Need a hand?
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Include the project name and what you expected to happen so the team can pick it up without a
              back-and-forth.
            </p>
            <p className="mt-6 break-words text-sm text-muted-foreground">
              Prefer email?{" "}
              <a
                href={`mailto:${lotusBuildSupportEmail}`}
                className="font-medium text-foreground underline underline-offset-4 transition hover:no-underline"
              >
                {lotusBuildSupportEmail}
              </a>
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      <FooterSection />
    </main>
  )
}
