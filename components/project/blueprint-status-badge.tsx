"use client"

import type { BlueprintItemStatus, PlanningStatus } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

const itemStatusStyles: Record<BlueprintItemStatus, string> = {
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  suggested: "border-border bg-muted text-foreground",
  unknown: "border-border-strong bg-muted text-foreground",
}

const planningStatusStyles: Record<PlanningStatus, string> = {
  draft: "border-border bg-muted text-foreground",
  "needs-input": "border-border-strong bg-muted text-foreground",
  "plan-generated": "border-border bg-muted text-foreground",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  skipped: "border-border bg-muted text-foreground",
}

export function BlueprintStatusBadge(props: {
  status: BlueprintItemStatus | PlanningStatus
  label?: string
  className?: string
}) {
  const { status, label, className } = props
  const styles =
    status in itemStatusStyles
      ? itemStatusStyles[status as BlueprintItemStatus]
      : planningStatusStyles[status as PlanningStatus]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]",
        styles,
        className
      )}
    >
      {label || status}
    </span>
  )
}
