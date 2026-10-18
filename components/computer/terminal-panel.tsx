"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Check, Loader2, XCircle } from "lucide-react"
import { duration, ease } from "@/lib/motion"
import type { TerminalEntry } from "@/lib/backend/terminal"

function EntryStatus({ entry }: { entry: TerminalEntry }) {
  if (entry.status === "running") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Running
      </span>
    )
  }

  if (entry.status === "stopped") {
    return <span className="shrink-0 text-xs text-muted-foreground">Stopped</span>
  }

  if (entry.status === "error") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-destructive">
        <XCircle className="size-3.5" aria-hidden />
        Exit {entry.exitCode ?? "?"}
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="size-3.5" aria-hidden />
      Exit {entry.exitCode ?? 0}
    </span>
  )
}

export function TerminalPanel({ entries }: { entries: TerminalEntry[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceFromBottom <= 80) element.scrollTop = element.scrollHeight
  }, [entries])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-3 lg:p-4">
      {entries.length === 0 ? (
        <div className="flex h-full min-h-[180px] items-center justify-center text-center">
          <p className="text-[13px] text-muted-foreground">Commands the agent runs will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, ease }}
              className="rounded-xl border border-border/70 bg-muted/30 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 flex-1 font-mono text-[12.5px] font-medium leading-5 wrap-anywhere line-clamp-3">
                  <span className="select-none text-muted-foreground">$ </span>
                  {entry.command}
                </p>
                <EntryStatus entry={entry} />
              </div>
              {entry.status !== "running" && (entry.output?.trim() || entry.status === "done") && (
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 pt-2 font-mono text-[12px] leading-5 text-muted-foreground">
                  {entry.output?.trim() ? entry.output : "No output"}
                </pre>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
