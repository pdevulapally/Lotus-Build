"use client"

import * as React from "react"
import { Check, Loader2, Terminal, X } from "lucide-react"
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
  state?: "idle" | "running"
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
    <div className="flex items-center justify-between border-t border-border/35 bg-muted/45 py-1.5 pl-3 pr-2">
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
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:opacity-60"
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
          className="inline-flex h-6 items-center gap-1 rounded-full bg-foreground px-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
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

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/55 bg-card/78 shadow-sm backdrop-blur-xl", className)}>
      <div className="flex h-9 items-center justify-between gap-3 pl-3 pr-2.5">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55" />
          {isRunning ? (
            <TextShimmer className="truncate text-xs font-semibold">
              Running command: {summary}
            </TextShimmer>
          ) : (
            <span className="truncate text-xs font-semibold text-muted-foreground">Ran command: {summary}</span>
          )}
        </div>
        {isRunning && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      <div className="border-t border-border/35 bg-muted/55 px-3 py-2 font-mono text-[12px] leading-5">
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
