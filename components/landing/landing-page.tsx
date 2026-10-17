"use client"
import { useState } from 'react'
import Link from 'next/link'
import { Menu, ArrowUpRight, FileCode2, History, Download, ListChecks, Code2, Wrench } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { BrandWordmark } from '@/components/ui/brand-wordmark'
import { CookieBanner } from '@/components/cookie-banner'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import styles from './landing-page.module.css'

const briefs = [
  { label: 'Plan a project', icon: ListChecks, prompt: 'Help me plan a software project. Ask about the problem, the users, and the requirements before proposing an approach.' },
  { label: 'Build a feature', icon: Code2, prompt: 'Help me build a software feature. Start by asking what it should do, its inputs and outputs, and how we should verify it.' },
  { label: 'Create a tool', icon: Wrench, prompt: 'Help me create a software tool for a repetitive task. Ask about the workflow, its inputs, and the expected results first.' },
]
const links = [{ href: '#workflow', label: 'How it works' }, { href: '#saved-work', label: 'Your work' }, { href: '/pricing', label: 'Pricing' }, { href: '/help', label: 'Help' }]
export function LandingPage() {
  const { user } = useAuth()
  const [request, setRequest] = useState<{ prompt?: string; mode?: 'build' | 'plan'; id: number }>({ id: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const focusBrief = () => document.getElementById('project-brief')?.focus({ preventScroll: false })
  const chooseMode = (mode: 'build' | 'plan') => { setRequest((value) => ({ mode, id: value.id + 1 })); focusBrief() }
  return <>
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/welcome" aria-label="LotusBuild home"><BrandWordmark /></Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">{links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
        <div className={styles.account}>{!user && <Link href="/login" className={styles.login}>Log in</Link>}<Link className={styles.primary} href={user ? '/' : '/signup'}>{user ? 'Open workspace' : 'Start building'}<ArrowUpRight size={15} /></Link>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetTrigger asChild><button className={styles.mobileMenu} aria-label="Open navigation"><Menu size={22} /></button></SheetTrigger><SheetContent side="right" className={`border-border bg-background ${styles.popover}`}><SheetTitle>LotusBuild</SheetTitle><nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-6">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}<Link href="/login">Log in</Link></nav></SheetContent></Sheet>
        </div>
      </header>
      <section className={styles.hero} aria-labelledby="landing-heading">
        <p className={styles.eyebrow}>AI software workspace</p>
        <h1 id="landing-heading">A workspace for<br />building software.</h1>
        <p className={styles.intro}>Plan the approach. Implement the changes.<br /> Review the code and keep building.</p>
        <div className={styles.heroActions}><button type="button" className={styles.primary} onClick={focusBrief}>Write your brief<ArrowUpRight size={16} /></button><Link href="#workflow" className={styles.secondary}>How it works<ArrowUpRight size={16} /></Link></div>
        <div className={styles.composer}>
            <AnimatedAIInput suggestedPrompt={request.id === 0 ? undefined : request.prompt} promptRequestId={request.id} suggestedMode={request.mode} inputId="project-brief" portalClassName={styles.popover}
            placeholder="Tell LotusBuild what you have in mind…"
            wrapperClassName="rounded-2xl border-border bg-card shadow-none [&_textarea]:min-h-[106px] [&_textarea]:text-base [&_textarea]:placeholder:text-muted-foreground"
            footerHintsClassName={styles.inputHint} />
        </div>
        <div className={styles.briefs} aria-label="Starting briefs">{briefs.map((brief) => <button key={brief.label} type="button" onClick={() => setRequest((value) => ({ prompt: brief.prompt, id: value.id + 1 }))}><brief.icon size={15} strokeWidth={1.7} />{brief.label}</button>)}</div>

      </section>
      <section id="workflow" className={styles.workflow} aria-labelledby="workflow-heading">
        <div><h2 id="workflow-heading">Choose how<br />you start.</h2><p>Work through the approach first, or start creating. Your conversation stays with the project as it develops.</p></div>
        <div className={styles.workflowRows}>
          <article><div><h3>Plan it first</h3><p>Explore the requirements and approach before making changes to your project.</p></div><button type="button" onClick={() => chooseMode('plan')}>Start in Plan<ArrowUpRight size={15} /></button></article>
          <article><div><h3>Start building</h3><p>Turn your brief into a project, then use the conversation to keep refining it.</p></div><button type="button" onClick={() => chooseMode('build')}>Start in Build<ArrowUpRight size={15} /></button></article>
        </div>
      </section>
      <section id="saved-work" className={styles.saved} aria-labelledby="saved-heading">
        <div className={styles.savedHeader}><h2 id="saved-heading">Open the code.<br />See the changes.</h2><p>Your saved work is part of the workspace. Read it, compare it, and download it when you need it.</p></div>
        <div className={styles.savedItems}><article><FileCode2 size={25} strokeWidth={1.5} /><h3>Source files</h3><p>Browse saved project files and open the code behind your project.</p></article><article><History size={25} strokeWidth={1.5} /><h3>Saved versions</h3><p>Review saved versions and the differences between them.</p></article><article><Download size={25} strokeWidth={1.5} /><h3>Project download</h3><p>Download the saved project as a ZIP from your workspace.</p></article></div>
      </section>
      <section className={styles.closing}><div><h2>Start a project<br />in LotusBuild.</h2><p>Describe it. Choose Plan or Build. Keep going from there.</p></div><button type="button" onClick={focusBrief} className={styles.primary}>Write your brief<ArrowUpRight size={17} /></button></section>
      <footer className={styles.footer}><Link href="/welcome" aria-label="LotusBuild home"><BrandWordmark /></Link><div><Link href="/pricing">Pricing</Link><Link href="/help">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div><span>© {new Date().getFullYear()} LotusBuild</span></footer>
    </main>
    <CookieBanner />
  </>
}
