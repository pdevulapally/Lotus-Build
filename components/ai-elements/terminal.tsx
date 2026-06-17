"use client"

import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { Copy, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Context ────────────────────────────────────────────────────────────────────

type TerminalCtx = {
  output: string
  isStreaming: boolean
  onClear?: () => void
  autoScroll: boolean
  scrollRef: React.RefObject<HTMLDivElement>
}

const Ctx = createContext<TerminalCtx | null>(null)

function useTerminal() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("Terminal sub-components must be used inside <Terminal>")
  return ctx
}

// ── ANSI parser ────────────────────────────────────────────────────────────────

type Seg = { text: string; color?: string; bold?: boolean }

const ANSI_COLORS: Record<number, string> = {
  30: "#4b5563",
  31: "#f87171",
  32: "#4ade80",
  33: "#fbbf24",
  34: "#60a5fa",
  35: "#c084fc",
  36: "#22d3ee",
  37: "#f1f5f9",
  90: "#6b7280",
  91: "#f87171",
  92: "#4ade80",
  93: "#fbbf24",
  94: "#60a5fa",
  95: "#c084fc",
  96: "#22d3ee",
  97: "#ffffff",
}

function parseAnsi(raw: string): Seg[] {
  const result: Seg[] = []
  const parts = raw.split(/(\[[0-9;]+m)/)
  let color: string | undefined
  let bold = false

  for (const part of parts) {
    const esc = part.match(/^\[([0-9;]+)m$/)
    if (esc) {
      for (const code of esc[1].split(";").map(Number)) {
        if (code === 0) { color = undefined; bold = false }
        else if (code === 1) bold = true
        else if (ANSI_COLORS[code]) color = ANSI_COLORS[code]
      }
    } else if (part) {
      result.push({ text: part, color, bold })
    }
  }
  return result
}

function renderAnsi(output: string): React.ReactNode {
  return output.split("\n").map((line, i) => (
    <div key={i} className="whitespace-pre-wrap break-all min-h-[1em]">
      {parseAnsi(line).map((seg, j) => (
        <span key={j} style={{ color: seg.color, fontWeight: seg.bold ? 700 : undefined }}>
          {seg.text}
        </span>
      ))}
    </div>
  ))
}

// ── Components ─────────────────────────────────────────────────────────────────

export function Terminal({
  children,
  output = "",
  isStreaming = false,
  onClear,
  autoScroll = true,
  className,
}: {
  children: React.ReactNode
  output?: string
  isStreaming?: boolean
  onClear?: () => void
  autoScroll?: boolean
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <Ctx.Provider value={{ output, isStreaming, onClear, autoScroll, scrollRef }}>
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-zinc-700/60 bg-[#0d0d0d] font-mono",
          className
        )}
      >
        {children}
      </div>
    </Ctx.Provider>
  )
}

export function TerminalHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-zinc-700/60 bg-zinc-900/80 px-3 py-2",
        className
      )}
    >
      {children}
    </div>
  )
}

export function TerminalTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider text-zinc-400", className)}>
      {children}
    </span>
  )
}

export function TerminalStatus({ className }: { className?: string }) {
  const { isStreaming } = useTerminal()
  return (
    <span className={cn("relative flex h-1.5 w-1.5", className)}>
      {isStreaming ? (
        <>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </>
      ) : (
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-600" />
      )}
    </span>
  )
}

export function TerminalActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("flex items-center gap-0.5", className)}>{children}</div>
}

export function TerminalCopyButton({
  onCopy,
  className,
}: {
  onCopy?: () => void
  className?: string
}) {
  const { output } = useTerminal()
  const handleCopy = useCallback(() => {
    const plain = output.replace(/\[[0-9;]+m/g, "")
    navigator.clipboard.writeText(plain).catch(() => {})
    onCopy?.()
  }, [output, onCopy])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300",
        className
      )}
      aria-label="Copy output"
    >
      <Copy className="h-2.5 w-2.5" />
    </button>
  )
}

export function TerminalClearButton({ className }: { className?: string }) {
  const { onClear } = useTerminal()
  if (!onClear) return null
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300",
        className
      )}
      aria-label="Clear terminal"
    >
      <X className="h-2.5 w-2.5" />
    </button>
  )
}

export function TerminalContent({ className }: { className?: string }) {
  const { output, isStreaming, autoScroll, scrollRef } = useTerminal()

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [output, autoScroll, scrollRef])

  return (
    <div
      ref={scrollRef}
      className={cn("flex-1 overflow-auto p-3 text-[11px] leading-relaxed text-zinc-400", className)}
      style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}
    >
      {output ? (
        <>
          {renderAnsi(output)}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-[11px] w-1.5 animate-pulse bg-zinc-400 align-text-bottom" />
          )}
        </>
      ) : (
        <span className="text-[11px] text-zinc-600">Waiting for output...</span>
      )}
    </div>
  )
}
