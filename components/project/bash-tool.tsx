"use client"

import * as React from "react"
import { Check, Terminal, X } from "lucide-react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { cn } from "@/lib/utils"

export type BashToolApproval = {
  pending?: boolean
  onSkip?: () => void
  onRun?: () => void
  skipLabel?: string
  runLabel?: string
}

export type BashToolProps = {
  state?: "idle" | "running" | "error" | "interrupted" | "pending"
  command: string
  output?: string
  approval?: BashToolApproval
  className?: string
}

function extractCommandSummary(command: string) {
  return command
    .split("|")
    .map((part) => part.trim().split(/\s+/)[0] || "")
    .filter(Boolean)
    .slice(0, 4)
    .join(", ")
}

function LoadingDots() {
  return (
    <span className="inline-flex" aria-hidden="true">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse [animation-delay:150ms]">.</span>
      <span className="animate-pulse [animation-delay:300ms]">.</span>
    </span>
  )
}

function ApprovalFooter({ isRunning, approval }: { isRunning: boolean; approval: BashToolApproval }) {
  const [decision, setDecision] = React.useState<"approved" | "rejected" | null>(null)
  const status = decision === "approved"
    ? { label: "Waiting", dots: true }
    : decision === "rejected"
      ? { label: "Canceled", dots: false }
      : isRunning
        ? { label: "Starting", dots: true }
        : null

  return (
    <div className="flex items-center justify-between border-t border-border/70 bg-muted/45 py-1.5 pl-3 pr-2">
      {status ? (
        <span className="text-xs text-muted-foreground">
          {status.label}
          {status.dots && <LoadingDots />}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            if (decision) return
            setDecision("rejected")
            approval.onSkip?.()
          }}
          disabled={Boolean(decision)}
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          <X className="h-3 w-3" />
          {decision === "rejected" ? "Skipped" : approval.skipLabel ?? "Skip"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (decision) return
            setDecision("approved")
            approval.onRun?.()
          }}
          disabled={Boolean(decision)}
          className="inline-flex h-6 items-center gap-1 rounded-lg bg-primary px-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {decision === "approved" ? "Approved" : approval.runLabel ?? "Run"}
        </button>
      </div>
    </div>
  )
}

export const BashTool = React.memo(function BashTool({
  state = "idle",
  command,
  output,
  approval,
  className,
}: BashToolProps) {
  const isRunning = state === "running"
  const summary = extractCommandSummary(command)
  const label = { idle: 'Ran command', running: 'Running command', error: 'Command failed', interrupted: 'Command interrupted', pending: 'Command pending' }[state]

  return (
    <div className={cn("bg-card overflow-hidden rounded-2xl border border-border/70", className)}>
      <div className="flex h-9 items-center justify-between gap-3 pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {isRunning ? (
            <TextShimmer className="truncate text-xs font-semibold">
              {label}: {summary}
            </TextShimmer>
          ) : (
            <span className={cn("truncate text-xs font-semibold", state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{label}: {summary}</span>
          )}
        </div>
        {isRunning && <Shimmer className="shrink-0 text-[11px] font-medium">Running</Shimmer>}
      </div>

      <div className="border-t border-border/70 bg-muted/55 px-3 py-2 font-mono text-[12px] leading-5">
        <div className="break-all">
          <span className="select-none text-muted-foreground">$ </span>
          <span className="text-foreground">{command}</span>
        </div>
        {!isRunning && output && (
          <div className="mt-1.5 max-h-24 overflow-hidden whitespace-pre-line text-muted-foreground">
            {output}
          </div>
        )}
      </div>

      {approval && <ApprovalFooter isRunning={isRunning} approval={approval} />}
    </div>
  )
})
