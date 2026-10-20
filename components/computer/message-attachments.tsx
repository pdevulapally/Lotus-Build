"use client"

import { useEffect, useState } from "react"
import { currentBackend } from "@/lib/backend/browser"
import type { AttachmentRef } from "@/lib/backend/attachments"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Object URLs by attachment id; uploads are immutable, so a fetched image never goes stale. */
const cache = new Map<string, Promise<string>>()

function attachmentUrl(id: string): Promise<string> {
  let pending = cache.get(id)
  if (!pending) {
    pending = currentBackend().attachmentBlob(id).then((blob) => URL.createObjectURL(blob))
    pending.catch(() => cache.delete(id))
    cache.set(id, pending)
  }
  return pending
}

function AttachmentImage({ attachment, className }: { attachment: AttachmentRef; className?: string }) {
  const [state, setState] = useState<{ url?: string; failed?: boolean }>({})
  useEffect(() => {
    let active = true
    attachmentUrl(attachment.id).then((url) => { if (active) setState({ url }) }, () => { if (active) setState({ failed: true }) })
    return () => { active = false }
  }, [attachment.id])
  if (state.failed) return <div className={cn("flex items-center justify-center rounded-xl border border-border bg-muted px-3 text-xs text-muted-foreground", className)}>Image unavailable</div>
  if (!state.url) return <Skeleton className={cn("rounded-xl", className)} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={state.url} alt="Attached image" className={cn("rounded-xl border border-border object-cover", className)} />
}

/** Images a user sent with a message, loaded through the signed-in client. */
export function MessageAttachments({ attachments, className }: { attachments: readonly AttachmentRef[] | undefined; className?: string }) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div className={cn("flex flex-wrap justify-end gap-2", className)}>
      {attachments.map((attachment) => <AttachmentImage key={attachment.id} attachment={attachment} className="h-36 max-w-[16rem]" />)}
    </div>
  )
}
