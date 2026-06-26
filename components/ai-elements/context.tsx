"use client"

import * as React from "react"
import { X, Cpu } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContextUsage = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  totalTokens: number
}

type ContextValue = {
  maxTokens: number
  modelId: string
  usage: ContextUsage
  usedTokens: number
  pct: number
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ContextCtx = React.createContext<ContextValue | null>(null)

function useCtx() {
  const ctx = React.useContext(ContextCtx)
  if (!ctx) throw new Error("Context compound components must be rendered inside <Context>.")
  return ctx
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

function pctColor(pct: number): string {
  if (pct >= 90) return "bg-destructive"
  if (pct >= 75) return "bg-foreground"
  if (pct >= 50) return "bg-muted-foreground"
  return "bg-success"
}

function pctTextColor(pct: number): string {
  if (pct >= 90) return "text-destructive"
  if (pct >= 75) return "text-foreground"
  if (pct >= 50) return "text-muted-foreground"
  return "text-success-soft-foreground"
}

function parseModelLabel(modelId: string): string {
  const parts = modelId.split(":")
  const raw = parts[parts.length - 1] ?? modelId
  // anthropic:claude-sonnet-4-6 → Claude Sonnet 4.6
  return raw
    .replace(/^claude-/, "Claude ")
    .replace(/-(\d)/g, " $1")
    .replace(/-([a-z])/g, (_, c: string) => ` ${c.toUpperCase()}`)
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── UsageRow ─────────────────────────────────────────────────────────────────

function UsageRow({
  label,
  tokens,
  maxTokens,
  barColor,
}: {
  label: string
  tokens: number
  maxTokens: number
  barColor?: string
}) {
  const rowPct = maxTokens > 0 ? Math.min(100, (tokens / maxTokens) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11.5px] tabular-nums text-foreground/80">
          {fmt(tokens)} <span className="text-muted-foreground/60">/ {fmt(maxTokens)}</span>
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor ?? "bg-primary/60")}
          style={{ width: `${rowPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function Context({
  maxTokens,
  modelId,
  usage,
  usedTokens,
  children,
}: {
  maxTokens: number
  modelId: string
  usage: ContextUsage
  usedTokens: number
  children: React.ReactNode
}) {
  const pct = maxTokens > 0 ? Math.min(100, (usedTokens / maxTokens) * 100) : 0

  return (
    <ContextCtx.Provider value={{ maxTokens, modelId, usage, usedTokens, pct }}>
      <Popover>{children}</Popover>
    </ContextCtx.Provider>
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export function ContextTrigger({ className }: { className?: string }) {
  const { pct, usedTokens, maxTokens } = useCtx()
  const fillColor = pctColor(pct)
  const textColor = pctTextColor(pct)

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "group flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        {/* Mini fill bar */}
        <span className="relative flex h-1.5 w-10 overflow-hidden rounded-full bg-muted-foreground/15">
          <span
            className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-700", fillColor)}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={cn("tabular-nums transition-colors", pct > 50 ? textColor : "")}>
          {fmt(usedTokens)}
          <span className="text-muted-foreground/50"> / {fmt(maxTokens)}</span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span>context</span>
      </button>
    </PopoverTrigger>
  )
}

// ─── Content shell ────────────────────────────────────────────────────────────

export function ContextContent({ children }: { children: React.ReactNode }) {
  return (
    <PopoverContent
      side="top"
      align="start"
      sideOffset={8}
      className="w-80 rounded-2xl border border-border/60 bg-card p-0 shadow-xl shadow-black/10"
    >
      {children}
    </PopoverContent>
  )
}

export function ContextContentHeader() {
  const { modelId, pct } = useCtx()
  const label = parseModelLabel(modelId)
  const textColor = pctTextColor(pct)

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12.5px] font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px] font-semibold tabular-nums", textColor)}>
          {pct.toFixed(1)}%
        </span>
        <PopoverClose />
      </div>
    </div>
  )
}

function PopoverClose() {
  return (
    <button
      type="button"
      onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))}
      className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

export function ContextContentBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3.5 px-4 py-3.5">{children}</div>
}

export function ContextContentFooter() {
  const { maxTokens } = useCtx()

  return (
    <div className="border-t border-border/50 px-4 py-2.5">
      <p className="text-[10.5px] text-muted-foreground/60">
        {fmt(maxTokens)} token context window · estimates only, resets each run
      </p>
    </div>
  )
}

// ─── Usage rows ───────────────────────────────────────────────────────────────

export function ContextInputUsage() {
  const { usage, maxTokens } = useCtx()
  return (
    <UsageRow
      label="Conversation input"
      tokens={usage.inputTokens}
      maxTokens={maxTokens}
      barColor="bg-primary/70"
    />
  )
}

export function ContextOutputUsage() {
  const { usage, maxTokens } = useCtx()
  return (
    <UsageRow
      label="Generated output"
      tokens={usage.outputTokens}
      maxTokens={maxTokens}
      barColor="bg-blue-500/60"
    />
  )
}

export function ContextReasoningUsage() {
  const { usage } = useCtx()
  if (!usage.reasoningTokens) return null
  return (
    <UsageRow
      label="Reasoning"
      tokens={usage.reasoningTokens}
      maxTokens={usage.totalTokens}
      barColor="bg-violet-500/60"
    />
  )
}

export function ContextCacheUsage() {
  const { usage } = useCtx()
  if (!usage.cachedInputTokens) return null
  return (
    <UsageRow
      label="Cached context"
      tokens={usage.cachedInputTokens}
      maxTokens={usage.inputTokens + usage.cachedInputTokens}
      barColor="bg-emerald-500/60"
    />
  )
}
