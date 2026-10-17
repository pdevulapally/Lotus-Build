"use client"
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, FileCode2, History, Download, ListChecks, Code2, Wrench } from 'lucide-react'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { Navbar } from '@/components/ui/navbar'
import { FooterSection } from '@/components/sections/footer-section'
import { CookieBanner } from '@/components/cookie-banner'
import styles from './landing-page.module.css'

const briefs = [
  { label: 'Plan a project', icon: ListChecks, prompt: 'Help me plan a software project. Ask about the problem, the users, and the requirements before proposing an approach.' },
  { label: 'Build a feature', icon: Code2, prompt: 'Help me build a software feature. Start by asking what it should do, its inputs and outputs, and how we should verify it.' },
  { label: 'Create a tool', icon: Wrench, prompt: 'Help me create a software tool for a repetitive task. Ask about the workflow, its inputs, and the expected results first.' },
]
export function LandingPage() {
  const [request, setRequest] = useState<{ prompt?: string; mode?: 'build' | 'plan'; id: number }>({ id: 0 })
  const focusBrief = () => document.getElementById('project-brief')?.focus({ preventScroll: false })
  const chooseMode = (mode: 'build' | 'plan') => { setRequest((value) => ({ mode, id: value.id + 1 })); focusBrief() }
  return <>
    <main className={styles.page}>
      <Navbar />
      <section className={styles.hero} aria-labelledby="landing-heading">
        <p className={styles.eyebrow}>AI software workspace</p>
        <h1 id="landing-heading">A workspace for<br />building software.</h1>
        <p className={styles.intro}>Plan the approach. Implement the changes.<br /> Review the code and keep building.</p>
        <div className={styles.heroActions}><button type="button" className="site-action" onClick={focusBrief}>Write your brief<ArrowUpRight size={16} /></button><Link href="#workflow" className={styles.secondary}>How it works<ArrowUpRight size={16} /></Link></div>
        <div className={styles.composer}>
            <AnimatedAIInput suggestedPrompt={request.id === 0 ? undefined : request.prompt} promptRequestId={request.id} suggestedMode={request.mode} inputId="project-brief" portalClassName={styles.popover}
            placeholder="Tell LotusBuild what you have in mind…"
            wrapperClassName="rounded-2xl border-border bg-card shadow-none [&_textarea]:min-h-[106px] [&_textarea]:text-base [&_textarea]:placeholder:text-muted-foreground"
            footerHintsClassName={styles.inputHint} />
        </div>
        <div className={styles.briefs} aria-label="Starting briefs">{briefs.map((brief) => <button key={brief.label} type="button" onClick={() => setRequest((value) => ({ prompt: brief.prompt, id: value.id + 1 }))}><brief.icon size={15} strokeWidth={1.7} />{brief.label}</button>)}</div>

      </section>
      <section id="workflow" className={styles.workflow} aria-labelledby="workflow-heading">
        <p className={styles.sectionLabel}>From intention to implementation</p>
        <h2 id="workflow-heading">Choose how you start.</h2>
        <p className={styles.sectionIntro}>Think it through together, or get straight to the work. One project, two ways forward.</p>
        <div className={styles.workflowRows}>
          <article><span className={styles.number}>01 / PLAN</span><ListChecks size={32} strokeWidth={1.2} aria-hidden /><h3>Make room for the thinking.</h3><p>Work through requirements, ask questions, and agree on an approach before making changes.</p><button type="button" onClick={() => chooseMode('plan')}>Start in Plan<ArrowUpRight size={16} aria-hidden /></button></article>
          <article><span className={styles.number}>02 / BUILD</span><Code2 size={32} strokeWidth={1.2} aria-hidden /><h3>Put the approach to work.</h3><p>Implement your brief, review what changes, and keep refining through the project conversation.</p><button type="button" onClick={() => chooseMode('build')}>Start in Build<ArrowUpRight size={16} aria-hidden /></button></article>
        </div>
      </section>
      <section id="saved-work" className={styles.saved} aria-labelledby="saved-heading">
        <p className={styles.sectionLabel}>The work stays yours to inspect</p>
        <h2 id="saved-heading">Open the code.<br />See the changes.</h2>
        <p className={styles.sectionIntro}>A conversation is only part of the project. Stay close to the source and the work saved along the way.</p>
        <div className={styles.savedItems}>
          <article><span className={styles.artifactIcon}><FileCode2 size={38} strokeWidth={1.2} aria-hidden /></span><span className={styles.number}>SOURCE</span><h3>Read what was built.</h3><p>Browse saved files and open the source in your workspace.</p></article>
          <article><span className={styles.artifactIcon}><History size={38} strokeWidth={1.2} aria-hidden /></span><span className={styles.number}>HISTORY</span><h3>Follow the changes.</h3><p>Review saved versions and compare the differences between them.</p></article>
          <article><span className={styles.artifactIcon}><Download size={38} strokeWidth={1.2} aria-hidden /></span><span className={styles.number}>DOWNLOAD</span><h3>Take your work with you.</h3><p>Download your saved project as a ZIP from the workspace.</p></article>
        </div>
      </section>
      <section className={styles.closing} aria-labelledby="start-heading">
        <span className={styles.sectionLabel}>Your next project starts with a conversation</span>
        <h2 id="start-heading">Start a project<br />in LotusBuild.</h2>
        <p>A problem to solve. A tool to make.<br />Tell LotusBuild where you want to begin.</p>
        <button type="button" onClick={focusBrief} className="site-action">Write your brief<ArrowUpRight size={17} aria-hidden /></button>
        <span className={styles.closingNote}>Plan the approach. Build. Review. Keep going.</span>
      </section>
      <FooterSection />
    </main>
    <CookieBanner />
  </>
}
