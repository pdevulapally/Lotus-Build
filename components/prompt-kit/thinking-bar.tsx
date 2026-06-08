"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Loader2, Check, Leaf, AlertCircle } from "lucide-react"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { AnimatePresence, motion } from "framer-motion"

type StepStatus = "pending" | "running" | "complete" | "error"
type StepPhase = "Planning" | "Building" | "Validating" | "Finalizing"

type ThinkingStep = {
  id: string
  label: string
  status: StepStatus
  phase: StepPhase
}

export interface ThinkingBarProps {
  text: string
  steps: string[]
  isGenerating?: boolean
  currentFile?: string | null
  className?: string
}

function resolvePhase(label: string, index: number, total: number): StepPhase {
  const lower = label.toLowerCase()
  if (/plan|scope|analy|reason|understand|design/.test(lower)) return "Planning"
  if (/build|create|write|implement|refactor|update|code/.test(lower)) return "Building"
  if (/validat|test|check|verify|lint|review/.test(lower)) return "Validating"
  if (/final|finish|complete|done|ship|deploy/.test(lower)) return "Finalizing"
  if (total <= 1) return "Building"
  const bucket = Math.floor((index / Math.max(total - 1, 1)) * 3)
  return bucket === 0 ? "Planning" : bucket === 1 ? "Building" : bucket === 2 ? "Validating" : "Finalizing"
}

function statusStyles(status: StepStatus, phase: StepPhase) {
  const phaseTone =
    phase === "Planning"
      ? "from-muted/85"
      : phase === "Building"
        ? "from-surface-raised/90"
        : phase === "Validating"
          ? "from-info-soft/90"
          : "from-accent-soft/90"

  if (status === "complete") {
    return {
      dot: "border-primary bg-primary text-primary-foreground shadow-[0_0_0_2px_var(--border)]",
      card: `border-border-strong bg-gradient-to-r ${phaseTone} to-card opacity-85`,
      title: "text-foreground",
      line: "bg-border-strong",
      phase: "text-muted-foreground",
    }
  }
  if (status === "running") {
    return {
      dot: "border-primary bg-primary text-primary-foreground shadow-[0_0_0_6px_var(--border)]",
      card: `border-border-strong bg-gradient-to-r ${phaseTone} to-card shadow-[0_0_24px_-12px_var(--primary)]`,
      title: "text-foreground",
      line: "bg-gradient-to-b from-primary/90 via-muted-foreground/70 to-border-strong",
      phase: "text-muted-foreground",
    }
  }
  if (status === "error") {
    return {
      dot: "border-destructive bg-destructive text-destructive-foreground",
      card: "border-destructive/20 bg-destructive/10",
      title: "text-destructive",
      line: "bg-destructive/30",
      phase: "text-destructive",
    }
  }
  return {
    dot: "border-border-strong bg-card text-muted-foreground",
    card: "border-border bg-card/80",
    title: "text-muted-foreground",
    line: "bg-border",
    phase: "text-muted-foreground/80",
  }
}

export function ThinkingBar({
  text,
  steps,
  isGenerating = false,
  currentFile,
  className,
}: ThinkingBarProps) {
  const timelineSteps = useMemo<ThinkingStep[]>(() => {
    const normalized = steps.length > 0 ? steps : [text || "Preparing update"]
    const activeIndex = isGenerating ? Math.max(normalized.length - 1, 0) : -1

    return normalized.map((label, index) => {
      const lower = label.toLowerCase()
      const failed = /error|failed|failure/.test(lower)
      const status: StepStatus =
        failed ? "error" : activeIndex === -1 ? "complete" : index < activeIndex ? "complete" : index === activeIndex ? "running" : "pending"
      return { id: String(index), label, status, phase: resolvePhase(label, index, normalized.length) }
    })
  }, [steps, text, isGenerating])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-2xl border border-border bg-card/75 p-4 shadow-[0_16px_40px_-24px_var(--primary)] backdrop-blur-md", className)}
    >
      {isGenerating ? (
        <div className="mb-4">
          <TextShimmer className="text-xs uppercase tracking-widest text-muted-foreground">Lotus.build Agent Orchestrating Build</TextShimmer>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card">
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" /> : <Leaf className="h-3.5 w-3.5 text-foreground" />}
          </div>
          {isGenerating ? (
            <TextShimmer className="text-sm font-medium tracking-tight text-foreground">{text || "Making updates"}</TextShimmer>
          ) : (
            <p className="text-sm font-medium tracking-tight text-foreground">{text || "Build complete"}</p>
          )}
        </div>
        {currentFile ? <p className="truncate text-xs text-muted-foreground">{currentFile}</p> : <Check className="h-4 w-4 text-foreground" />}
      </div>

      <motion.div
        className="relative space-y-2 pl-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.02 } },
        }}
      >
        <motion.div
          aria-hidden
          className={cn("absolute bottom-1 left-[9px] top-1 w-px rounded-full", isGenerating ? "bg-gradient-to-b from-primary via-border-strong to-border" : "bg-border-strong")}
          animate={isGenerating ? { opacity: [0.45, 1, 0.45] } : { opacity: 0.8 }}
          transition={isGenerating ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
        />
        {timelineSteps.map((step) => {
          const styles = statusStyles(step.status, step.phase)
          const isActive = step.status === "running" && isGenerating
          return (
            <motion.div
              key={step.id}
              layout
              variants={{
                hidden: { opacity: 0, y: 8, x: -8 },
                show: { opacity: 1, y: 0, x: 0, transition: { duration: 0.28, ease: "easeOut" } },
              }}
            >
              <div className={cn("relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", styles.card)}>
                <div className={cn("absolute -left-4 top-1/2 h-px w-4 -translate-y-1/2", styles.line)} />
                <motion.div
                  className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", styles.dot)}
                  animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isActive ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                >
                  {step.status === "complete" ? <Check className="h-3 w-3" /> : step.status === "error" ? <AlertCircle className="h-3 w-3" /> : <div className={cn("rounded-full", isActive ? "h-2 w-2 bg-primary-foreground animate-pulse" : "h-1.5 w-1.5 bg-muted-foreground")} />}
                </motion.div>
                <div className="min-w-0">
                  <p className={cn("mb-0.5 text-[11px] uppercase tracking-wide", styles.phase)}>{step.phase}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    {isActive ? (
                      <motion.div key={`${step.id}-shimmer`} initial={{ opacity: 0.75 }} animate={{ opacity: 1 }} exit={{ opacity: 0.9 }}>
                        <TextShimmer className="text-sm font-medium tracking-tight">{step.label}</TextShimmer>
                      </motion.div>
                    ) : (
                      <motion.p key={`${step.id}-static`} initial={{ opacity: 0.75 }} animate={{ opacity: 1 }} exit={{ opacity: 0.95 }} className={cn("text-sm font-medium tracking-tight", styles.title)}>
                        {step.label}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
