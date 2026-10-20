"use client"
import Link from 'next/link'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ArrowRightIcon, CheckIcon, FilesIcon, GitBranchIcon, VersionsIcon } from '@/components/ui/lotus-icons'
import { capabilities, demoProject, featureRows, savedWork, startModes, trustPoints, type StartMode } from './landing-content'
import styles from './landing-sections.module.css'

export function CapabilitiesSection() {
  return (
    <section className={styles.capabilities} aria-label="What the workspace includes">
      <RevealGroup as="ul" className={styles.capabilityList} step={0.05}>
        {capabilities.map((item) => (
          <RevealItem as="li" key={item.label}>
            <span className={styles.capabilityIcon}><item.icon width={18} height={18} /></span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  )
}

export function FeatureRowsSection() {
  return (
    <section className={styles.features} aria-labelledby="features-heading">
      <div className={styles.featuresInner}>
        <Reveal className={styles.featuresIntro}>
          <h2 id="features-heading">The whole build.<br />One conversation.</h2>
          <p>No handoffs between a brief, a developer and a deploy. LotusBuild plans with you, builds in front of you and keeps everything it makes.</p>
          <Link href="/pricing" className="site-action">See plans and pricing<ArrowRightIcon width={16} height={16} /></Link>
        </Reveal>
        <RevealGroup as="ol" className={styles.rows} step={0.07}>
          {featureRows.map((row, index) => (
            <RevealItem as="li" key={row.title}>
              <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.rowText}><h3>{row.title}</h3><p>{row.copy}</p></span>
              <span className={styles.rowArrow}><ArrowRightIcon width={18} height={18} /></span>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  )
}

function PlanVisual() {
  return (
    <div className={styles.miniChat} aria-hidden>
      <p className={styles.miniUser}>{demoProject.prompt}</p>
      <p className={styles.miniQuestion}>{demoProject.question}</p>
      <div className={styles.miniOptions}>{demoProject.options.map((option) => <span key={option} data-selected={option === demoProject.selected || undefined}>{option}</span>)}</div>
    </div>
  )
}

function BuildVisual() {
  return (
    <ul className={styles.miniSteps} aria-hidden>
      {demoProject.buildSteps.map((step) => <li key={step.title}><span className={styles.miniMark}><CheckIcon width={11} height={11} /></span>{step.title}</li>)}
    </ul>
  )
}

const modeVisuals: Record<StartMode, () => React.JSX.Element> = { plan: PlanVisual, build: BuildVisual }

export function StartModesSection({ onChoose }: { onChoose: (mode: StartMode) => void }) {
  return (
    <section id="start" className={styles.modes} aria-labelledby="modes-heading">
      <div className={styles.modesInner}>
        <Reveal className={styles.modesStatement}>
          <p className={styles.eyebrowLight}>Two ways to start</p>
          <h2 id="modes-heading">Plan it first.<br />Or just build.</h2>
          <p>Either way it is one conversation and one project. Switch between the two whenever you like.</p>
        </Reveal>
        <RevealGroup className={styles.modeCards} step={0.1}>
          {startModes.map((option) => {
            const Visual = modeVisuals[option.mode]
            return (
              <RevealItem as="article" key={option.mode} className={styles.modeCard}>
                <div className={styles.modeVisual}><Visual /></div>
                <div className={styles.modeBody}>
                  <span className={styles.modeTag}>{option.tag}</span>
                  <h3>{option.title}</h3>
                  <p>{option.copy}</p>
                  <button type="button" onClick={() => onChoose(option.mode)}>{option.action}<ArrowRightIcon width={15} height={15} /></button>
                </div>
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
        <RevealItem as="article" className={`${styles.tile} ${styles.codeTile}`}>
          <div className={styles.tileText}><FilesIcon width={20} height={20} /><h3>Read what was built</h3><p>Browse every file and open the source right in your workspace.</p></div>
          <div className={styles.editor} aria-label="Illustrative code example">
            <div className={styles.editorBar}><span>booking / page.tsx</span><span>Example source</span></div>
            <div className={styles.editorBody}>
              <ul className={styles.tree} aria-hidden>
                {savedWork.files.map((file) => <li key={file.name} style={{ paddingLeft: `${file.depth * 12 + 10}px` }} data-active={file.active || undefined} data-folder={file.folder || undefined}>{file.name}</li>)}
              </ul>
              <pre className={styles.code} tabIndex={0} aria-label="Example source code, scroll horizontally to read">
                <code>{savedWork.code.map((line, index) => <span className={styles.codeLine} key={index}><span aria-hidden>{index + 1}</span>{line || '\u00a0'}</span>)}</code>
              </pre>
            </div>
          </div>
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}><VersionsIcon width={20} height={20} /><h3>Follow every change</h3><p>Compare saved versions and see exactly what changed.</p></div>
          <ol className={styles.versions} aria-hidden>
            {savedWork.versions.map((version) => <li key={version.label}><span>{version.label}</span><span className={styles.diff}><em>+{version.added}</em><b>−{version.removed}</b></span></li>)}
          </ol>
        </RevealItem>
        <RevealItem as="article" className={styles.tile}>
          <div className={styles.tileText}><GitBranchIcon width={20} height={20} /><h3>Real Git underneath</h3><p>Every project is a proper Git repository with a full commit history, not a black box.</p></div>
          <ol className={styles.commits} aria-hidden>
            {savedWork.commits.map((commit) => <li key={commit.hash}><code>{commit.hash}</code><span>{commit.message}</span></li>)}
          </ol>
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
              <span className={styles.trustIcon}><point.icon width={20} height={20} /></span>
              <h3>{point.title}</h3>
              <p>{point.copy}</p>
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
      <RevealItem as="h2" id="start-heading">What should we build?</RevealItem>
      <RevealItem as="p" className={styles.closingLead}>A problem to solve. A tool to make. Tell LotusBuild where you want to begin.</RevealItem>
      <RevealItem className={styles.closingActions}>
        <button type="button" onClick={onStart} className={styles.closingPrimary}>Describe your idea<ArrowRightIcon width={16} height={16} /></button>
        <Link href="/pricing" className={styles.closingSecondary}>View pricing</Link>
      </RevealItem>
    </RevealGroup>
  )
}
