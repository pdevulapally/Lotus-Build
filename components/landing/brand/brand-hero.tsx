'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { shaderSettings } from './shader-settings'
import styles from './brand-hero.module.css'

const ShaderScene = dynamic(() => import('./shader-scene'), { ssr: false })

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

/** Decorative client-only shader; the composer is an independent foreground surface. */
export function BrandHero() {
  const host = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    const update = () => setActive(inView && !preference.matches && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() })
    const lost = (event: Event) => { event.preventDefault(); setFailed(true) }
    observer.observe(element)
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    element.addEventListener('webglcontextlost', lost, true)
    return () => {
      observer.disconnect()
      preference.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      element.removeEventListener('webglcontextlost', lost, true)
    }
  }, [])
  return <div ref={host} className={styles.scene} aria-hidden="true" data-shader-active={active && !failed}
    style={{ '--shader-ink': shaderSettings.color1, '--shader-mid': shaderSettings.color2, '--shader-highlight': shaderSettings.color3 } as CSSProperties}>
    <div className={styles.fallback} />
    {active && !failed && <SceneBoundary onFailure={() => setFailed(true)}><ShaderScene /></SceneBoundary>}
    <div className={styles.scrim} />
  </div>
}
