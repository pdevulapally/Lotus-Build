"use client"
import { useState } from 'react'
import { Navbar } from '@/components/ui/navbar'
import { FooterSection } from '@/components/sections/footer-section'
import { CookieBanner } from '@/components/cookie-banner'
import { LandingHero, type BriefRequest } from './landing-hero'
import { LandingDemo } from './landing-demo'
import { CapabilitiesSection, ClosingSection, FeatureRowsSection, SavedWorkSection, StartModesSection, TrustSection } from './landing-sections'
import type { Brief, StartMode } from './landing-content'
import styles from './landing-page.module.css'

export function LandingPage() {
  const [request, setRequest] = useState<BriefRequest>({ id: 0 })
  const focusBrief = () => document.getElementById('project-brief')?.focus({ preventScroll: false })
  const chooseBrief = (brief: Brief) => setRequest((value) => ({ prompt: brief.prompt, mode: brief.mode, id: value.id + 1 }))
  const chooseMode = (mode: StartMode) => { setRequest((value) => ({ mode, id: value.id + 1 })); focusBrief() }
  return <>
    <main className={styles.page} data-landing-theme="dark">
      <Navbar />
      <LandingHero request={request} onBrief={chooseBrief} />
      <LandingDemo />
      <CapabilitiesSection />
      <FeatureRowsSection />
      <StartModesSection onChoose={chooseMode} />
      <SavedWorkSection />
      <TrustSection />
      <ClosingSection onStart={focusBrief} />
      <FooterSection />
    </main>
    <CookieBanner />
  </>
}
