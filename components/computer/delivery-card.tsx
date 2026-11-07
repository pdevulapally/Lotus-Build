"use client"

import { useState } from "react"
import { AlertCircle, Check, ChevronDown, ExternalLink, GitBranch, Rocket } from "lucide-react"

import { Shimmer } from "@/components/ai-elements/shimmer"
import type { Delivery } from "@/lib/backend/delivery"
import { cn } from "@/lib/utils"

const activeStatuses: ReadonlySet<Delivery["status"]> = new Set(["CHECKS_PENDING", "REPAIRING", "MERGED", "DEPLOYING"])

function statusCopy(delivery: Delivery) {
  switch (delivery.status) {
    case "CHECKS_PENDING": return "Checks are running"
    case "REPAIRING": return "LotusBuild is fixing a failed check"
    case "READY_TO_MERGE": return "Ready for your review"
    case "MERGED": return "Merged, waiting for deployment"
    case "DEPLOYING": return "Deploying the merged revision"
    case "LIVE": return "The merged revision is live"
    case "UNVERIFIED": return "Deployment could not be confirmed"
    case "FAILED": return "Delivery needs attention"
  }
}

function statePill(delivery: Delivery) {
  if (delivery.status === "LIVE") return { label: "Live", className: "bg-success-soft text-success-soft-foreground" }
  if (["MERGED", "DEPLOYING", "UNVERIFIED"].includes(delivery.status)) return { label: "Merged", className: "bg-information/10 text-information" }
  if (delivery.status === "FAILED") return { label: "Failed", className: "bg-destructive/10 text-destructive" }
  return { label: "Open", className: "bg-success-soft text-success-soft-foreground" }
}

function StatusIcon({ delivery }: { delivery: Delivery }) {
  if (activeStatuses.has(delivery.status)) return <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-information" />
  if (delivery.status === "READY_TO_MERGE" || delivery.status === "LIVE") return <Check className="h-3.5 w-3.5" />
  if (delivery.status === "FAILED" || delivery.status === "UNVERIFIED") return <AlertCircle className="h-3.5 w-3.5" />
  return <Rocket className="h-3.5 w-3.5" />
}

export function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const pill = statePill(delivery)
  const failed = delivery.failedChecks.length > 0
  const progress = delivery.checksTotal === 0 ? 0 : Math.min(100, Math.round((delivery.checksPassed / delivery.checksTotal) * 100))
  const checksLabel = delivery.checksTotal === 0 ? "Waiting for checks" : `${delivery.checksPassed}/${delivery.checksTotal} passed`

  return (
    <section aria-label="Delivery status" className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-4 py-3.5">
        <div className="flex min-w-0 items-center justify-between gap-3 text-[11.5px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("inline-flex h-5 items-center rounded-md px-2 font-semibold", pill.className)}>{pill.label}</span>
            <span className="truncate font-medium text-muted-foreground">{delivery.repository} #{delivery.pullRequestNumber}</span>
          </div>
          <a href={delivery.pullRequestUrl} target="_blank" rel="noreferrer"
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            Open pull request
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <h3 className="mt-2.5 text-[14px] font-semibold leading-5 text-foreground">
          <a href={delivery.pullRequestUrl} target="_blank" rel="noreferrer"
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {delivery.title}
          </a>
        </h3>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{delivery.baseBranch} ← {delivery.branch}</span>
        </p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11.5px]">
            <span className="font-medium text-foreground/80">Checks</span>
            <span className={cn("text-muted-foreground", failed && "text-destructive")}>{failed ? `${delivery.failedChecks.length} failed` : checksLabel}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-[width,background-color] duration-300",
              failed ? "bg-destructive" : delivery.status === "CHECKS_PENDING" ? "animate-pulse bg-information" : "bg-success")}
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className={cn(
        "flex min-h-10 items-center gap-2 border-t border-border/70 bg-muted/20 px-4 py-2.5 text-[11.5px] font-medium",
        delivery.status === "FAILED" ? "text-destructive" : "text-muted-foreground",
      )}>
        <StatusIcon delivery={delivery} />
        {activeStatuses.has(delivery.status)
          ? <Shimmer className="min-w-0 flex-1 truncate">{statusCopy(delivery)}</Shimmer>
          : <span className="min-w-0 flex-1 truncate">{statusCopy(delivery)}</span>}
        {delivery.status === "LIVE" && delivery.environmentUrl && (
          <a href={delivery.environmentUrl} target="_blank" rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-foreground underline-offset-4 hover:underline">
            Open site <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {failed && (
          <button type="button" aria-label="Show failed checks" onClick={() => setDetailsOpen((value) => !value)}
            className="rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} />
          </button>
        )}
      </div>
      {failed && detailsOpen && (
        <ul className="space-y-1 border-t border-border/60 px-4 py-3 text-[11.5px] text-muted-foreground">
          {delivery.failedChecks.map((check) => <li key={check} className="truncate">{check}</li>)}
        </ul>
      )}
    </section>
  )
}
