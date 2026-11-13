"use client"

import * as React from "react"
import { Brain, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/ui/markdown"

type ReasoningContextValue = {
  isStreaming: boolean
  open: boolean
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null)

function useReasoningContext() {
  const context = React.useContext(ReasoningContext)
  if (!context) {
    throw new Error("Reasoning compound components must be rendered inside <Reasoning>.")
  }
  return context
}

/** Keep model-facing JSON payloads out of the thought-process prose. */
function stripAgentPayloads(text: string): string {
  return text
    // Standalone JSON payloads with a "type" key (multiline or compact)
    .replace(/^[ \t]*\{\s*\n?[ \t]*"type"\s*:\s*"[^"]*"[\s\S]*?^[ \t]*\}[ \t]*$/gm, "")
    .replace(/^[ \t]*\{\s*"type"\s*:\s*"[^"]*"[^}]*\}[ \t]*$/gm, "")
    // Truncated standalone JSON payload still streaming (no closing brace yet)
    .replace(/^[ \t]*\{\s*\n?[ \t]*"type"\s*:\s*"[^"]*"[\s\S]*$/gm, "")
}

function sanitizeReasoningText(text: string): string {
  return stripAgentPayloads(text)
    .replace(/\*{0,2}Tool:\*{0,2}\s*\S+[^\n]*\n[ \t]*\*{0,2}Query:\*{0,2}[^\n]+/g, "")
    .replace(/^[ \t]*\*{0,2}Tool:\*{0,2}[^\n]*$/gm, "")
    // Strip tool result blocks echoed into reasoning (e.g. "Assistant (research_results): ...")
    .replace(/^Assistant\s*\([^)]*\):[^\n]*(?:\n(?!\n)[^\n]*)*/gm, "")
    // Normalise to at most one blank line between paragraphs
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}

function chunkIntoTokens(text: string): string[] {
  const chunks: string[] = []
  let index = 0
  while (index < text.length) {
    const chunkSize = Math.floor(Math.random() * 3) + 2
    chunks.push(text.slice(index, index + chunkSize))
    index += chunkSize
  }
  return chunks
}

type TextBlock = { type: "text"; content: string }
type CodeBlock = { type: "code"; lang: string; content: string }
type ContentBlock = TextBlock | CodeBlock

function parseContentBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    blocks.push({ type: "code", lang: match[1] ?? "", content: match[2] ?? "" })
    lastIndex = match.index + match[0].length
  }

  const remaining = text.slice(lastIndex)
  if (remaining) {
    blocks.push({ type: "text", content: remaining })
  }

  return blocks
}

function renderContentBlocks(blocks: ContentBlock[]): React.ReactNode {
  return blocks.map((block, i) => {
    if (block.type === "code") {
      return (
        <pre
          key={i}
          className="my-3 overflow-x-auto rounded-xl bg-muted/55 p-3 font-mono text-xs leading-6 [overflow-wrap:normal]"
        >
          {block.lang ? (
            <span className="mb-2 block font-sans text-xs font-medium text-muted-foreground">{block.lang}</span>
          ) : null}
          <code className="whitespace-pre text-foreground/75">{block.content}</code>
        </pre>
      )
    }
    // An incomplete fence stays literal until parseContentBlocks receives its closing fence.
    if (block.content.includes('```')) return <span key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{block.content}</span>
    return <Markdown key={i} className="text-sm leading-7 text-muted-foreground [&_p]:my-3 [&_h3]:text-sm [&_h4]:text-sm [&_blockquote]:border-0 [&_blockquote]:pl-0 [&_hr]:hidden">{block.content}</Markdown>
  })
}

/**
 * Animates text from empty to full on first mount when isStreaming=true.
 * Uses a mount-time ref so the animation never re-triggers for already-seen text
 * when a new session starts (which would change the isStreaming prop on old components).
 *
 * fullText may grow over time (a Reasoning block spanning several narration
 * phases gets appended to as each phase lands) — when it grows, only the new
 * suffix is queued so already-typed text is never re-animated from scratch.
 */
function useStreamingText(fullText: string, isStreaming: boolean) {
  const wasStreamingOnMountRef = React.useRef(isStreaming)

  // Pre-chunk on mount so the second effect can start immediately
  const tokensRef = React.useRef<string[]>(
    wasStreamingOnMountRef.current ? chunkIntoTokens(fullText) : []
  )
  const indexRef = React.useRef(0)
  const knownTextRef = React.useRef(fullText)

  const [visibleText, setVisibleText] = React.useState(
    wasStreamingOnMountRef.current ? "" : fullText
  )

  React.useEffect(() => {
    if (!wasStreamingOnMountRef.current) {
      setVisibleText(fullText)
      return
    }
    if (fullText === knownTextRef.current) return

    const isAppend = fullText.startsWith(knownTextRef.current)
    if (!isAppend) {
      // Text changed from under us rather than growing — restart clean.
      tokensRef.current = []
      indexRef.current = 0
      setVisibleText("")
    }
    const newSegment = isAppend ? fullText.slice(knownTextRef.current.length) : fullText
    tokensRef.current.push(...chunkIntoTokens(newSegment))
    knownTextRef.current = fullText
  }, [fullText])

  // Advance one token per tick. Re-checked whenever fullText changes too, so
  // newly queued tokens resume even if typing had already caught up.
  React.useEffect(() => {
    if (!wasStreamingOnMountRef.current) return
    if (indexRef.current >= tokensRef.current.length) return

    const delay = 5 + Math.floor(Math.random() * 9)
    const timer = window.setTimeout(() => {
      const nextToken = tokensRef.current[indexRef.current]
      indexRef.current += 1
      setVisibleText((c) => c + nextToken)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [visibleText, fullText])

  return visibleText
}

export function Reasoning({
  className,
  isStreaming,
  defaultOpen = true,
  autoOpen = true,
  children,
}: {
  className?: string
  isStreaming?: boolean
  defaultOpen?: boolean
  /** Whether streaming unfolds the block; false keeps it collapsed until the user opens it. */
  autoOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    if (isStreaming && autoOpen) setOpen(true)
  }, [isStreaming, autoOpen])

  return (
    <ReasoningContext.Provider value={{ isStreaming: Boolean(isStreaming), open }}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn("group/reasoning w-full", className)}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  )
}

export function ReasoningTrigger({
  title = "Reasoning",
  className,
}: {
  title?: string
  className?: string
}) {
  const { isStreaming } = useReasoningContext()

  return (
    <CollapsibleTrigger
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-muted-foreground outline-none hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {isStreaming ? (
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 1, 0.65] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="shrink-0"
        >
          <Brain className="h-3.5 w-3.5 text-foreground/70" />
        </motion.div>
      ) : (
        <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
      )}
      {isStreaming ? (
        <Shimmer className="text-sm font-medium motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground">
          {title}
        </Shimmer>
      ) : (
        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {title}
        </span>
      )}
      <ChevronRight className="size-3.5 shrink-0 motion-safe:transition-transform group-data-[state=open]/reasoning:rotate-90" aria-hidden="true" />
    </CollapsibleTrigger>
  )
}

export function ReasoningContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { isStreaming } = useReasoningContext()
  const rawText = typeof children === "string" ? children : ""
  const fullText = rawText ? sanitizeReasoningText(rawText) : ""
  const streamedText = useStreamingText(fullText, isStreaming && Boolean(fullText))
  const displayText = typeof children === "string" ? streamedText : rawText
  const isStringContent = typeof children === "string"
  const isTyping = isStringContent && displayText.length < fullText.length

  return (
    <CollapsibleContent>
      <div
        className={cn(
          "max-w-prose pb-2 pl-8 pr-2 pt-1 text-sm font-normal leading-7 text-muted-foreground",
          className,
        )}
      >
        {isStringContent ? (
          <>
            {renderContentBlocks(parseContentBlocks(displayText))}
            {isTyping && (
              <span className="ml-px inline-block h-[0.8em] w-[1.5px] motion-safe:animate-pulse rounded-[1px] bg-foreground/45 align-baseline" />
            )}
          </>
        ) : children}
      </div>
    </CollapsibleContent>
  )
}
