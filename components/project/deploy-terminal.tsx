"use client"

import { useCallback, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Terminal,
  TerminalActions,
  TerminalClearButton,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from "@/components/ai-elements/terminal"
import { cn } from "@/lib/utils"

interface DeployTerminalProps {
  logs: string[]
  currentStep?: string | null
  className?: string
}

const DONE_STEPS = new Set(["Ready", "Failed", "Needs connection"])

function toAnsiOutput(logs: string[]): string {
  return logs
    .map((line) => {
      if (/\berror\b|failed|ERR!/i.test(line))          return `[31m${line}[0m`
      if (/\bwarn\b|warning/i.test(line))                return `[33m${line}[0m`
      if (/success|complete|✓|ready|\+ \d/i.test(line)) return `[32m${line}[0m`
      if (/^\s*(>|\$|npm\s+run)/i.test(line))           return `[1m[37m${line}[0m`
      return `[90m${line}[0m`
    })
    .join("\n")
}

export function DeployTerminal({ logs, currentStep, className }: DeployTerminalProps) {
  const [open, setOpen] = useState(false)
  const [cleared, setCleared] = useState(false)
  const handleClear = useCallback(() => setCleared(true), [])

  const ansiOutput = cleared ? "" : toAnsiOutput(logs)
  const isStreaming = Boolean(currentStep && !DONE_STEPS.has(currentStep))

  if (logs.length === 0) return null

  return (
    <div className={cn("space-y-1.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-muted-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? "Hide" : "Show"} build details
      </button>

      {open && (
        <Terminal output={ansiOutput} isStreaming={isStreaming} onClear={handleClear} autoScroll>
          <TerminalHeader>
            <TerminalTitle>Build Output</TerminalTitle>
            <div className="flex items-center gap-1.5">
              <TerminalStatus />
              <TerminalActions>
                <TerminalCopyButton />
                <TerminalClearButton />
              </TerminalActions>
            </div>
          </TerminalHeader>
          <TerminalContent className="max-h-[200px]" />
        </Terminal>
      )}
    </div>
  )
}
