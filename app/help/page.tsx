"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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

      <section className="px-4 pb-14 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Help</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                Find the answer without leaving the product context.
              </h1>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                Search common questions, filter by workflow area, or contact support when the project needs a human look.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="#contact"
                  className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Contact support
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Open projects
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 max-w-2xl">
            <label htmlFor="help-search" className="text-sm font-medium text-foreground">
              Search help
            </label>
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                if (event.target.value) setActiveCategory("all")
              }}
              placeholder="Search projects, planning, saved files, usage..."
              className="mt-3 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/35 focus:ring-2 focus:ring-ring/25"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Support areas</p>
            <h2 className="mt-3 max-w-sm text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
              Clear routes for common issues.
            </h2>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {lotusBuildSupportAreas.map(({ title, description }) => (
              <article key={title} className="grid gap-4 py-6 sm:grid-cols-[180px_minmax(0,1fr)]">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">FAQ</p>
              <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredFaqs.length === lotusBuildFaqs.length
                ? `${lotusBuildFaqs.length} questions`
                : `${filteredFaqs.length} of ${lotusBuildFaqs.length} questions`}
            </p>
          </div>

          {!query && (
            <div className="mb-6 flex flex-wrap gap-2">
              {FAQ_CATEGORIES.map((category) => {
                const isActive = activeCategory === category.key
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setActiveCategory(category.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {category.label}
                  </button>
                )
              })}
            </div>
          )}

          {filteredFaqs.length > 0 ? (
            <div className="border-y border-border">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.originalIndex} value={`faq-${faq.originalIndex}`} className="border-border">
                    <AccordionTrigger className="gap-4 py-5 text-left text-base font-medium text-foreground hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-sm leading-7 text-muted-foreground">
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
                className="mt-5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </section>

      <section
        id="contact"
        className="scroll-mt-24 border-t border-border bg-muted px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Contact us</p>
            <h2 className="mt-3 max-w-sm text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
              Send the details. A human replies.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Include the project name and what you expected to happen so the team can pick it up without a
              back-and-forth.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
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
