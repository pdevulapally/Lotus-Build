"use client"
import Link from 'next/link'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ArrowRightIcon } from '@/components/ui/lotus-icons'
import { startModes, trustPoints, type StartMode } from './landing-content'
import { BookingVisual, BriefVisual, GitVisual, ProjectStoryVisual, SourceVisual, VersionsVisual } from './landing-product-visuals'
import styles from './landing-sections.module.css'

export function FeatureRowsSection() {
  return (
    <section className={styles.features} aria-labelledby="features-heading">
      <div className={styles.featuresInner}>
        <Reveal className={styles.featuresIntro}>
          <h2 id="features-heading">The whole build. One conversation.</h2>
          <p>Plan, build and refine in the same workspace, with your files and saved versions close at hand.</p>
        </Reveal>
        <Reveal className={styles.featureSurface}><ProjectStoryVisual /></Reveal>
        <Reveal className={styles.featuresFooter}>
          <Link href="/pricing" className={styles.featuresLink}>See plans and pricing<ArrowRightIcon width={16} height={16} aria-hidden /></Link>
        </Reveal>
      </div>
    </section>
  )
}

const modeVisuals: Record<StartMode, () => React.JSX.Element> = { plan: BriefVisual, build: BookingVisual }

export function StartModesSection({ onChoose }: { onChoose: (mode: StartMode) => void }) {
  return (
    <section id="start" className={styles.modes} aria-labelledby="modes-heading">
      <div className={styles.modesInner}>
        <Reveal className={styles.modesStatement}>
          <p className={styles.eyebrowLight}>Two ways to start</p>
          <h2 id="modes-heading">Plan it first. Or just build.</h2>
          <p>Either way it is one conversation and one project. Switch between the two whenever you like.</p>
        </Reveal>
        <RevealGroup className={styles.modeCards} step={0.1}>
          {startModes.map((option) => {
            const Visual = modeVisuals[option.mode]
            return (
              <RevealItem as="article" key={option.mode} className={styles.modeCard}>
                <div className={styles.modeBody}>
                  <span className={styles.modeTag}>{option.tag}</span>
                  <h3>{option.title}</h3>
                  <p>{option.copy}</p>
                  <button type="button" onClick={() => onChoose(option.mode)}>{option.action}<ArrowRightIcon width={15} height={15} /></button>
                </div>
                <div className={styles.modeVisual}><Visual /></div>
              </RevealItem>
            )
          })}
        </RevealGroup>
      </div>
    </section>
  )
}

export function SavedWorkSection() {
  return (
    <section id="saved-work" className={styles.saved} aria-labelledby="saved-heading">
      <Reveal as="header" className={styles.savedHeader}>
        <p className={styles.eyebrow}>Your work, always yours</p>
        <h2 id="saved-heading">See the code. Keep every version.</h2>
        <p>Everything LotusBuild makes is saved to your project, ready to inspect and compare, with real Git history underneath.</p>
      </Reveal>
      <RevealGroup className={styles.bento} step={0.08}>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}><h3>Read what was built</h3><p>Browse every file and open the source right in your workspace.</p></div>
          <SourceVisual />
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}><h3>Follow every change</h3><p>Compare saved versions and see exactly what changed.</p></div>
          <VersionsVisual />
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}><h3>Real Git underneath</h3><p>Every project is a proper Git repository with a full commit history, not a black box.</p></div>
          <GitVisual />
          <span className={styles.soon}>GitHub connection coming soon</span>
        </RevealItem>
      </RevealGroup>
    </section>
  )
}

export function TrustSection() {
  return (
    <section className={styles.trust} aria-labelledby="trust-heading">
      <div className={styles.trustInner}>
        <Reveal className={styles.trustIntro}>
          <p className={styles.eyebrow}>Built for serious use</p>
          <h2 id="trust-heading">Ready for your business from day one.</h2>
        </Reveal>
        <RevealGroup as="ul" className={styles.trustList} step={0.08}>
          {trustPoints.map((point) => (
            <RevealItem as="li" key={point.title}>
              <header className={styles.trustPointHeader}><point.icon width={20} height={20} /><h3>{point.title}</h3></header>
              <p>{point.copy}</p>
              <Link className={styles.trustPointLink} href={point.href}>{point.linkLabel}</Link>
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal className={styles.trustLinks}><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help centre</Link></Reveal>
      </div>
    </section>
  )
}

export function ClosingSection({ onStart }: { onStart: () => void }) {
  return (
    <RevealGroup as="section" className={styles.closing} aria-labelledby="start-heading">
      <RevealItem as="p" className={styles.eyebrowLight}>Your next project starts with a conversation</RevealItem>
      <RevealItem as="h2" id="start-heading">Start a project in LotusBuild.</RevealItem>
      <RevealItem as="p" className={styles.closingLead}>A problem to solve. A tool to make. Tell LotusBuild where you want to begin.</RevealItem>
      <RevealItem className={styles.closingActions}>
        <button type="button" onClick={onStart} className={styles.closingPrimary}>Describe your idea<ArrowRightIcon width={16} height={16} /></button>
        <Link href="/pricing" className={styles.closingSecondary}>View pricing</Link>
      </RevealItem>
    </RevealGroup>
  )
}
