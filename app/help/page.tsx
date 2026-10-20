"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FooterSection } from "@/components/sections/footer-section"
import { Navbar } from "@/components/ui/navbar"
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal"
import { ArrowRightIcon, BillingIcon, FilesIcon, TeamAppIcon } from "@/components/ui/lotus-icons"
import { lotusBuildFaqs, lotusBuildHelpTopics, lotusBuildSupportAreas, lotusBuildSupportEmail, type HelpTopic } from "@/lib/lotus-build-site-content"
import styles from "./help.module.css"

type TopicFilter = HelpTopic | "all"
const areaIcons = [TeamAppIcon, BillingIcon, FilesIcon] as const

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
    <main className={styles.main}>
      <Navbar />

      <RevealGroup as="section" className={styles.hero} aria-labelledby="help-title" animateOnMount>
        <RevealItem as="p" className={styles.eyebrow}>Help centre</RevealItem>
        <RevealItem as="h1" id="help-title" className={styles.title}>How can we help?</RevealItem>
        <RevealItem as="p" className={styles.lead}>Search common questions, browse by topic, or contact the team when a project needs a human look.</RevealItem>
        <RevealItem className={styles.search}>
          <Search className="size-5" aria-hidden="true" />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); if (event.target.value) setTopic("all") }}
            placeholder="Search planning, files, usage…"
            aria-label="Search help"
          />
        </RevealItem>
        <RevealItem className={styles.topics} role="group" aria-label="Filter questions by topic">
          <button type="button" aria-pressed={topic === "all" && !query} onClick={() => chooseTopic("all")}>All questions</button>
          {lotusBuildHelpTopics.map((entry) => (
            <button key={entry.key} type="button" aria-pressed={topic === entry.key} onClick={() => chooseTopic(entry.key)}>{entry.label}</button>
          ))}
        </RevealItem>
      </RevealGroup>

      <section className={styles.faq} aria-labelledby="faq-title">
        <h2 id="faq-title" className="sr-only">Common questions</h2>
        <p className={styles.count} role="status" aria-live="polite" aria-atomic="true">
          {filteredFaqs.length === lotusBuildFaqs.length ? `${lotusBuildFaqs.length} questions` : `${filteredFaqs.length} of ${lotusBuildFaqs.length} questions`}
        </p>
        {filteredFaqs.length > 0 ? (
          <Reveal className={styles.list}>
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq) => (
                <AccordionItem key={faq.index} value={`faq-${faq.index}`} className="border-border">
                  <AccordionTrigger className={styles.trigger}>{faq.q}</AccordionTrigger>
                  <AccordionContent className={styles.answer}>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        ) : (
          <div className={styles.empty}>
            <p>No results for “{query}”</p>
            <p>Try a different word, or browse all questions.</p>
            <button type="button" onClick={() => chooseTopic("all")}>Show all questions</button>
          </div>
        )}
      </section>

      <section className={styles.areas} aria-labelledby="support-title">
        <Reveal as="h2" id="support-title" className={styles.areasHead}>What we can help with</Reveal>
        <RevealGroup as="ul" className={styles.areaList} step={0.06}>
          {lotusBuildSupportAreas.map((area, index) => {
            const Icon = areaIcons[index] ?? TeamAppIcon
            return (
              <RevealItem as="li" key={area.title}>
                <span className={styles.areaIcon}><Icon /></span>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </RevealItem>
            )
          })}
        </RevealGroup>
      </section>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <Reveal className={styles.contactInner}>
          <div>
            <h2 id="contact-title">Need a hand?<br />Email the team.</h2>
            <p>One email reaches the people who built LotusBuild. Include as much detail as you can and we will pick it up from there.</p>
          </div>
          <div className={styles.contactCard}>
            <span>Support</span>
            <a href={`mailto:${lotusBuildSupportEmail}`}>{lotusBuildSupportEmail}<ArrowRightIcon width={16} height={16} /></a>
            <small>Tell us the project name and what you expected to happen.</small>
          </div>
        </Reveal>
      </section>

      <FooterSection />
    </main>
  )
}
