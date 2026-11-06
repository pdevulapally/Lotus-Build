"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { attachmentProblem, type AttachmentRef } from "@/lib/backend/attachments"

export type ComposerAttachment = {
  localId: string
  name: string
  previewUrl: string
  status: "uploading" | "ready" | "error"
  ref?: AttachmentRef
  error?: string
}

/**
 * Images picked, pasted or dropped into the composer. Each upload starts as soon
 * as it is added, so sending only waits on uploads still in flight.
 */
export function useComposerAttachments(upload: (file: File) => Promise<AttachmentRef>) {
  const [items, setItems] = useState<ComposerAttachment[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const uploadRef = useRef(upload)
  uploadRef.current = upload
  const itemsRef = useRef(items)
  itemsRef.current = items

  const update = useCallback((localId: string, patch: Partial<ComposerAttachment>) => {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)))
  }, [])

  const add = useCallback((files: Iterable<File>) => {
    let count = itemsRef.current.length
    for (const file of files) {
      const problem = attachmentProblem(file, count)
      if (problem) { setNotice(problem); continue }
      count += 1
      const item: ComposerAttachment = { localId: crypto.randomUUID(), name: file.name, previewUrl: URL.createObjectURL(file), status: "uploading" }
      setItems((current) => [...current, item])
      uploadRef.current(file)
        .then((ref) => update(item.localId, { status: "ready", ref }))
        .catch((reason) => update(item.localId, { status: "error", error: reason instanceof Error ? reason.message : "Upload failed." }))
    }
  }, [update])

  const remove = useCallback((localId: string) => {
    setItems((current) => {
      const target = current.find((item) => item.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.localId !== localId)
    })
  }, [])

  const clear = useCallback(() => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl)
    setItems([])
    setNotice(null)
  }, [])

  const restore = useCallback((refs: readonly AttachmentRef[]) => {
    setItems((current) => current.length ? current : refs.map((ref) => ({ localId: crypto.randomUUID(), name: 'Attached image', previewUrl: '', status: 'ready' as const, ref })))
  }, [])

  useEffect(() => () => { for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl) }, [])

  const uploading = items.some((item) => item.status === "uploading")
  const failed = items.some((item) => item.status === "error")
  const refs = items.flatMap((item) => (item.ref ? [item.ref] : []))
  return { items, add, remove, clear, restore, notice, dismissNotice: () => setNotice(null), uploading, failed, refs }
}

/** Image files from a paste or drop, ignoring everything else on the clipboard. */
export function imageFilesFrom(transfer: DataTransfer | null): File[] {
  if (!transfer) return []
  const files: File[] = []
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) { const file = item.getAsFile(); if (file) files.push(file) }
  }
  if (files.length === 0) for (const file of Array.from(transfer.files ?? [])) if (file.type.startsWith("image/")) files.push(file)
  return files
}
