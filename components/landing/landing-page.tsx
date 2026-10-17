"use client"
import { useState } from 'react'
import Link from 'next/link'
import { Menu, ArrowUpRight, FileCode2, History, Download, LayoutDashboard, Globe2, Users } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { BrandWordmark } from '@/components/ui/brand-wordmark'
import { CookieBanner } from '@/components/cookie-banner'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import styles from './landing-page.module.css'

const briefs = [
  { label: 'Team dashboard', icon: LayoutDashboard, prompt: 'Help me create a dashboard for my team. Ask about our tasks and the data we need before building.' },
  { label: 'Business website', icon: Globe2, prompt: 'Help me create a website for my business. Ask about the business, its audience, and the content first.' },
  { label: 'Customer portal', icon: Users, prompt: 'Help me plan a customer portal. Start by asking about the users, their tasks, and the information they need.' },
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
        <h1 id="landing-heading">Make your idea<br />something real.</h1>
        <p className={styles.intro}>Create a website or app with LotusBuild.<br />Start with a brief. Keep shaping it in one workspace.</p>
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
