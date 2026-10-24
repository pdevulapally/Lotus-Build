"use client"
import { useState } from 'react'
import { motion } from 'framer-motion'
import { TaskEntry } from './task-entry'
import { BrandHero } from './brand/brand-hero'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { spring } from '@/lib/motion'
import { heroCategories, showcaseTiles, type Brief, type HeroCategoryKey } from './landing-content'
import { showcaseVisuals } from './showcase-tiles'
import styles from './landing-hero.module.css'

export type BriefRequest = { prompt?: string; mode?: Brief['mode']; id: number }

export function LandingHero({ request, onBrief }: { request: BriefRequest; onBrief: (brief: Brief) => void }) {
  const [categoryKey, setCategoryKey] = useState<HeroCategoryKey | null>(null)
  const chooseCategory = (category: (typeof heroCategories)[number]) => {
    setCategoryKey(category.key)
    onBrief(category)
  }

  return (
    <section className={styles.hero} aria-labelledby="landing-heading">
      <BrandHero />
      <RevealGroup className={styles.inner} animateOnMount>
        <RevealItem as="h1" id="landing-heading">What should we build today?</RevealItem>
        <RevealItem as="p" className={styles.intro}>
          Websites, apps and internal tools for your business. LotusBuild asks the right questions, plans it with you, then builds it while you watch.
        </RevealItem>
        <RevealItem className={styles.composer}>
          <TaskEntry suggestedPrompt={request.prompt} />
        </RevealItem>
        <RevealItem className={styles.categories} role="group" aria-label="Start from a type of project">
          {heroCategories.map((entry) => {
            const active = entry.key === categoryKey
            return (
              <button key={entry.key} type="button" aria-pressed={active} onClick={() => chooseCategory(entry)} data-active={active || undefined}>
                {active && <motion.span layoutId="hero-category" className={styles.categoryPill} transition={spring} />}
                <span className={styles.categoryLabel}><entry.icon width={14} height={14} />{entry.label}</span>
              </button>
            )
          })}
        </RevealItem>
      </RevealGroup>

      <div className={styles.showcase}>
        <RevealGroup as="ul" className={styles.tiles} aria-label="Example builds" animateOnMount delayChildren={0.35} step={0.08}>
          {showcaseTiles.map((tile) => {
            const Visual = showcaseVisuals[tile.kind]
            return (
              <RevealItem as="li" key={tile.title} className={styles.tile} data-tone={tile.tone} data-dimmed={(categoryKey !== null && tile.category !== categoryKey) || undefined}>
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
