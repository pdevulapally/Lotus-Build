'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { VoiceState } from '@/lib/voice/call'
import { voiceShaderSettings } from './voice-shader-settings'
import styles from './voice-orb.module.css'

const VoiceShaderScene = dynamic(() => import('./voice-shader-scene'), { ssr: false })

class OrbBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

/** Decorative state animation, never a simulated microphone volume meter. */
export function VoiceOrb({ state, muted }: { state: VoiceState; muted: boolean }) {
  const host = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const inCall = !['off', 'error', 'permission', 'connecting', 'reconnecting'].includes(state)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    const update = () => setVisible(inView && !motion.matches && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() })
    const lost = (event: Event) => { event.preventDefault(); setFailed(true) }
    observer.observe(element)
    motion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    element.addEventListener('webglcontextlost', lost, true)
    return () => {
      observer.disconnect(); motion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      element.removeEventListener('webglcontextlost', lost, true)
    }
  }, [])
  const animated = inCall && (state === 'speaking' || !muted) && visible && !failed
  return <span ref={host} className={styles.stage} aria-hidden="true" data-state={state} data-muted={muted} data-animated={animated}
    style={{ '--voice-orange': voiceShaderSettings.color1, '--voice-sand': voiceShaderSettings.color2, '--voice-lilac': voiceShaderSettings.color3 } as CSSProperties}>
    <span className={styles.orb}>
      <span className={styles.fallback} />
      {animated && <OrbBoundary><VoiceShaderScene /></OrbBoundary>}
      <span className={styles.glass} />
      <span className={styles.fold} />
    </span>
  </span>
}
