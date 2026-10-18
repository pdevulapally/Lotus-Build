"use client"

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { DesignSnapshot } from "./visual-edit-design-panel"
import type { VisualEditSectionItem, VisualEditStructureCommand } from "./visual-edit-structure"
import { parsePreviewMessage, previewUrl } from "@/lib/preview"

type Rect = { x: number; y: number; width: number; height: number }
type Viewport = { w: number; h: number }
type SelectedElement = {
  id: string
  rect: Rect
  viewport: Viewport
  description: string | null
  sectionId?: string | null
  snapshot: DesignSnapshot
}

export interface PreviewWithVisualEditProps {
  src: string | null
  canEdit?: boolean
  enabled?: boolean
  onSelectionChange?: (selection: {
    descriptions: string[]
    primary?: {
      id: string
      description: string | null
      sectionId?: string | null
      snapshot: DesignSnapshot
    }
  } | null) => void
  externalDraft?: {
    id: string
    snapshot: DesignSnapshot
  } | null
  onIframeNavigate?: (path: string) => void
  onStructureChange?: (sections: VisualEditSectionItem[]) => void
  command?: { nonce: number; payload: VisualEditStructureCommand } | null
  className?: string
  iframeKey?: string | number
}

export function PreviewWithVisualEdit({
  src,
  canEdit = true,
  enabled = false,
  onSelectionChange,
  externalDraft,
  onIframeNavigate,
  onStructureChange,
  command,
  className,
  iframeKey,
}: PreviewWithVisualEditProps) {
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [safeSrc, setSafeSrc] = useState<string | null>(null)
  useEffect(() => {
    try { setSafeSrc(src ? previewUrl(src, window.location.origin) : null) }
    catch { setSafeSrc(null) }
  }, [src])
  const previewOrigin = useMemo(() => safeSrc ? new URL(safeSrc).origin : null, [safeSrc])
  const [previewSize, setPreviewSize] = useState({ w: 1, h: 1 })
  const [hover, setHover] = useState<{ rect: Rect; viewport: Viewport } | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedElement[]>([])

  const updateSize = useCallback(() => {
    const el = previewAreaRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPreviewSize((prev) => (prev.w !== width || prev.h !== height ? { w: width, h: height } : prev))
  }, [])

  useEffect(() => {
    const el = previewAreaRef.current
    if (!el) return
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [src, updateSize])

  useEffect(() => {
    setHover(null)
    setSelectedItems([])
  }, [enabled, safeSrc])

  useEffect(() => {
    if (!enabled) return
    onSelectionChange?.(
      selectedItems.length > 0
        ? {
            descriptions: selectedItems.map((item) => item.description || "selected element"),
            primary: selectedItems.length === 1
              ? {
                  id: selectedItems[0].id,
                  description: selectedItems[0].description,
                  sectionId: selectedItems[0].sectionId,
                  snapshot: selectedItems[0].snapshot,
                }
              : undefined,
          }
        : null
    )
  }, [enabled, onSelectionChange, selectedItems])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!previewOrigin || e.origin !== previewOrigin || e.source !== iframeRef.current?.contentWindow) return
      const d = parsePreviewMessage(e.data)
      if (d?.type === "preview-navigate") {
        onIframeNavigate?.(d.path)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [onIframeNavigate, previewOrigin])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!enabled) return
      if (!previewOrigin || e.origin !== previewOrigin || e.source !== iframeRef.current?.contentWindow) return
      const d = parsePreviewMessage(e.data)
      if (!d) return

      if (d.type === "preview-hover") {
        setHover(d.rect && d.viewport ? { rect: d.rect, viewport: d.viewport } : null)
        return
      }

      if (d.type === "preview-structure") {
        const sections = d.sections.map((item, index) => ({ ...item, index }))
        onStructureChange?.(sections)
        return
      }

      if (d.type !== "preview-select") return

      if (!(d.rect && d.viewport && d.id)) {
        setSelectedItems([])
        return
      }

      const nextSelection: SelectedElement = {
        id: d.id,
        rect: d.rect,
        viewport: d.viewport,
        description: d.description ?? null,
        sectionId: typeof d.sectionId === "string" ? d.sectionId : null,
        snapshot: d.snapshot ?? {},
      }

      setSelectedItems((prev) => {
        let nextItems: SelectedElement[]

        if (d.multi) {
          const exists = prev.some((item) => item.id === nextSelection.id)
          nextItems = exists ? prev.filter((item) => item.id !== nextSelection.id) : [...prev, nextSelection]
        } else {
          nextItems = [nextSelection]
        }
        return nextItems
      })
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [enabled, onSelectionChange, onStructureChange, previewOrigin])

  const hoverStyle =
    hover && previewSize.w > 0
      ? {
          left: hover.rect.x * (previewSize.w / hover.viewport.w),
          top: hover.rect.y * (previewSize.h / hover.viewport.h),
          width: hover.rect.width * (previewSize.w / hover.viewport.w),
          height: hover.rect.height * (previewSize.h / hover.viewport.h),
        }
      : undefined

  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !previewOrigin) return
    iframeRef.current.contentWindow.postMessage(
      { type: "bstudio-set-visual-edit", enabled: canEdit && enabled },
      previewOrigin
    )

  }, [canEdit, enabled, previewOrigin])

  useEffect(() => {
    if (!previewOrigin) return
    iframeRef.current?.contentWindow?.postMessage(
      { type: "bstudio-set-visual-edit", enabled: canEdit && enabled },
      previewOrigin
    )
  }, [canEdit, enabled, iframeKey, src, previewOrigin])

  useEffect(() => {
    if (!externalDraft || !iframeRef.current?.contentWindow || !previewOrigin) return

    iframeRef.current.contentWindow.postMessage(
      { type: "bstudio-apply-design", id: externalDraft.id, payload: externalDraft.snapshot },
      previewOrigin
    )
  }, [externalDraft, previewOrigin])

  useEffect(() => {
    if (!command || !iframeRef.current?.contentWindow || !previewOrigin) return
    iframeRef.current.contentWindow.postMessage(
      { type: "bstudio-structure-command", command: command.payload },
      previewOrigin
    )
  }, [command, previewOrigin])

  return (
    <div className={cn("relative flex w-full min-h-0 flex-1 flex-col", className)}>
      <div ref={previewAreaRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={safeSrc ?? undefined}
          className="absolute inset-0 h-full w-full min-h-0 border-0"
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          onLoad={handleIframeLoad}
        />

        {canEdit && enabled && hover && (
          <div
            className="pointer-events-none absolute z-10 rounded border-2 border-accent/70 transition-all duration-75"
            style={hoverStyle}
          />
        )}

        {canEdit && enabled && selectedItems.map((item) => {
          const scaleX = previewSize.w / item.viewport.w
          const scaleY = previewSize.h / item.viewport.h
          return (
            <div
              key={item.id}
              className="absolute z-20 rounded border-2 border-accent bg-accent/12 shadow-[0_0_0_1px_color-mix(in_oklch,var(--accent)_18%,transparent)]"
              style={{
                left: item.rect.x * scaleX,
                top: item.rect.y * scaleY,
                width: item.rect.width * scaleX,
                height: item.rect.height * scaleY,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
