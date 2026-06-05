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
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300", className)}>
      <style jsx>{`
        .terminal-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .terminal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb {
          background: #e0dbd1;
          border-radius: 10px;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d2c8b6;
        }
      `}</style>
      
      {/* Terminal Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <TerminalIcon className="h-3.5 w-3.5 text-zinc-400" />
          <div className="h-3 w-px bg-zinc-300" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">System Output</p>
        </div>
        {currentStep && (
          <div className="flex items-center gap-2 rounded-full bg-white px-2.5 py-0.5 border border-zinc-200 shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <p className="font-mono text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{currentStep}</p>
          </div>
        )}
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="terminal-scrollbar max-h-[320px] overflow-auto bg-card p-5 font-mono text-[11px] leading-[1.7]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-3 text-zinc-400">
            <span className="h-3 w-1.5 bg-emerald-500/40 animate-[pulse_1s_infinite]" />
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
                    isError && "border-red-500/40 text-red-600 bg-red-50/50",
                    isWarning && "border-amber-500/40 text-amber-700 bg-amber-50/50",
                    isSuccess && "border-emerald-500/40 text-emerald-600 bg-emerald-50/50",
                    isCommand && "text-foreground font-bold",
                    !isError && !isWarning && !isSuccess && !isCommand && "text-zinc-500"
                  )}
                >
                  <span className="shrink-0 select-none text-zinc-300 opacity-40 group-hover:opacity-100 transition-opacity tabular-nums w-7 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    {isCommand && <span className="mr-2 text-emerald-500/60 font-bold">➜</span>}
                    {line}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-2 pt-3 text-zinc-300">
              <span className="h-3 w-1.5 bg-zinc-200 animate-[pulse_1.5s_infinite]" />
              <p className="text-[9px] uppercase tracking-[0.2em] font-bold">Awaiting process output</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
