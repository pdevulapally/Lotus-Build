"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, Check, ChevronDown, ChevronRight, Copy, ExternalLink, FileCode, Folder, FolderOpen, Globe2, Home, Laptop, Loader2, Monitor, RotateCcw, ShieldAlert, Wrench } from "lucide-react"
import Editor, { DiffEditor, type Monaco } from "@monaco-editor/react"
import { MobilePreview } from "@/components/computer/mobile-preview"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { normalizePlatform } from "@/lib/projects/platform"
import { buildFileTree, getLanguageFromPath } from "@/lib/projects/utils"
import type { FileNode } from "@/lib/projects/types"
import type { ComputerSessionProgress } from "@/components/computer/session-progress-model"
import {
  getEventTitle,
  type BrowserInspection,
  type ComputerSessionResponse,
  type ComputerSessionStatus,
  type ComputerTimelineEvent,
  type WorkspaceTab,
} from "@/components/computer/session-types"
import { cn } from "@/lib/utils"

function formatBrowserHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "Browser"
  }
}

type ResearchBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "metadata"; entries: Array<{ label: string; value: string }> }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "tags"; tags: string[] }
  | { type: "colors"; colors: Array<{ label: string; value: string }> }

const LINK_REGEX = /https?:\/\/[^\s]+/g
const COLOR_LINE_REGEX = /^(?:HEX\s+)?(#[0-9A-Fa-f]{6})(.*)$/

function formatTextWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  text.replace(LINK_REGEX, (match, offset) => {
    if (offset > lastIndex) {
      parts.push(text.slice(lastIndex, offset))
    }
    parts.push(
      <a
        key={`${match}-${offset}`}
        href={match}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-2 transition-colors hover:text-foreground/80"
      >
        {match}
      </a>,
    )
    lastIndex = offset + match.length
    return match
  })
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

function parseResearchNotes(text: string): ResearchBlock[] {
  const lines = text.replace(/\r/g, "").split(/\n/)
  const blocks: ResearchBlock[] = []

  const normalizeLine = (line: string) => line.trim()

  let index = 0
  while (index < lines.length) {
    const line = normalizeLine(lines[index])
    if (!line) {
      index += 1
      continue
    }

    const headingMatch = line.match(/^#{1,6}\s*(.+)$/)
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[0].startsWith("#") ? headingMatch[0].match(/^#+/)?.[0].length ?? 2 : 2, text: headingMatch[1].trim() })
      index += 1
      continue
    }

    const sectionHeading = line.match(/^(Search results|Color Palette|Browser insight|Research insight|DOM outline|Sections|Votes):?$/i)
    if (sectionHeading) {
      blocks.push({ type: "heading", level: 2, text: sectionHeading[1] })
      index += 1
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length) {
        const current = normalizeLine(lines[index])
        const numberedMatch = current.match(/^(\d+)\.\s+(.*)$/)
        if (!numberedMatch) break
        let item = numberedMatch[2]
        index += 1
        while (index < lines.length) {
          const next = normalizeLine(lines[index])
          if (!next || /^\d+\.\s+/.test(next) || /^[-*]\s+/.test(next)) break
          if (/^https?:\/\//i.test(next)) {
            item = `${item} ${next}`
            index += 1
            continue
          }
          break
        }
        items.push(item.trim())
      }
      blocks.push({ type: "list", ordered: true, items })
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length) {
        const current = normalizeLine(lines[index])
        const bulletMatch = current.match(/^[-*]\s+(.*)$/)
        if (!bulletMatch) break
        items.push(bulletMatch[1].trim())
        index += 1
      }
      blocks.push({ type: "list", ordered: false, items })
      continue
    }

    const colorLines: Array<{ label: string; value: string }> = []
    let colorIndex = index
    while (colorIndex < lines.length) {
      const current = normalizeLine(lines[colorIndex])
      const colorMatch = current.match(COLOR_LINE_REGEX)
      if (!colorMatch) break
      colorLines.push({ label: colorMatch[2].trim() || "", value: colorMatch[1] })
      colorIndex += 1
    }
    if (colorLines.length > 0) {
      blocks.push({ type: "colors", colors: colorLines })
      index = colorIndex
      continue
    }

    const metaCandidates: Array<{ label: string; value: string }> = []
    let metaIndex = index
    while (metaIndex < lines.length) {
      const current = normalizeLine(lines[metaIndex])
      const metaMatch = current.match(/^([A-Za-z0-9][A-Za-z0-9\s&'\-\/]+):\s*(.*)$/)
      if (!metaMatch) break
      metaCandidates.push({ label: metaMatch[1], value: metaMatch[2] })
      metaIndex += 1
    }
    if (metaCandidates.length > 1 || (metaCandidates.length === 1 && metaCandidates[0].value)) {
      blocks.push({ type: "metadata", entries: metaCandidates })
      index = metaIndex
      continue
    }

    if (/^This website has been created using/i.test(line)) {
      const tags: string[] = []
      index += 1
      while (index < lines.length) {
        const next = normalizeLine(lines[index])
        if (!next || /^[A-Za-z0-9][A-Za-z0-9\s&'\-\/]+:\s*(.*)$/.test(next) || /^\d+\.\s+/.test(next) || /^[-*]\s+/.test(next)) {
          break
        }
        tags.push(next)
        index += 1
      }
      if (tags.length > 0) {
        blocks.push({ type: "paragraph", text: line })
        blocks.push({ type: "tags", tags })
        continue
      }
    }

    let paragraphLines = [line]
    index += 1
    while (index < lines.length && normalizeLine(lines[index]) && !/^#{1,6}\s+/.test(normalizeLine(lines[index])) && !/^\d+\.\s+/.test(normalizeLine(lines[index])) && !/^[-*]\s+/.test(normalizeLine(lines[index])) && !/^(Search results|Color Palette|Browser insight|Research insight|DOM outline|Sections|Votes):?$/i.test(normalizeLine(lines[index])) && !/^([A-Za-z0-9][A-Za-z0-9\s&'\-\/]+):/.test(normalizeLine(lines[index])) && !COLOR_LINE_REGEX.test(normalizeLine(lines[index]))) {
      paragraphLines.push(normalizeLine(lines[index]))
      index += 1
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") })
  }
  return blocks
}

function renderResearchBlock(block: ResearchBlock, eventKey: string, index: number) {
  switch (block.type) {
    case "heading":
      return (
        <p key={`research-${eventKey}-heading-${index}-${block.text}`} className={cn(
          "mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
          block.level === 2 && "",
          block.level === 3 && "text-[11px]",
        )}>
          {block.text}
        </p>
      )
    case "metadata":
      return (
        <dl key={`research-${eventKey}-meta-${index}-${block.entries.map((entry) => entry.label).join("-")}`} className="grid gap-2 sm:grid-cols-2">
          {block.entries.map((entry) => (
            <div key={entry.label} className="rounded-2xl border border-border/50 bg-secondary/60 p-3">
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{entry.label}</dt>
              <dd className="mt-1 text-[12px] text-foreground">
                {formatTextWithLinks(entry.value || "").map((node, nodeIndex) => <span key={nodeIndex}>{node}</span>)}
              </dd>
            </div>
          ))}
        </dl>
      )
    case "paragraph":
      return (
        <p key={`para-${index}-${block.text.slice(0, 40)}`} className="text-[12.5px] leading-relaxed text-muted-foreground">
          {formatTextWithLinks(block.text)}
        </p>
      )
    case "list":
      return (
        <div key={`list-${index}-${block.items.length}`} className="space-y-2">
          {block.ordered ? (
            <ol className="list-decimal space-y-2 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
              {block.items.map((item, idx) => (
                <li key={idx}>{formatTextWithLinks(item)}</li>
              ))}
            </ol>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-[12.5px] leading-relaxed text-muted-foreground">
              {block.items.map((item, idx) => (
                <li key={idx}>{formatTextWithLinks(item)}</li>
              ))}
            </ul>
          )}
        </div>
      )
    case "tags":
      return (
        <div key={`tags-${block.tags.join("-")}`} className="flex flex-wrap gap-2">
          {block.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {tag}
            </span>
          ))}
        </div>
      )
    case "colors":
      return (
        <div key={`colors-${block.colors.map((color) => color.value).join("-")}`} className="grid gap-2 sm:grid-cols-2">
          {block.colors.map((color) => (
            <div key={color.value} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/60 px-3 py-3">
              <span className="h-9 w-9 rounded-xl border border-border/60" style={{ backgroundColor: color.value }} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{color.label || "Color"}</p>
                <p className="text-[12px] text-foreground">{color.value}</p>
              </div>
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

function ResearchPanel({ events }: { events: ComputerTimelineEvent[] }) {
  const evidence = events.filter(
    (e) => (e.kind === "research" || e.kind === "browser") && Boolean(e.description?.trim())
  )
  if (evidence.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-[13px] font-medium text-foreground">No research yet</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Notes from research and page inspection will show up here.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin] sm:p-5">
      <AnimatePresence initial={false}>
        {evidence.map((event, i) => (
          <motion.div
            key={event.id ?? `${event.title}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="border-b border-border/55 pb-4 last:border-0"
          >
            <p className="text-[13px] font-medium text-foreground">{getEventTitle(event)}</p>
            <div className="mt-3 space-y-3">
              {parseResearchNotes(event.description || "pdf").map((block, blockIndex) => renderResearchBlock(block, event.id ?? `${event.title}-${i}`, blockIndex))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function WorkspaceHeaderLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">Open in new tab</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  )
}

function RuntimeErrorCard({
  error,
  fixing,
  onFix,
  onDismiss,
}: {
  error: { message: string; stack: string }
  fixing: boolean
  onFix: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="lotus-glass-strong absolute bottom-4 right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-destructive/20">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[12px] font-semibold text-foreground">Something went wrong</span>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">×</button>
      </div>
      <div className="px-3.5 py-3">
        <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{error.message}</p>
        {error.stack && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[11px] text-muted-foreground hover:text-foreground">
            {expanded ? "Hide details" : "Show details"}
          </button>
        )}
        {expanded && error.stack && (
          <pre className="lotus-glass-inset mt-1.5 max-h-[120px] overflow-y-auto rounded-lg p-2 text-[10px] leading-relaxed text-muted-foreground [scrollbar-width:thin]">
            {error.stack}
          </pre>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border/60 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onFix}
          disabled={fixing}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-[12px] font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
        >
          <Wrench className="h-3.5 w-3.5" />
          {fixing ? "Fixing..." : "Fix with AI"}
        </button>
      </div>
    </div>
  )
}

function LaptopSwitcher({ label, title, onClick, icon }: {
  label: string; title: string; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lotus-glass-control absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
    >
      <span className="flex h-5 w-5 items-center justify-center text-muted-foreground">{icon}</span>
      <span>
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <span className="block max-w-[140px] truncate text-[12px] font-medium text-foreground">{title}</span>
      </span>
    </button>
  )
}

function SessionProgressSurface({ progress }: { progress: ComputerSessionProgress }) {
  return (
    <motion.div key={`progress-${progress.state}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
      className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="lotus-glass-inset mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground">
          <Monitor className="h-4 w-4" />
        </div>
        {progress.active ? (
          <TextShimmer className="text-[13px] font-medium">{progress.label}</TextShimmer>
        ) : (
          <p className="text-[13px] font-medium text-foreground">{progress.label}</p>
        )}
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
          {progress.description}
        </p>
        {progress.detail && progress.detail !== progress.description && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            {progress.detail}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Code panel ──────────────────────────────────────────────────────────────

type DiffStatus = "new" | "modified" | "unchanged"

function CodeTreeNode({
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
          className="flex w-full items-center gap-1.5 rounded-md py-[4px] pr-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
        "flex w-full items-center gap-1.5 rounded-md py-[4px] pr-2 text-[12px] transition-colors",
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

const EDITOR_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  fontSize: 12.5,
  lineNumbers: "on" as const,
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  automaticLayout: true,
  padding: { top: 16, bottom: 16 },
  renderLineHighlight: "line" as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
  fontLigatures: true,
  renderWhitespace: "none" as const,
  lineDecorationsWidth: 8,
}

// Resolves a CSS custom property (oklch/color-mix, etc.) to a "#rrggbb" string
// by letting the browser compute it, instead of hardcoding hex values here —
// this is how the editor chrome stays in sync with the app's design tokens.
function resolveCssVarToHex(varName: string, dark: boolean): string {
  const probe = document.createElement("div")
  probe.style.cssText = "position:fixed;top:-9999px;left:-9999px;pointer-events:none;"
  if (dark) probe.classList.add("dark")
  probe.style.color = `var(${varName})`
  document.body.appendChild(probe)
  const rgb = getComputedStyle(probe).color
  document.body.removeChild(probe)
  const channels = rgb.match(/[\d.]+/g)
  if (!channels) return dark ? "#1e1e1e" : "#ffffff"
  const [r, g, b] = channels.map(Number)
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
}

let monacoThemesDefined = false

function defineLotusMonacoThemes(monaco: Monaco) {
  if (monacoThemesDefined) return
  monacoThemesDefined = true
  for (const dark of [false, true]) {
    const color = (varName: string) => resolveCssVarToHex(varName, dark)
    monaco.editor.defineTheme(dark ? "lotus-dark" : "lotus-light", {
      base: dark ? "vs-dark" : "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": color("--card"),
        "editor.foreground": color("--foreground"),
        "editorLineNumber.foreground": color("--muted-foreground"),
        "editorLineNumber.activeForeground": color("--foreground"),
        "editor.lineHighlightBackground": color("--muted"),
        "editorGutter.background": color("--card"),
        "editorCursor.foreground": color("--accent"),
        "editor.selectionBackground": color("--accent-soft"),
        "editorWidget.background": color("--popover"),
        "editorWidget.border": color("--border"),
        "scrollbarSlider.background": color("--border-strong"),
        "scrollbarSlider.hoverBackground": color("--muted-foreground"),
      },
    })
  }
}

function ComputerCodePanel({
  files,
  codeTheme = "light",
  projectId,
  getAuthHeader,
}: {
  files: Array<{ path: string; content: string }>
  codeTheme?: "dark" | "light"
  projectId?: string
  getAuthHeader?: () => Promise<Record<string, string>>
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDiffMode, setIsDiffMode] = useState(false)
  const [prevFiles, setPrevFiles] = useState<Map<string, string>>(new Map())
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [hasPrevVersion, setHasPrevVersion] = useState<boolean | null>(null)

  const tree = buildFileTree(files.map((f) => ({ path: f.path, content: f.content })))

  useEffect(() => {
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path)
    }
  }, [files, selectedPath])

  // Reset diff state when files change (new run completed)
  useEffect(() => {
    setPrevFiles(new Map())
    setHasPrevVersion(null)
    setDiffError(null)
  }, [files.length])

  const selectedFile = files.find((f) => f.path === selectedPath) ?? (files.length > 0 ? files[0] : null)
  const language = selectedFile ? getLanguageFromPath(selectedFile.path) : "plaintext"
  const totalKb = (files.reduce((acc, f) => acc + f.content.length, 0) / 1024).toFixed(1)
  const monacoTheme = codeTheme === "dark" ? "lotus-dark" : "lotus-light"

  const fileStatuses = isDiffMode
    ? new Map(
        files.map((f): [string, DiffStatus] => {
          if (!prevFiles.has(f.path)) return [f.path, "new"]
          return [f.path, prevFiles.get(f.path) !== f.content ? "modified" : "unchanged"]
        })
      )
    : undefined

  const loadPrevVersion = async () => {
    if (!projectId || !getAuthHeader) return
    setDiffLoading(true)
    setDiffError(null)
    try {
      const auth = await getAuthHeader()
      const listRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/versions`, { headers: auth })
      const listJson = await listRes.json().catch(() => ({})) as {
        versions?: Array<{ id: string }>
      }
      const versions = listJson.versions ?? []
      if (versions.length < 2) {
        setHasPrevVersion(false)
        return
      }
      setHasPrevVersion(true)
      const prevId = versions[1].id
      const prevRes = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(prevId)}`,
        { headers: auth }
      )
      const prevJson = await prevRes.json().catch(() => ({})) as {
        version?: { files?: Array<{ path: string; content: string }> }
      }
      const prevFileList = prevJson.version?.files ?? []
      setPrevFiles(new Map(prevFileList.map((f) => [f.path, f.content])))
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : "Failed to load diff")
    } finally {
      setDiffLoading(false)
    }
  }

  const handleDiffToggle = () => {
    const next = !isDiffMode
    setIsDiffMode(next)
    if (next && prevFiles.size === 0 && hasPrevVersion !== false) {
      void loadPrevVersion()
    }
  }

  const handleCopy = () => {
    if (!selectedFile) return
    void navigator.clipboard.writeText(selectedFile.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const prevContent = isDiffMode && selectedFile ? (prevFiles.get(selectedFile.path) ?? "") : ""
  const changedCount = fileStatuses
    ? [...fileStatuses.values()].filter((s) => s !== "unchanged").length
    : 0

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* File tree */}
      <div className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r border-border/35">
        {/* Tree header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
            Files
          </span>
          <div className="flex items-center gap-1">
            {isDiffMode && changedCount > 0 && (
              <span className="rounded-md bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-warning">
                {changedCount} changed
              </span>
            )}
            <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
              {files.length}
            </span>
          </div>
        </div>

        {/* Diff / Source toggle */}
        {projectId && getAuthHeader && (
          <div className="shrink-0 border-b border-border/30 px-2 py-1.5">
            <div className="lotus-glass-control flex items-center rounded-full border border-border/50 p-0.5">
              <button
                type="button"
                onClick={() => isDiffMode && handleDiffToggle()}
                aria-pressed={!isDiffMode}
                className={cn(
                  "flex h-5 flex-1 items-center justify-center rounded-full text-[11px] font-semibold transition-all",
                  !isDiffMode ? "bg-card/80 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Source
              </button>
              <button
                type="button"
                onClick={() => !isDiffMode && handleDiffToggle()}
                disabled={diffLoading}
                aria-pressed={isDiffMode}
                className={cn(
                  "flex h-5 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50",
                  isDiffMode ? "bg-card/80 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {diffLoading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                Diff
              </button>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]" aria-label="Generated files">
          {tree.length > 0 ? (
            <div className="space-y-px">
              {tree.map((node) => (
                <CodeTreeNode
                  key={node.path}
                  node={node}
                  selectedPath={selectedFile?.path ?? null}
                  onSelect={setSelectedPath}
                  fileStatuses={fileStatuses}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <FileCode className="mb-2 h-6 w-6 text-muted-foreground/25" />
              <p className="text-[11px] text-muted-foreground/50">No files yet</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/30 px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground/40">{totalKb}k total</p>
        </div>
      </div>

      {/* Code / Diff viewer */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" aria-label="Selected file viewer">
        {selectedFile ? (
          <>
            {/* File header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/30 px-4 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="min-w-0 truncate font-mono text-[12px] text-muted-foreground">
                  {selectedFile.path}
                </span>
                {isDiffMode && fileStatuses?.get(selectedFile.path) === "new" && (
                  <span className="shrink-0 rounded-sm bg-success/20 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                    New file
                  </span>
                )}
                {isDiffMode && fileStatuses?.get(selectedFile.path) === "unchanged" && (
                  <span className="shrink-0 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                    Unchanged
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isDiffMode && (
                  <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                    {language}
                  </span>
                )}
                {!isDiffMode && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy file content"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                  >
                    {copied
                      ? <Check className="h-3.5 w-3.5 text-success" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="min-h-0 flex-1">
              {isDiffMode && diffError && (
                <div className="flex h-full items-center justify-center" role="status">
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-destructive">Could not load diff</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{diffError}</p>
                    <button
                      type="button"
                      onClick={() => { setDiffError(null); void loadPrevVersion() }}
                      className="mt-3 rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted/80"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
              {isDiffMode && !diffError && hasPrevVersion === false && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground">No previous version</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      This is the first build — nothing to compare against yet.
                    </p>
                  </div>
                </div>
              )}
              {isDiffMode && !diffError && hasPrevVersion !== false && !diffLoading && (
                <DiffEditor
                  height="100%"
                  language={language}
                  original={prevContent}
                  modified={selectedFile.content}
                  theme={monacoTheme}
                  beforeMount={defineLotusMonacoThemes}
                  loading={
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                    </div>
                  }
                  options={{
                    ...EDITOR_OPTIONS,
                    renderSideBySide: true,
                    enableSplitViewResizing: true,
                  }}
                />
              )}
              {isDiffMode && diffLoading && (
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[12px]">Loading diff…</span>
                </div>
              )}
              {!isDiffMode && (
                <Editor
                  height="100%"
                  language={language}
                  value={selectedFile.content}
                  theme={monacoTheme}
                  beforeMount={defineLotusMonacoThemes}
                  loading={
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                    </div>
                  }
                  options={EDITOR_OPTIONS}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FileCode className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
              <p className="text-[13px] font-medium text-foreground">Select a file</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Choose a file from the tree to view its source
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Workspace tab bar ────────────────────────────────────────────────────────

export function WorkspaceTabBar({
  activeTab,
  previewUrl,
  onRefreshPreview,
  onNavigatePreview,
}: {
  activeTab: WorkspaceTab
  previewUrl?: string | null
  onRefreshPreview?: () => void
  onNavigatePreview?: (url: string) => void
}) {
  const [urlPath, setUrlPath] = useState("/")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!previewUrl) { setUrlPath("/"); return }
    try {
      const u = new URL(previewUrl)
      setUrlPath(u.pathname || "/")
    } catch {
      setUrlPath("/")
    }
  }, [previewUrl])

  const previewOrigin = previewUrl ? (() => {
    try { return new URL(previewUrl).origin } catch { return "" }
  })() : ""

  const commitNav = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`
    setUrlPath(normalized)
    if (previewOrigin) onNavigatePreview?.(previewOrigin + normalized)
  }

  if (activeTab !== "preview" || !previewUrl) return null

  return (
    <div className="lotus-glass-inset hidden h-10 shrink-0 items-center justify-center border-b border-border/40 px-4 sm:flex">
      {/* Centered constrained URL pill */}
      <div className="lotus-glass-control group flex w-full max-w-sm items-center gap-0.5 overflow-hidden rounded-full border border-border/60 px-1 transition-colors focus-within:border-border/80 hover:border-border/70">

        {/* Home */}
        <button
          type="button"
          aria-label="Go to root"
          onClick={() => commitNav("/")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <Home className="h-3.5 w-3.5" />
        </button>

        {/* Host (dimmed, truncated) */}
        {previewOrigin && (
          <span className="max-w-[130px] shrink truncate select-none text-[11px] text-foreground/50">
            {previewOrigin.replace(/^https?:\/\//, "")}
          </span>
        )}

        {/* Slash + path */}
        <div className="flex min-w-[40px] flex-1 items-center">
          <span className="shrink-0 select-none text-[12px] text-foreground/40">/</span>
          <input
            ref={inputRef}
            aria-label="Preview path"
            value={urlPath.replace(/^\//, "")}
            onChange={(e) => setUrlPath("/" + e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNav(urlPath)
              if (e.key === "Escape") inputRef.current?.blur()
            }}
            onClick={() => inputRef.current?.select()}
            className="min-w-0 flex-1 bg-transparent py-0.5 text-[12px] text-foreground outline-none placeholder:text-foreground/30"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* External link */}
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in new tab"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Refresh */}
        <button
          type="button"
          aria-label="Refresh preview"
          onClick={onRefreshPreview}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function WorkspaceContent({
  session,
  status,
  progress,
  activeTab,
  browserInspection,
  hasProjectFiles,
  projectFileCount,
  isEnsuringPreview,
  previewEnsureError,
  onSwitchView,
  runtimeError,
  fixingError,
  onFixError,
  onDismissError,
  onRetryPreview,
  getAuthHeader,
  previewSyncNonce = 0,
  previewSrc,
  iframeReloadNonce = 0,
  files = [],
  codeTheme = "light",
}: {
  session: ComputerSessionResponse
  status: ComputerSessionStatus
  progress?: ComputerSessionProgress | null
  activeTab: WorkspaceTab
  browserInspection: BrowserInspection | null
  hasProjectFiles: boolean
  projectFileCount: number
  isEnsuringPreview: boolean
  previewEnsureError: string | null
  onSwitchView: (v: WorkspaceTab) => void
  runtimeError: { message: string; stack: string } | null
  fixingError: boolean
  onFixError: () => void
  onDismissError: () => void
  onRetryPreview: () => void
  getAuthHeader: () => Promise<Record<string, string>>
  previewSyncNonce?: number
  previewSrc?: string | null
  iframeReloadNonce?: number
  files?: Array<{ path: string; content: string }>
  codeTheme?: "dark" | "light"
}) {
  const sessionPlatform = normalizePlatform(session.platform)
  const workspaceProgress = progress ?? {
    state: status === "error" ? "error" : status === "complete" ? "complete" : "idle",
    label: status === "complete" ? "Preview ready" : "Ready to build",
    description: status === "complete" ? "Your generated app is ready to review." : "Send a message to start building.",
    active: false,
  } satisfies ComputerSessionProgress

  if (activeTab === "code") {
    return (
      <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="h-full min-h-0">
        <ComputerCodePanel
          files={files}
          codeTheme={codeTheme}
          projectId={session.projectId}
          getAuthHeader={getAuthHeader}
        />
      </motion.div>
    )
  }

  if (activeTab === "research") {
    return <ResearchPanel events={session.timeline} />
  }

  if (activeTab === "browser" && browserInspection) {
    return (
      <motion.div key="browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col bg-background p-3 lg:p-4">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground">
              {formatBrowserHost(browserInspection.url)}
            </p>
            {browserInspection.title && browserInspection.title !== browserInspection.url && (
              <p className="truncate text-[10.5px] text-muted-foreground">{browserInspection.title}</p>
            )}
          </div>
          <WorkspaceHeaderLink href={browserInspection.url} />
        </div>
        <div className="lotus-glass-panel relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60">
          {browserInspection.liveUrl && !browserInspection.isExpired ? (
            <iframe
              src={browserInspection.liveUrl}
              className="h-full w-full bg-card"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              title="Remote browser"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                {browserInspection.isExpired ? "Live view has expired." : "Live view unavailable."}
              </p>
              <a href={browserInspection.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground underline underline-offset-2 hover:text-foreground/80">
                Open page in new tab
              </a>
            </div>
          )}
          {session.previewUrl && (
            <LaptopSwitcher label="Preview" title="Generated app"
              icon={<Monitor className="h-3.5 w-3.5" />} onClick={() => onSwitchView("preview")} />
          )}
        </div>
      </motion.div>
    )
  }

  if (activeTab === "preview" && sessionPlatform === "mobile" && session.projectId && projectFileCount > 0) {
    return (
      <motion.div key="mobile-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
        className="flex h-full min-h-0 flex-col">
        <MobilePreview
          projectId={session.projectId}
          getAuthHeader={getAuthHeader}
          syncNonce={previewSyncNonce}
          className="h-full"
        />
      </motion.div>
    )
  }

  if (activeTab === "preview" && sessionPlatform === "mobile" && session.projectId && !hasProjectFiles) {
    return <SessionProgressSurface progress={workspaceProgress} />
  }

  if (activeTab === "preview" && session.previewUrl) {
    const effectivePreviewSrc = previewSrc || session.previewUrl
    const iframeKey = `${effectivePreviewSrc}__${iframeReloadNonce}`
    return <PreviewPane
      iframeKey={iframeKey}
      src={effectivePreviewSrc}
      isEnsuringPreview={isEnsuringPreview}
      previewEnsureError={previewEnsureError}
      onRetryPreview={onRetryPreview}
      browserInspection={browserInspection}
      onSwitchView={onSwitchView}
      runtimeError={runtimeError}
      fixingError={fixingError}
      onFixError={onFixError}
      onDismissError={onDismissError}
    />
  }

  return <SessionProgressSurface progress={workspaceProgress} />
}

function PreviewPane({
  iframeKey,
  src,
  isEnsuringPreview,
  previewEnsureError,
  onRetryPreview,
  browserInspection,
  onSwitchView,
  runtimeError,
  fixingError,
  onFixError,
  onDismissError,
}: {
  iframeKey: string
  src: string
  isEnsuringPreview: boolean
  previewEnsureError: string | null
  onRetryPreview: () => void
  browserInspection: BrowserInspection | null
  onSwitchView: (v: WorkspaceTab) => void
  runtimeError: { message: string; stack: string } | null
  fixingError: boolean
  onFixError: () => void
  onDismissError: () => void
}) {
  const [isIframeLoading, setIsIframeLoading] = useState(true)

  useEffect(() => {
    setIsIframeLoading(true)
  }, [iframeKey])

  return (
    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}
      className="flex h-full min-h-0 flex-col bg-background">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <iframe
          key={iframeKey}
          src={src}
          className="h-full w-full bg-card"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Live preview"
          onLoad={() => setIsIframeLoading(false)}
        />

        {/* Loading banner — only while iframe is actually loading */}
        {isIframeLoading && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-4">
            <div className="lotus-glass-control flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading preview…
            </div>
          </div>
        )}

        {previewEnsureError && !isEnsuringPreview && (
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center p-4">
              <div className="lotus-glass-strong flex max-w-[360px] items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-[12px] text-muted-foreground">
                <span className="min-w-0 flex-1">{previewEnsureError}</span>
                <button type="button" onClick={onRetryPreview} className="shrink-0 rounded-full px-2 py-1 text-[12px] font-medium text-foreground hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                  Retry
                </button>
              </div>
            </div>
          )}
          {browserInspection && !browserInspection.isExpired && (
            <LaptopSwitcher label="Browser" title={formatBrowserHost(browserInspection.url)}
              icon={<Globe2 className="h-3.5 w-3.5" />} onClick={() => onSwitchView("browser")} />
          )}
          {runtimeError && (
            <RuntimeErrorCard error={runtimeError} fixing={fixingError} onFix={onFixError} onDismiss={onDismissError} />
          )}
        </div>
      </motion.div>
    )
}

export function LoadingShell() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="lotus-glass shrink-0 px-4 py-3">
        <div className="flex h-10 items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        </div>
      </header>
      <div className="flex flex-1 gap-0 overflow-hidden">
        <div className="hidden w-[380px] shrink-0 animate-pulse border-r border-border/80 bg-card sm:block" />
        <div className="flex-1 animate-pulse bg-muted/35 p-3">
          <div className="lotus-glass-panel h-full rounded-lg border border-border/70" />
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <h1 className="text-[15px] font-semibold text-foreground">Session not found</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
        <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-foreground/80">
          Back home
        </Link>
      </div>
    </div>
  )
}
