"use client"
import { useState } from 'react'
import { motion } from 'framer-motion'
import useEmblaCarousel from 'embla-carousel-react'
import { AnimatedAIInput } from '@/components/ui/animated-ai-input'
import { BrandHero } from './brand/brand-hero'
import { RevealGroup, RevealItem } from '@/components/ui/reveal'
import { spring } from '@/lib/motion'
import { heroCategories, showcaseTiles, type Brief, type HeroCategoryKey } from './landing-content'
import { showcaseVisuals } from './showcase-tiles'
import styles from './landing-hero.module.css'

export type BriefRequest = { prompt?: string; mode?: Brief['mode']; id: number }

export function LandingHero({ request, onBrief }: { request: BriefRequest; onBrief: (brief: Brief) => void }) {
  const [showcaseRef] = useEmblaCarousel({
    align: 'start', dragFree: true, containScroll: 'trimSnaps',
    breakpoints: { '(max-width: 760px)': { active: false } },
  })
  const [categoryKey, setCategoryKey] = useState<HeroCategoryKey | null>(null)
  const chooseCategory = (category: (typeof heroCategories)[number]) => {
    setCategoryKey(category.key)
    onBrief(category)
  }

  return (
    <section className={styles.hero} data-landing-hero aria-labelledby="landing-heading">
      <BrandHero />
      <RevealGroup className={styles.inner} animateOnMount>
        <RevealItem as="h1" id="landing-heading">What should we build today?</RevealItem>
        <RevealItem className={styles.composer}>
          <AnimatedAIInput suggestedPrompt={request.id === 0 ? undefined : request.prompt} promptRequestId={request.id} suggestedMode={request.mode} appearance="assistant" inputId="project-brief" portalClassName={styles.popover} />
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
        <section ref={showcaseRef} className={styles.tileViewport} aria-label="Browse example builds">
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
        </section>
        <p className={styles.showcaseNote}>Example builds. Pick one to start from it.</p>
      </div>
    </section>
  )
}
