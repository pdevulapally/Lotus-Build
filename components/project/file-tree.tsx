"use client"

import { useState } from "react"
import { ChevronRight, ChevronDown, FileCode, FolderOpen, Folder as FolderIcon, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { FileNode, GeneratedFile } from "@/lib/projects/types"
import { buildFileTree, getLanguageFromPath } from "@/lib/projects/utils"

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase()
  const colors: Record<string, string> = {
    tsx: "text-muted-foreground",
    ts: "text-muted-foreground",
    jsx: "text-muted-foreground",
    js: "text-muted-foreground",
    css: "text-muted-foreground",
    scss: "text-muted-foreground",
    json: "text-muted-foreground",
    md: "text-muted-foreground",
    yml: "text-muted-foreground",
    yaml: "text-muted-foreground",
    env: "text-muted-foreground",
    txt: "text-muted-foreground",
    html: "text-muted-foreground",
    svg: "text-muted-foreground",
    png: "text-muted-foreground",
    jpg: "text-muted-foreground",
    jpeg: "text-muted-foreground",
    gif: "text-muted-foreground",
  }
  return colors[ext || ""] || "text-muted-foreground"
}

function FileTreeItem({
  node,
  selectedFile,
  onSelect,
  depth = 0,
}: {
  node: FileNode
  selectedFile: GeneratedFile | null
  onSelect: (file: GeneratedFile) => void
  depth?: number
}) {
  const [isOpen, setIsOpen] = useState(depth < 2)
  const isSelected = selectedFile?.path === node.path

  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="truncate text-foreground">{node.name}</span>
        </button>
        <AnimatePresence>
          {isOpen && node.children && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {node.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  selectedFile={selectedFile}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      initial={node.isGenerating ? { opacity: 0, x: -10 } : false}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect({ path: node.path, content: node.content || "" })}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <div className="h-3.5 w-3.5" />
      {node.isGenerating ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <FileCode className={cn("h-4 w-4", getFileIcon(node.name), isSelected && "text-accent-foreground")} />
      )}
      <span className="truncate">{node.name}</span>
      {node.isGenerating && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span className="h-1 w-1 rounded-full bg-muted-foreground animate-pulse" />
          writing...
        </motion.span>
      )}
    </motion.button>
  )
}

export interface ProjectFileTreeProps {
  files: GeneratedFile[]
  selectedFile: GeneratedFile | null
  onSelectFile: (file: GeneratedFile) => void
  isGenerating?: boolean
}

export function ProjectFileTree({ files, selectedFile, onSelectFile, isGenerating }: ProjectFileTreeProps) {
  const fileTree = buildFileTree(files)
  return (
    <div className="custom-scrollbar w-56 flex-shrink-0 overflow-y-auto border-r border-border bg-card">
      <div className="p-2.5">
        <div className="flex items-center justify-between px-2 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Files</span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {isGenerating && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                generating
              </>
            )}
            {files.length > 0 && (
              <span className="font-mono">
                {files.length} · {(files.reduce((acc, f) => acc + (f.content?.length ?? 0), 0) / 1024).toFixed(1)}k
              </span>
            )}
          </span>
        </div>
        {fileTree.length > 0 ? (
          <div className="space-y-0.5">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                onSelect={onSelectFile}
              />
            ))}
          </div>
        ) : (
          <div className="px-2 py-8 text-center">
            <FileCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No files yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export { getLanguageFromPath }
