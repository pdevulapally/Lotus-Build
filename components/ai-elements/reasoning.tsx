"use client"

import * as React from "react"
import { Brain, ChevronDown } from "lucide-react"
import { motion } from "framer-motion"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { cn } from "@/lib/utils"

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

function sanitizeReasoningText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*{0,2}Tool:\*{0,2}\s*\S+[^\n]*\n[ \t]*\*{0,2}Query:\*{0,2}[^\n]+/g, "")
    .replace(/^[ \t]*\*{0,2}Tool:\*{0,2}[^\n]*$/gm, "")
    // Strip tool result blocks echoed into reasoning (e.g. "Assistant (research_results): ...")
    .replace(/^Assistant\s*\([^)]*\):[^\n]*(?:\n(?!\n)[^\n]*)*/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]*)\*\*/g, "$1")
    .replace(/__([^_\n]*)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, "$1")
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "")
    // Trim leading/trailing whitespace from every line
    .replace(/^[ \t]+|[ \t]+$/gm, "")
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
          className="my-1.5 overflow-x-auto rounded-lg bg-zinc-100 px-3 py-2 text-[11.5px] font-mono leading-relaxed [overflow-wrap:normal] dark:bg-zinc-800"
        >
          {block.lang ? (
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-400">{block.lang}</span>
          ) : null}
          <code className="whitespace-pre text-zinc-700 dark:text-zinc-300">{block.content}</code>
        </pre>
      )
    }
    return (
      <span key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {block.content}
      </span>
    )
  })
}

/**
 * Animates text from empty to full on first mount when isStreaming=true.
 * Uses a mount-time ref so the animation never re-triggers for already-seen text
 * when a new session starts (which would change the isStreaming prop on old components).
 */
function useStreamingText(fullText: string, isStreaming: boolean) {
  const wasStreamingOnMountRef = React.useRef(isStreaming)

  // Pre-chunk on mount so the second effect can start immediately
  const tokensRef = React.useRef<string[]>(
    wasStreamingOnMountRef.current ? chunkIntoTokens(fullText) : []
  )
  const indexRef = React.useRef(0)

  const [visibleText, setVisibleText] = React.useState(
    wasStreamingOnMountRef.current ? "" : fullText
  )

  // If fullText ever changes (shouldn't happen for completed events) restart
  React.useEffect(() => {
    if (!wasStreamingOnMountRef.current) {
      setVisibleText(fullText)
      return
    }
    tokensRef.current = chunkIntoTokens(fullText)
    indexRef.current = 0
    setVisibleText("")
  }, [fullText])

  // Advance one token per tick
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
  }, [visibleText])

  return visibleText
}

export function Reasoning({
  className,
  isStreaming,
  defaultOpen = true,
  children,
}: {
  className?: string
  isStreaming?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  React.useEffect(() => {
    if (isStreaming) setOpen(true)
  }, [isStreaming])

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
        "flex w-full items-center gap-2 py-1 text-left outline-none transition-colors hover:text-foreground",
        className,
      )}
    >
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]/reasoning:-rotate-90" />
      {isStreaming ? (
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 1, 0.65] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="shrink-0"
        >
          <Brain className="h-3.5 w-3.5 text-foreground/80" />
        </motion.div>
      ) : (
        <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {isStreaming ? (
        <TextShimmer className="text-[13px] font-medium">
          {title}
        </TextShimmer>
      ) : (
        <span className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
          {title}
        </span>
      )}
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
          "pl-[1.375rem] pt-1.5 text-[13px] leading-[1.65] text-muted-foreground",
          className,
        )}
      >
        {isStringContent ? (
          <>
            {renderContentBlocks(parseContentBlocks(displayText))}
            {isTyping && (
              <span className="ml-px inline-block h-[0.8em] w-[1.5px] animate-pulse rounded-[1px] bg-muted-foreground/70 align-baseline" />
            )}
          </>
        ) : children}
      </div>
    </CollapsibleContent>
  )
}
