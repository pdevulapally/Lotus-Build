"use client"

import { useEffect, useRef } from "react"
import { Terminal as TerminalIcon, Command } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeployTerminalProps {
  logs: string[]
  currentStep?: string | null
  className?: string
}

export function DeployTerminal({ logs, currentStep, className }: DeployTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_-18px_var(--primary)] transition-all duration-300", className)}>
      <style jsx>{`
        .terminal-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .terminal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--border-strong);
        }
      `}</style>
      
      {/* Terminal Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="h-3 w-px bg-border-strong" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">System Output</p>
        </div>
        {currentStep && (
          <div className="flex items-center gap-2 rounded-full bg-card px-2.5 py-0.5 border border-border shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-20" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <p className="font-mono text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{currentStep}</p>
          </div>
        )}
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="terminal-scrollbar max-h-[320px] overflow-auto bg-card p-5 font-mono text-[11px] leading-[1.7]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-3 w-1.5 bg-success/40 animate-[pulse_1s_infinite]" />
            <p className="font-medium tracking-tight">Initializing deployment engine...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((line, i) => {
              const isError = /\berror\b|failed|ERR!|exit\s+status\s+1/i.test(line)
              const isWarning = /\bwarn\b|warning|EBADENGINE/i.test(line)
              const isSuccess = /added \d+ packages|success|complete|published|ready/i.test(line)
              const isCommand = /^\s*>|^\s*\$|^\s*npm\s+run/.test(line)
              
              return (
                <div 
                  key={`log-${i}`}
                  className={cn(
                    "group flex gap-4 whitespace-pre-wrap break-words border-l-2 border-transparent pl-1 transition-colors",
                    isError && "border-destructive/40 text-destructive bg-destructive/10",
                    isWarning && "border-warning/40 text-warning-soft-foreground bg-warning-soft/50",
                    isSuccess && "border-success/40 text-success-soft-foreground bg-success-soft/50",
                    isCommand && "text-foreground font-bold",
                    !isError && !isWarning && !isSuccess && !isCommand && "text-muted-foreground"
                  )}
                >
                  <span className="shrink-0 select-none text-muted-foreground/60 opacity-40 group-hover:opacity-100 transition-opacity tabular-nums w-7 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    {isCommand && <span className="mr-2 text-success/60 font-bold">➜</span>}
                    {line}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 pt-3 text-muted-foreground/60">
              <span className="h-3 w-1.5 bg-border animate-[pulse_1.5s_infinite]" />
              <p className="text-[9px] uppercase tracking-[0.2em] font-bold">Awaiting process output</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
