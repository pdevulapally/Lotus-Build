"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type StepsContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const StepsContext = React.createContext<StepsContextValue | null>(null)

function useStepsContext() {
  const ctx = React.useContext(StepsContext)
  if (!ctx) throw new Error("Steps components must be used inside <Steps>")
  return ctx
}

export function Steps({
  children,
  defaultOpen = false,
  className,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <StepsContext.Provider value={{ open, setOpen }}>
      <div className={cn("rounded-xl border border-border bg-card/80", className)}>{children}</div>
    </StepsContext.Provider>
  )
}

export function StepsTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open, setOpen } = useStepsContext()

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      <span>{children}</span>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
  )
}

export function StepsContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open } = useStepsContext()
  if (!open) return null

  return <div className={cn("border-t border-border px-3 py-2.5", className)}>{children}</div>
}

export function StepsItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-2 text-xs text-muted-foreground sm:text-sm", className)}>
      <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
      <span>{children}</span>
    </div>
  )
}
