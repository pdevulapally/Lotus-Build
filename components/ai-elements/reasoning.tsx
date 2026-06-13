"use client"

import * as React from "react"
import { Brain, ChevronDown } from "lucide-react"
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

function chunkIntoTokens(text: string): string[] {
  const chunks: string[] = []
  let index = 0
  while (index < text.length) {
    const chunkSize = Math.floor(Math.random() * 2) + 3
    chunks.push(text.slice(index, index + chunkSize))
    index += chunkSize
  }
  return chunks
}

function useStreamingText(fullText: string, isStreaming: boolean) {
  const [visibleText, setVisibleText] = React.useState(isStreaming ? "" : fullText)
  const tokensRef = React.useRef<string[]>([])
  const indexRef = React.useRef(0)

  React.useEffect(() => {
    if (!isStreaming) {
      setVisibleText(fullText)
      return
    }

    tokensRef.current = chunkIntoTokens(fullText)
    indexRef.current = 0
    setVisibleText("")
  }, [fullText, isStreaming])

  React.useEffect(() => {
    if (!isStreaming) return

    if (indexRef.current >= tokensRef.current.length) return

    const timer = window.setTimeout(() => {
      const nextToken = tokensRef.current[indexRef.current]
      indexRef.current += 1
      setVisibleText((current) => current + nextToken)
    }, 18)

    return () => window.clearTimeout(timer)
  }, [isStreaming, visibleText])

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
      <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
  const fullText = typeof children === "string" ? children : ""
  const streamedText = useStreamingText(fullText, isStreaming && Boolean(fullText))
  const content = typeof children === "string" && isStreaming ? streamedText : children

  return (
    <CollapsibleContent>
      <div
        className={cn(
          "pl-[1.375rem] pt-1.5 text-[13px] leading-[1.65] text-muted-foreground",
          className,
        )}
      >
        <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{content}</div>
      </div>
    </CollapsibleContent>
  )
}
