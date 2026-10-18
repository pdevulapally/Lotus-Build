"use client"

import type { BlueprintItemStatus, PlanningStatus } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

const itemStatusStyles: Record<BlueprintItemStatus, string> = {
  confirmed: "border-success/25 bg-success/10 text-success",
  suggested: "border-border bg-muted text-foreground",
  unknown: "border-border-strong bg-muted text-foreground",
}

const planningStatusStyles: Record<PlanningStatus, string> = {
  draft: "border-border bg-muted text-foreground",
  "needs-input": "border-border-strong bg-muted text-foreground",
  "plan-generated": "border-border bg-muted text-foreground",
  approved: "border-success/25 bg-success/10 text-success",
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
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium",
        styles,
        className
      )}
    >
      {label || status}
    </span>
  )
}
