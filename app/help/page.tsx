"use client"

import { useMemo, useState } from "react"
import { ArrowUpRight, Mail, Search, X } from "lucide-react"
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FooterSection } from "@/components/sections/footer-section"
import { Navbar } from "@/components/ui/navbar"
import { lotusBuildFaqs, lotusBuildHelpTopics, lotusBuildSupportAreas, lotusBuildSupportEmail, type HelpTopic } from "@/lib/lotus-build-site-content"

type TopicFilter = HelpTopic | "all"

export default function HelpPage() {
  const [query, setQuery] = useState("")
  const [topic, setTopic] = useState<TopicFilter>("all")

  const filteredFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return lotusBuildFaqs
      .map((faq, index) => ({ ...faq, index }))
      .filter((faq) => (topic === "all" || faq.topic === topic)
        && (!needle || faq.q.toLowerCase().includes(needle) || faq.a.toLowerCase().includes(needle)))
  }, [topic, query])

  const chooseTopic = (next: TopicFilter) => { setTopic(next); setQuery("") }

  return (
    <section data-product-theme="dark" className="dark help-page">
      <Navbar />
      <main className="help-content">
        <header className="help-header">
          <VStack gap={3}>
            <p className="help-label">Help centre</p>
            <h1 id="help-title">How can we help?</h1>
            <p className="help-intro">Find an answer, get back to your project, or talk to the team.</p>
          </VStack>
          <label className="help-search">
            <Search className="size-5" aria-hidden="true" />
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); if (event.target.value) setTopic("all") }}
              placeholder="Search planning, files, usage…"
              aria-label="Search help"
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X className="size-4" aria-hidden="true" /></button>}
          </label>
        </header>

        <section className="help-layout" aria-labelledby="help-title">
          <nav className="help-topics" aria-label="Filter questions by topic">
            <p className="help-label">Browse topics</p>
            <button type="button" aria-pressed={topic === "all"} onClick={() => chooseTopic("all")}>All questions</button>
            {lotusBuildHelpTopics.map((entry) => (
              <button key={entry.key} type="button" aria-pressed={topic === entry.key} onClick={() => chooseTopic(entry.key)}>{entry.label}</button>
            ))}
          </nav>
          <section className="help-faq" aria-labelledby="faq-title">
            <HStack align="center" justify="between" gap={4} wrap="wrap" className="help-results-heading">
              <h2 id="faq-title">Common questions</h2>
              <p className="help-count" role="status" aria-live="polite" aria-atomic="true">
                {filteredFaqs.length === lotusBuildFaqs.length ? `${lotusBuildFaqs.length} questions` : `${filteredFaqs.length} of ${lotusBuildFaqs.length} questions`}
              </p>
            </HStack>
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.index} value={`faq-${faq.index}`} className="border-border">
                    <AccordionTrigger className="help-question">{faq.q}</AccordionTrigger>
                    <AccordionContent className="help-answer">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <VStack gap={3} className="help-empty">
                <h3>No matching questions</h3>
                <p>No results for “{query}”.</p>
                <p>Try a different word, or browse all questions.</p>
                <button type="button" onClick={() => chooseTopic("all")} className="help-reset">Show all questions</button>
              </VStack>
            )}
          </section>
        </section>

        <section id="contact" className="help-contact" aria-labelledby="contact-title">
          <Mail aria-hidden="true" className="size-5 text-muted-foreground" />
          <h2 id="contact-title">Need a hand?</h2>
          <p>Tell us the project name, what you expected, and what happened. We’ll take a look.</p>
          <a href={`mailto:${lotusBuildSupportEmail}`} className="help-contact-action">Email support <ArrowUpRight className="size-4" aria-hidden="true" /></a>
          <a className="help-contact-email" href={`mailto:${lotusBuildSupportEmail}`}>{lotusBuildSupportEmail}</a>
        </section>

        <section className="help-areas" aria-labelledby="support-title">
          <h2 id="support-title">What we can help with</h2>
          <ul className="help-area-list">
            {lotusBuildSupportAreas.map(area => (
              <li key={area.title}>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <FooterSection />
    </section>
  )
}
