"use client"
import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown, ChevronRight, FileCode, Folder, FolderOpen } from "lucide-react"
import type { FileNode } from "@/lib/projects/types"
import { cn } from "@/lib/utils"

/** The one file tree for every Files surface: folders that open and close, files that select, VS Code-style. */
export type DiffStatus = "new" | "modified" | "unchanged"

export function CodeTreeNode({
  node,
  selectedPath,
  onSelect,
  depth = 0,
  fileStatuses,
}: {
  node: FileNode
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
  fileStatuses?: Map<string, DiffStatus>
}) {
  const [open, setOpen] = useState(depth < 2)
  const shouldReduceMotion = useReducedMotion()
  const isSelected = node.type === "file" && node.path === selectedPath

  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
          className="flex w-full items-center gap-1.5 rounded-md py-[4px] pr-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {open
            ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
          {open
            ? <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-60" />
            : <Folder className="h-3.5 w-3.5 shrink-0 opacity-60" />}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {open && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.13, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <CodeTreeNode
                  key={child.path}
                  node={child}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  depth={depth + 1}
                  fileStatuses={fileStatuses}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const diffStatus = fileStatuses?.get(node.path)

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md py-[4px] pr-2 text-left text-[12px] transition-colors",
        isSelected
          ? "bg-foreground/8 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 14 + 24}px` }}
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {diffStatus === "new" && (
        <span className="ml-auto mr-1 shrink-0 rounded-sm bg-success/20 px-1 py-px font-mono text-[9px] font-semibold uppercase text-success">
          A
        </span>
      )}
      {diffStatus === "modified" && (
        <span className="ml-auto mr-1 shrink-0 rounded-sm bg-warning/20 px-1 py-px font-mono text-[9px] font-semibold uppercase text-warning">
          M
        </span>
      )}
    </button>
  )
}
