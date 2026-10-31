"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDownIcon } from "@/components/ui/lotus-icons"

const BOTTOM_THRESHOLD = 48

export function ConversationScrollArea({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  const followingRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const updatePosition = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    const atBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= BOTTOM_THRESHOLD
    followingRef.current = atBottom
    setShowJump(!atBottom)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const observer = new ResizeObserver(() => {
      if (viewport.clientHeight === 0) return
      if (followingRef.current) viewport.scrollTop = viewport.scrollHeight
      updatePosition()
    })
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const jumpToLatest = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.focus({ preventScroll: true })
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    })
  }

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden" aria-label="Project chat">
      <section
        ref={viewportRef}
        tabIndex={0}
        onScroll={updatePosition}
        aria-label="Messages"
        className="chat-scrollbar h-full overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <section ref={contentRef} className="mx-auto w-full max-w-[792px] px-4 pb-8 pt-6 sm:px-6">
          {children}
        </section>
      </section>
      {showJump && (
        <button
          type="button"
          aria-label="Jump to latest message"
          title="Jump to latest message"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDownIcon className="size-5" />
        </button>
      )}
    </section>
  )
}
