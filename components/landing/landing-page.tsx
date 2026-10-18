"use client"
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ListChecks, Code2, Wrench } from 'lucide-react'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { Navbar } from '@/components/ui/navbar'
import { FooterSection } from '@/components/sections/footer-section'
import { CookieBanner } from '@/components/cookie-banner'
import { SavedWorkSection, StartModesSection } from './landing-sections'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import styles from './landing-page.module.css'

const briefs = [
  { label: 'A business website', mode: 'build', icon: Code2, prompt: 'Help me build a website for my business. Ask about the business, its customers, and the pages it needs before proposing an approach.' },
  { label: 'An app for my team', mode: 'build', icon: Wrench, prompt: 'Help me create an app for my team. Ask about our workflow, who will use it, and what it needs to do first.' },
  { label: 'Plan an idea', mode: 'plan', icon: ListChecks, prompt: 'Help me plan a software project. Ask about the problem, the users, and the requirements before proposing an approach.' },
] as const
export function LandingPage() {
  const [request, setRequest] = useState<{ prompt?: string; mode?: 'build' | 'plan'; id: number }>({ id: 0 })
  const focusBrief = () => document.getElementById('project-brief')?.focus({ preventScroll: false })
  const chooseMode = (mode: 'build' | 'plan') => { setRequest((value) => ({ mode, id: value.id + 1 })); focusBrief() }
  return <>
    <main className={styles.page}>
      <Navbar />
      <RevealGroup as="section" className={styles.hero} aria-labelledby="landing-heading" animateOnMount>
        <RevealItem as="h1" id="landing-heading">What should we build?</RevealItem>
        <RevealItem as="p" className={styles.intro}>Describe a website, app or tool. LotusBuild asks the right questions, plans it with you, then builds it.</RevealItem>
        <RevealItem className={styles.composer}>
          <AnimatedAIInput
            suggestedPrompt={request.id === 0 ? undefined : request.prompt}
            promptRequestId={request.id}
            suggestedMode={request.mode}
            appearance="assistant"
            inputId="project-brief"
            portalClassName={styles.popover}
          />
        </RevealItem>
        <RevealItem className={styles.briefs} aria-label="Example ideas">{briefs.map((brief) => <button key={brief.label} type="button" onClick={() => setRequest((value) => ({ prompt: brief.prompt, mode: brief.mode, id: value.id + 1 }))}><brief.icon size={15} strokeWidth={1.7} aria-hidden />{brief.label}</button>)}</RevealItem>
        <RevealItem className={styles.heroActions}><Link href="#workflow" className={styles.secondary}>See how it works<ArrowUpRight size={16} aria-hidden /></Link></RevealItem>
      </RevealGroup>
      <StartModesSection onChoose={chooseMode} />
      <SavedWorkSection />
      <RevealGroup as="section" className={styles.closing} aria-labelledby="start-heading">
        <RevealItem as="span" className={styles.sectionLabel}>Your next project starts with a conversation</RevealItem>
        <RevealItem as="h2" id="start-heading">Start a project<br />in LotusBuild.</RevealItem>
        <RevealItem as="p">A problem to solve. A tool to make.<br />Tell LotusBuild where you want to begin.</RevealItem>
        <RevealItem as="button" type="button" onClick={focusBrief} className="site-action">Describe your idea<ArrowUpRight size={17} aria-hidden /></RevealItem>
        <RevealItem as="span" className={styles.closingNote}>Plan the approach. Build. Review. Keep going.</RevealItem>
      </RevealGroup>
      <FooterSection />
    </main>
    <CookieBanner />
  </>
}
