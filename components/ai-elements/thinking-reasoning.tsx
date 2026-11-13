"use client"

import { useEffect, useRef, useState } from "react"
import { ReasoningBlocks } from "@/components/ai-elements/reasoning"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"
import styles from "./thinking-reasoning.module.css"

// Geometry — keep in sync with the CSS: the viewport grows with the thought up
// to this height, then the newest lines show behind a soft fade.
const MAX_H = 180
const FADE = 16
export const THINKING_REVEAL_INTERVAL_MS = 42

/**
 * Keep the thought readable even when the provider delivers a large chunk at
 * once. One Unicode code point per tick is roughly normal reading speed, while
 * the agent and the network continue at full speed behind this display buffer.
 */
export function nextThinkingText(visible: string, target: string): string {
  if (!target.startsWith(visible)) return target
  const next = Array.from(target.slice(visible.length))[0]
  return next === undefined ? visible : visible + next
}

function useThinkingText(text: string, streaming: boolean): string {
  const initial = streaming ? "" : text
  const [visible, setVisible] = useState(initial)
  const visibleRef = useRef(initial)
  const targetRef = useRef(text)
  targetRef.current = text

  useEffect(() => {
    if (!streaming) {
      visibleRef.current = targetRef.current
      setVisible(targetRef.current)
      return
    }

    const reduceMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      visibleRef.current = targetRef.current
      setVisible(targetRef.current)
      return
    }

    const timer = window.setInterval(() => {
      const next = nextThinkingText(visibleRef.current, targetRef.current)
      if (next === visibleRef.current) return
      visibleRef.current = next
      setVisible(next)
    }, THINKING_REVEAL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [streaming])

  return visible
}

/** "12s" from the server's own timestamps; nothing when the end was never recorded. */
export function thoughtDuration(startedAt: string, completedAt?: string): string | undefined {
  if (completedAt === undefined) return undefined
  const ms = Date.parse(completedAt) - Date.parse(startedAt)
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return `${Math.max(1, Math.round(ms / 1000))}s`
}

/**
 * One step's streamed reasoning. Open while it streams, with the newest lines
 * kept in view; when the step moves on it folds into "Thought for Ns", which
 * the user can open again. A thought that arrives already finished starts folded.
 */
export function ThinkingReasoning({ text, streaming, startedAt, completedAt, className }: {
  text: string
  streaming: boolean
  startedAt: string
  completedAt?: string
  className?: string
}) {
  const visibleText = useThinkingText(text, streaming)
  const [open, setOpen] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const [fade, setFade] = useState({ top: false, bottom: true })
  const viewportRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<HTMLDivElement>(null)
  const wasStreaming = useRef(streaming)

  useEffect(() => {
    if (wasStreaming.current && !streaming) setOpen(false)
    wasStreaming.current = streaming
  }, [streaming])

  useEffect(() => {
    const element = streamRef.current
    if (!element) return
    const measure = () => setContentHeight(element.scrollHeight)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [visibleText])

  const expanded = streaming || open
  const capped = contentHeight > MAX_H
  const viewportHeight = Math.min(contentHeight, MAX_H)
  const scrollable = !streaming && open
  const translate = scrollable || !capped ? 0 : MAX_H - FADE - contentHeight
  const showTop = scrollable ? fade.top : capped
  const showBottom = scrollable ? fade.bottom : capped
  const mask = capped
    ? `linear-gradient(to bottom, transparent 0, #000 ${showTop ? FADE : 0}px, #000 calc(100% - ${showBottom ? FADE : 0}px), transparent 100%)`
    : undefined
  const duration = thoughtDuration(startedAt, completedAt)

  const onScroll = () => {
    const element = viewportRef.current
    if (!element) return
    setFade({ top: element.scrollTop > 1, bottom: element.scrollTop + element.clientHeight < element.scrollHeight - 1 })
  }

  const toggle = () => {
    if (!open) {
      setFade({ top: false, bottom: true })
      if (viewportRef.current) viewportRef.current.scrollTop = 0
    }
    setOpen(!open)
  }

  return (
    <div className={cn(styles.block, className)} data-thinking={streaming ? "streaming" : "done"}>
      <button
        type="button"
        className={cn(styles.header, !streaming && styles.clickable)}
        aria-expanded={expanded}
        aria-label={streaming ? "Thinking" : "Toggle thought process"}
        onClick={streaming ? undefined : toggle}
      >
        {streaming ? (
          <Shimmer className={cn(styles.label, "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground")}>Thinking…</Shimmer>
        ) : (
          <span className={styles.label}>
            <span className={styles.verb}>Thought</span>{duration === undefined ? " process" : ` for ${duration}`}
          </span>
        )}
        {!streaming && (
          <svg className={styles.chevron} viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className={cn(styles.collapsible, !expanded && styles.collapsed)}>
        <div className={styles.inner}>
          <div
            ref={viewportRef}
            className={cn(styles.viewport, scrollable && styles.scroll)}
            style={{ height: `${viewportHeight}px`, WebkitMaskImage: mask, maskImage: mask }}
            onScroll={scrollable ? onScroll : undefined}
          >
            <div ref={streamRef} className={styles.stream} style={{ transform: `translateY(${translate}px)` }}>
              <ReasoningBlocks text={visibleText} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
