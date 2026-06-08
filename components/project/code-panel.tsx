"use client"

import { FileCode } from "lucide-react"
import Editor from "@monaco-editor/react"
import { cn } from "@/lib/utils"
import { ProjectFileTree, getLanguageFromPath } from "./file-tree"
import type { GeneratedFile } from "@/app/project/[id]/types"

export interface CodePanelProps {
  files: GeneratedFile[]
  selectedFile: GeneratedFile | null
  onSelectFile: (file: GeneratedFile) => void
  isGenerating?: boolean
}

export function CodePanel({ files, selectedFile, onSelectFile, isGenerating }: CodePanelProps) {
  return (
    <div className="flex h-full min-w-0 bg-card">
      <ProjectFileTree
        files={files}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        isGenerating={isGenerating}
      />
      <div className="flex flex-1 flex-col bg-card">
        {!selectedFile ? (
          <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,color-mix(in_oklch,var(--surface-raised)_92%,transparent),var(--card)_56%)]">
            <div className="text-center text-muted-foreground">Select a file</div>
          </div>
        ) : (
          <>
            <div className="flex h-11 items-center border-b border-border bg-card px-4 shadow-sm">
              <FileCode className={cn("mr-2 h-4 w-4 text-muted-foreground")} />
              <span className="text-sm text-foreground">{selectedFile.path}</span>
            </div>
            <div className="min-h-0 flex-1 bg-card">
              <Editor
                height="100%"
                language={getLanguageFromPath(selectedFile.path)}
                value={selectedFile.content}
                theme="vs-light"
                loading={
                  <div className="flex h-full items-center justify-center bg-card">
                    <div className="text-sm text-muted-foreground">Loading editor...</div>
                  </div>
                }
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 16 },
                  renderLineHighlight: "line",
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  overviewRulerBorder: false,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
