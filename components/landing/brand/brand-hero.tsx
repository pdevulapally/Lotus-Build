'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BrandScene } from './scene'
import styles from './brand-hero.module.css'

export function BrandHero() {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const runtime = useRef<BrandScene | null>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)
  const hintId = useId()

  useEffect(() => {
    const element = host.current, surface = canvas.current
    if (!element || !surface) return
    const controller = new AbortController()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let cancelled = false, loading = false, inView = false, failed = false
    const clear = () => { runtime.current?.dispose(); runtime.current = null; setReady(false) }
    const load = async () => {
      if (cancelled || loading || failed || motion.matches || !inView || runtime.current) return
      loading = true
      try {
        const { createBrandScene } = await import('./scene')
        if (cancelled || motion.matches) return
        const scene = await createBrandScene(surface, controller.signal, () => { failed = true; clear() })
        if (cancelled || motion.matches) { scene.dispose(); return }
        runtime.current = scene; scene.visible(inView); setReady(true)
      } catch { if (!cancelled) { failed = true; clear() } } finally { loading = false }
    }
    const preferenceChanged = () => { if (motion.matches) clear(); else void load() }
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; runtime.current?.visible(inView); if (inView) void load() }, { rootMargin: '100px' })
    observer.observe(element)
    motion.addEventListener('change', preferenceChanged)
    return () => { cancelled = true; controller.abort(); observer.disconnect(); motion.removeEventListener('change', preferenceChanged); runtime.current?.dispose(); runtime.current = null }
  }, [])

  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id === event.pointerId) {
      runtime.current?.turn((event.clientY - drag.current.y) * .004, (event.clientX - drag.current.x) * .004)
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    } else if (event.pointerType === 'mouse') {
      const bounds = event.currentTarget.getBoundingClientRect()
      runtime.current?.point((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1)
    }
  }
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const steps: Record<string, [number, number]> = { ArrowLeft: [0, -.15], ArrowRight: [0, .15], ArrowUp: [-.1, 0], ArrowDown: [.1, 0] }
    if (event.key in steps) { event.preventDefault(); runtime.current?.turn(...steps[event.key]) }
    if (event.key === 'Home' || event.key === 'Escape') { event.preventDefault(); runtime.current?.reset() }
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.stage} ref={host} data-ready={ready}>
        {/* Always present: SSR, reduced motion, loading and unsupported WebGL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.fallback} src="/Images/lotusbuild-icon.svg" width="841" height="708" alt="LotusBuild brand mark" aria-hidden={ready} />
        <canvas ref={canvas} className={styles.canvas} tabIndex={ready ? 0 : -1} aria-hidden={!ready} role="img" aria-label="Silver three-dimensional LotusBuild mark. Arrow keys rotate; Home resets." aria-describedby={hintId}
          onPointerDown={event => { if (!ready || !event.isPrimary || event.button !== 0 || drag.current) return; drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) drag.current = null }}
          onPointerLeave={() => { if (!drag.current) runtime.current?.reset() }} onKeyDown={keyboard} />
      </div>
      <figcaption className={styles.caption}>
        <span id={hintId}>{ready ? 'Move to light. Drag to turn.' : 'The LotusBuild mark.'}</span>
        {ready && <div className={styles.controls} role="group" aria-label="Rotate the brand mark">
          <button type="button" aria-label="Turn logo left" onClick={() => runtime.current?.turn(0, -.15)}>←</button>
          <button type="button" onClick={() => runtime.current?.reset()}>Reset</button>
          <button type="button" aria-label="Turn logo right" onClick={() => runtime.current?.turn(0, .15)}>→</button>
        </div>}
      </figcaption>
    </figure>
  )
}
