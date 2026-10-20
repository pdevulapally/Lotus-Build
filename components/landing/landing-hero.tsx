"use client"
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { ArrowRightIcon } from '@/components/ui/lotus-icons'
import { duration, ease, spring } from '@/lib/motion'
import { heroCategories, showcaseTiles, type Brief } from './landing-content'
import { showcaseVisuals } from './showcase-tiles'
import styles from './landing-hero.module.css'

export type BriefRequest = { prompt?: string; mode?: Brief['mode']; id: number }

const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: duration.fast, ease },
}

export function LandingHero({ request, onBrief }: { request: BriefRequest; onBrief: (brief: Brief) => void }) {
  const [categoryKey, setCategoryKey] = useState<string>(heroCategories[0].key)
  const category = heroCategories.find((entry) => entry.key === categoryKey) ?? heroCategories[0]

  return (
    <section className={styles.hero} aria-labelledby="landing-heading">
      <div className={styles.grid} aria-hidden />
      <RevealGroup className={styles.inner} animateOnMount>
        <RevealItem as="h1" id="landing-heading">Build software<br />by describing it.</RevealItem>
        <RevealItem as="p" className={styles.intro}>
          Websites, apps and internal tools for your business. LotusBuild asks the right questions, plans it with you, then builds it while you watch.
        </RevealItem>
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
        <RevealItem className={styles.categories} role="tablist" aria-label="What are you building?">
          {heroCategories.map((entry) => {
            const active = entry.key === category.key
            return (
              <button key={entry.key} type="button" role="tab" aria-selected={active} onClick={() => setCategoryKey(entry.key)} data-active={active || undefined}>
                {active && <motion.span layoutId="hero-category" className={styles.categoryPill} transition={spring} />}
                <span className={styles.categoryLabel}><entry.icon width={14} height={14} />{entry.label}</span>
              </button>
            )
          })}
        </RevealItem>
        <RevealItem className={styles.briefRow}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={category.key} className={styles.briefs} role="group" aria-label={`Example ${category.label.toLowerCase()} briefs`} {...swap}>
              {category.briefs.map((brief) => (
                <button key={brief.label} type="button" onClick={() => onBrief(brief)}>
                  {brief.label}<ArrowRightIcon width={13} height={13} />
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </RevealItem>
      </RevealGroup>

      <div className={styles.showcase}>
        <RevealGroup as="ul" className={styles.tiles} aria-label="Example builds" animateOnMount delayChildren={0.35} step={0.08}>
          {showcaseTiles.map((tile) => {
            const Visual = showcaseVisuals[tile.kind]
            return (
              <RevealItem as="li" key={tile.title} className={styles.tile} data-tone={tile.tone}>
                <button type="button" onClick={() => onBrief({ label: tile.caption, mode: tile.mode, prompt: tile.prompt })} aria-label={`Start a ${tile.caption.toLowerCase()} like this`}>
                  <span className={styles.tileHead}><strong>{tile.title}</strong><small>{tile.caption}</small></span>
                  <Visual />
                </button>
              </RevealItem>
            )
          })}
        </RevealGroup>
        <p className={styles.showcaseNote}>Example builds. Pick one to start from it.</p>
      </div>
    </section>
  )
}
