"use client"

import { X } from "lucide-react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import type { ComposerAttachment } from "@/hooks/use-composer-attachments"
import { cn } from "@/lib/utils"

/** Thumbnails of the images about to be sent, with their upload state. */
export function AttachmentStrip({ items, onRemove, className }: { items: ComposerAttachment[]; onRemove: (localId: string) => void; className?: string }) {
  if (items.length === 0) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Attached images">
      {items.map((item) => (
        <li key={item.localId} className="group/attachment relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt={item.name} className={cn("h-full w-full object-cover", item.status !== "ready" && "opacity-50")} />
          {item.status === "uploading" && (
            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <Shimmer className="text-[10px] font-semibold">Uploading</Shimmer>
            </div>
          )}
          {item.status === "error" && (
            <div className="absolute inset-0 flex items-end justify-center bg-destructive/10 pb-1" title={item.error}>
              <span className="text-[10px] font-semibold text-destructive">Failed</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.localId)}
            aria-label={`Remove ${item.name}`}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover/attachment:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}
