"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Database,
  FileCode2,
  Loader2,
  Monitor,
  Pencil,
} from "lucide-react"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"
import { lineDiff, countDiffStats, type DiffOp } from "@/components/project/edit-tool"
import { BashTool } from "@/components/project/bash-tool"
import { SearchTool, type SearchResult } from "@/components/project/search-tool"
import { QuestionTool, type QuestionAnswer, type QuestionConfig } from "@/components/computer/question-tool"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  getEventTitle,
  getRunIdGroups,
  isTokenLimitError,
  type ComputerSessionStatus,
  type ComputerTimelineEvent,
  type LocalMessage,
} from "@/components/computer/session-types"
import type { ComputerSessionProgress } from "@/components/computer/session-progress-model"
import { cn } from "@/lib/utils"

const PROSE_EVENTS = ["Understanding insight", "Research insight", "Browser insight", "Build approach"]

const QUIET_COMPLETED_EVENTS = new Set([
  "Run started",
  "Browser fallback",
  "Scrape context collected",
  "Fallback scrape collected",
  "Generation decision",
  "Web skipped",
  "Research skipped",
  "Browser skipped",
  "Web plan",
  "Understanding request",
  // Redundant with "Preview ready" which is the user-facing signal
  "Sandbox run successful",
  // Intermediate state — "Preview ready" or sandbox error supersedes it
  "Starting sandbox",
])

function shouldHideCompletedFeedItem(event: ComputerTimelineEvent) {
  return event.status === "complete" && QUIET_COMPLETED_EVENTS.has(event.title)
}

function getGeneratingFilePath(event: ComputerTimelineEvent) {
  if (typeof event.metadata?.filePath === "string") return event.metadata.filePath
  return event.title.startsWith("Generating ") ? event.title.slice("Generating ".length).trim() : undefined
}

function getEditToolVariant(event: ComputerTimelineEvent): "edit" | "write" {
  return event.metadata?.editVariant === "edit" ? "edit" : "write"
}

function getFileContentMetadata(event: ComputerTimelineEvent) {
  return {
    oldContent: typeof event.metadata?.oldContent === "string" ? event.metadata.oldContent : undefined,
    newContent: typeof event.metadata?.newContent === "string" ? event.metadata.newContent : undefined,
  }
}

function getCommandMetadata(event: ComputerTimelineEvent) {
  const command = typeof event.metadata?.command === "string" ? event.metadata.command : ""
  if (!command.trim()) return null
  const output = typeof event.metadata?.commandOutput === "string" ? event.metadata.commandOutput : undefined
  return { command, output }
}

function getFeedItemSecondaryLine(
  title: string,
  description: string | null | undefined,
  showDetail: boolean,
) {
  if (!showDetail || !description?.trim()) return undefined
  const line = description.split("\n").map((part) => part.trim()).find(Boolean)
  if (!line) return undefined
  if (line.toLowerCase() === title.toLowerCase()) return undefined
  if (/^provider:/i.test(line)) return undefined
  return line
}

function formatClarificationAnswer(question: QuestionConfig, answer?: QuestionAnswer) {
  if (!answer || answer.kind === "skip") return "Skipped"
  if (answer.kind === "text") return answer.text?.trim() || "Answered"

  const optionLabels = new Map((question.options ?? []).map((option) => [option.id, option.label]))
  const selected = (answer.selectedIds ?? [])
    .map((id) => optionLabels.get(id) ?? id)
    .filter(Boolean)
  const parts = [...selected]
  if (answer.text?.trim()) parts.push(answer.text.trim())

  return parts.join(", ") || "Answered"
}

function formatClarificationAnswerSet(
  questions: QuestionConfig[],
  answersByQuestion?: Record<number, QuestionAnswer>,
  fallbackAnswer?: QuestionAnswer,
) {
  if (fallbackAnswer?.kind === "skip") return "skip"

  const answerEntries = questions
    .map((question, index) => ({
      question,
      answer: answersByQuestion?.[index + 1] ?? (questions.length === 1 ? fallbackAnswer : undefined),
    }))
    .filter((entry) => entry.answer)

  if (answerEntries.length === 0) return "skip"

  return answerEntries
    .map(({ question, answer }) => `Question: ${question.title}\nAnswer: ${formatClarificationAnswer(question, answer)}`)
    .join("\n\n")
}

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : part
  )
}

function sanitizePlanText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^[ \t]*[-*_]{3,}[ \t]*$/.test(line))
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function PlanDescription({ text }: { text: string }) {
  return (
    <div className="space-y-0.5 text-[12.5px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (/^[-*_]{3,}$/.test(t)) return null
        if (t.match(/^#\s+/)) return null
        const h2 = t.match(/^##\s+(.+)/)
        if (h2) return <p key={i} className="pt-2 pb-0.5 text-[12px] font-semibold text-foreground">{renderInline(h2[1])}</p>
        const h3 = t.match(/^###\s+(.+)/)
        if (h3) return <p key={i} className="pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{h3[1]}</p>
        const li = t.match(/^[-*]\s+(.+)/)
        if (li) return (
          <div key={i} className="flex items-start gap-2 text-muted-foreground">
            <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-border" />
            <span>{renderInline(li[1])}</span>
          </div>
        )
        return <p key={i} className="text-muted-foreground">{renderInline(t)}</p>
      })}
    </div>
  )
}

function SupabaseQuestionCard({ onSetup, onDecline }: { onSetup: () => void; onDecline?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const [setting, setSetting] = useState(false)

  if (dismissed) return null

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-muted/50">
      <div className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">This app needs a database</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect Supabase to add auth and persistent storage.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setSetting(true)
              try { await onSetup() } finally { setSetting(false) }
            }}
            disabled={setting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            {setting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            {setting ? "Setting up..." : "Set up Supabase"}
          </button>
          <button
            type="button"
            onClick={() => { setDismissed(true); onDecline?.() }}
            disabled={setting}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanTool({ event, onApprovePlan }: { event: ComputerTimelineEvent; onApprovePlan?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const summary = sanitizePlanText(event.description || "")

  const handleApprove = async () => {
    if (isApproving || !onApprovePlan) return
    setIsApproving(true)
    try { await onApprovePlan() } finally { setIsApproving(false) }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Plan drafted</span>
        {summary && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronsUp className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronsDown className="h-3 w-3 shrink-0" />
            )}
            {isExpanded ? "Show less" : "Read detailed plan"}
          </button>
        )}
      </div>
      {summary && (
        <div
          className={cn(
            "overflow-hidden px-3 pb-3 pt-2.5",
            !isExpanded && "max-h-[94px]",
          )}
        >
          <PlanDescription text={summary} />
        </div>
      )}
      {onApprovePlan && (
        <div className="flex items-center gap-3 border-t border-border px-3 py-2.5">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            {isApproving ? "Starting build…" : "Approve and build"}
          </button>
          <span className="text-[11px] text-muted-foreground">or type to revise</span>
        </div>
      )}
    </div>
  )
}


function FeedFileItem({
  filePath,
  variant,
  isRunning,
  isPending,
  oldContent,
  newContent,
}: {
  filePath?: string
  variant: "edit" | "write"
  isRunning: boolean
  isPending: boolean
  oldContent?: string
  newContent?: string
}) {
  const [open, setOpen] = useState(false)
  const fileName = filePath?.split("/").pop() || filePath || ""
  const isWrite = variant === "write"

  const diffOps = useMemo<DiffOp[] | null>(() => {
    if (isPending || isRunning) return null
    if (isWrite && newContent) return newContent.split("\n").map((text) => ({ type: "add" as const, text }))
    if (oldContent !== undefined && newContent !== undefined) return lineDiff(oldContent, newContent)
    return null
  }, [isPending, isRunning, isWrite, oldContent, newContent])

  const stats = useMemo(() => (diffOps ? countDiffStats(diffOps) : null), [diffOps])
  const hasDiff = Boolean(diffOps && diffOps.length > 0)

  const label = isPending || isRunning
    ? `${isWrite ? "Creating" : "Editing"} ${fileName}`
    : `${isWrite ? "Created" : "Edited"} ${fileName}`

  return (
    <div className="py-1">
      <button
        type="button"
        disabled={!hasDiff}
        onClick={() => hasDiff && setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        {isPending || isRunning ? (
          <TextShimmer className="min-w-0 flex-1 text-xs font-medium">
            {label}
          </TextShimmer>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80">{label}</span>
        )}
        {stats && !isPending && !isRunning && (stats.added > 0 || stats.removed > 0) && (
          <span className="flex shrink-0 gap-1.5 font-mono text-[11px]">
            {stats.added > 0 && <span className="text-emerald-600/80">+{stats.added}</span>}
            {stats.removed > 0 && <span className="text-rose-500/80">-{stats.removed}</span>}
          </span>
        )}
        {hasDiff && (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/30 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        )}
      </button>
      {open && hasDiff && (
        <div className="ml-6 mt-2 max-h-64 overflow-auto rounded-lg bg-muted/50 font-mono text-[11.5px] leading-[1.55] [scrollbar-width:thin]">
          {diffOps!.map((op, i) => (
            <div
              key={i}
              className={cn(
                "flex min-w-max items-start px-2.5 py-px",
                op.type === "add" && "bg-emerald-50/60 text-emerald-800",
                op.type === "remove" && "bg-rose-50/60 text-rose-800",
                op.type === "context" && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "w-4 shrink-0 select-none",
                  op.type === "add" && "text-emerald-600",
                  op.type === "remove" && "text-rose-500",
                  op.type === "context" && "text-muted-foreground/30",
                )}
              >
                {op.type === "add" ? "+" : op.type === "remove" ? "−" : " "}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre pr-3">{op.text || " "}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FeedItem({
  event,
  isSessionRunning,
  onSupabaseSetup,
  onSupabaseDecline,
  onClarificationAnswer,
  onApprovePlan,
}: {
  event: ComputerTimelineEvent
  isLatest: boolean
  isSessionRunning: boolean
  onSupabaseSetup?: () => void
  onSupabaseDecline?: () => void
  onClarificationAnswer?: (answer: string) => void
  onApprovePlan?: () => void
}) {
  const isComplete = event.status === "complete"
  const isError = event.status === "error"
  const isRunning = isSessionRunning && event.status === "running"
  const isSkipped = event.status === "skipped"
  const title = getEventTitle(event)
  const description = isTokenLimitError(event.description)
    ? "You have used all credits for this cycle."
    : event.description

  if (event.metadata?.questionType === "supabase") {
    return <SupabaseQuestionCard onSetup={onSupabaseSetup ?? (() => {})} onDecline={onSupabaseDecline} />
  }

  if (event.metadata?.questionType === "clarification" && typeof event.metadata?.questions === "string") {
    let questions: QuestionConfig[] = []
    try { questions = JSON.parse(event.metadata.questions as string) } catch {}
    if (questions.length > 0) {
      return (
        <QuestionTool
          questions={questions}
          allowSkip
          submitLabel="Send"
          nextLabel="Next"
          skipLabel="Skip"
          className="my-3"
          onSubmitAnswer={(answer: QuestionAnswer, answersByQuestion?: Record<number, QuestionAnswer>) => {
            if (!onClarificationAnswer) return
            onClarificationAnswer(formatClarificationAnswerSet(questions, answersByQuestion, answer))
          }}
        />
      )
    }
  }

  if (event.title === "Researching web") {
    if (isRunning) {
      return <SearchTool state="searching" query={event.description || ""} className="my-3" />
    }
    return null
  }

  if (event.title === "Research complete") {
    const queryVal = typeof event.metadata?.searchQuery === "string" ? event.metadata.searchQuery : ""
    let results: SearchResult[] = []
    const rawJson = typeof event.metadata?.searchResultsJson === "string" ? event.metadata.searchResultsJson : ""
    if (rawJson) {
      try { results = JSON.parse(rawJson) } catch {}
    }
    return <SearchTool state="done" query={queryVal} results={results} defaultOpen={false} className="my-3" />
  }

  if (shouldHideCompletedFeedItem(event)) return null

  if (event.title === "Response" && event.description) {
    return (
      <div className="py-4 pr-2">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.75] text-foreground [overflow-wrap:anywhere]">
          {event.description}
        </p>
      </div>
    )
  }

  if (event.title === "Planning execution" && isComplete && event.description) {
    return <PlanTool event={event} onApprovePlan={onApprovePlan} />
  }

  const commandMetadata = getCommandMetadata(event)
  if (commandMetadata) {
    return (
      <BashTool
        state={isRunning ? "running" : "idle"}
        command={commandMetadata.command}
        output={commandMetadata.output || description}
        className="my-2"
      />
    )
  }

  if (event.title === "Generating code") {
    if (!isRunning) return null
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <TextShimmer className="text-xs font-medium">Generating code…</TextShimmer>
      </div>
    )
  }

  const generatedFilePath = getGeneratingFilePath(event)
  if (generatedFilePath && event.kind === "code") {
    const fileContent = getFileContentMetadata(event)
    return (
      <FeedFileItem
        filePath={generatedFilePath}
        variant={getEditToolVariant(event)}
        isRunning={isRunning}
        isPending={isRunning}
        oldContent={fileContent.oldContent}
        newContent={fileContent.newContent}
      />
    )
  }

  if (PROSE_EVENTS.includes(event.title) && event.description) {
    return (
      <Reasoning className="my-3" isStreaming={isSessionRunning}>
        <ReasoningTrigger />
        <ReasoningContent>{event.description}</ReasoningContent>
      </Reasoning>
    )
  }

  const showDetail = isRunning || isError
  const secondaryLine = getFeedItemSecondaryLine(title, description, showDetail)

  return (
    <div className={cn(isRunning ? "py-2.5" : "py-1")}>
      <div className="min-w-0 flex-1">
        {isRunning ? (
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/50" />
            </span>
            <TextShimmer className="text-[13px] font-medium">
              {title}
            </TextShimmer>
          </div>
        ) : (
          <p
            className={cn(
              "text-[13px] leading-snug",
              isError
                ? "font-medium text-destructive"
                : isSkipped
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground/70",
            )}
          >
            {title}
          </p>
        )}
        {secondaryLine && (
          <p
            className={cn(
              "mt-1 text-[12px] leading-relaxed [overflow-wrap:anywhere]",
              isError ? "text-destructive/80" : "text-muted-foreground/60",
            )}
          >
            {secondaryLine}
          </p>
        )}
      </div>
    </div>
  )
}

function UserMessageBubble({
  content, index, isEditing, editText,
  onEditStart, onEditChange, onEditSubmit, onEditCancel,
}: {
  content: string; index: number; isEditing: boolean; editText: string
  onEditStart: (i: number, c: string) => void
  onEditChange: (t: string) => void
  onEditSubmit: (i: number) => void
  onEditCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      const len = ref.current.value.length
      ref.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="flex justify-end pb-4">
        <div className="w-full max-w-[min(84%,42rem)]">
          <div className="overflow-hidden rounded-[14px] bg-primary shadow-[0_1px_2px_var(--primary)]">
            <textarea
              ref={ref} value={editText} onChange={(e) => onEditChange(e.target.value)}
              rows={Math.max(2, editText.split("\n").length)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit(index) }
                if (e.key === "Escape") onEditCancel()
              }}
              className="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground outline-none placeholder:text-primary-foreground/50"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button type="button" onClick={onEditCancel} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
            <button type="button" onClick={() => onEditSubmit(index)} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground transition-colors hover:bg-accent/90">Submit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex w-full justify-end pb-4">
      <div className="flex w-fit max-w-[min(84%,42rem)] min-w-0 flex-col items-end">
        <div className="max-w-full rounded-[14px] bg-primary px-3.5 py-2.5 text-right shadow-[0_1px_2px_var(--primary)]">
          <p className="whitespace-pre-wrap break-words text-left text-[13px] leading-relaxed text-primary-foreground [overflow-wrap:anywhere]">{content}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-1 pr-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={async () => {
            await navigator.clipboard?.writeText(content).catch(() => undefined)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }} aria-label="Copy message" className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => onEditStart(index, content)} aria-label="Edit message" className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AgentFeed({
  prompt, events, localMessages, status, optimisticStart,
  progress,
  editingIndex, editText, onEditStart, onEditChange, onEditSubmit, onEditCancel,
  onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, onApprovePlan, onSwitchToPreview,
}: {
  prompt?: string
  events: ComputerTimelineEvent[]
  localMessages: LocalMessage[]
  status: ComputerSessionStatus
  progress?: ComputerSessionProgress | null
  optimisticStart?: boolean
  editingIndex: number | null
  editText: string
  onEditStart: (i: number, c: string) => void
  onEditChange: (t: string) => void
  onEditSubmit: (i: number) => void
  onEditCancel: () => void
  onSupabaseSetup?: () => void
  onSupabaseDecline?: () => void
  onClarificationAnswer?: (answer: string) => void
  onApprovePlan?: () => void
  onSwitchToPreview?: () => void
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const isRunning = status === "running" || status === "planning"
  const visible = events.filter((e) => e.title !== "Session created")
  const { firstRunId, followUpRunIds } = getRunIdGroups(events)
  const initialEvents = firstRunId ? visible.filter((event) => event.runId === firstRunId) : visible
  const runEventsById = new Map<string, ComputerTimelineEvent[]>()
  for (const event of visible) {
    if (!event.runId || event.runId === firstRunId) continue
    const runEvents = runEventsById.get(event.runId) ?? []
    runEvents.push(event)
    runEventsById.set(event.runId, runEvents)
  }
  const localUserCount = localMessages.filter((msg) => msg.role === "user").length
  const unpairedRunIds = followUpRunIds.slice(localUserCount)
  const isStarting = optimisticStart && visible.length === 0
  const isEmpty = !prompt && visible.length === 0 && localMessages.length === 0 && !isStarting
  const hasActiveFeedStep = visible.some((event) => event.status === "running")
  const showGlobalThinking = Boolean(progress?.active) && !hasActiveFeedStep

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [visible.length, localMessages.length, isStarting])

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-center">
        <div>
          <p className="text-[13px] font-medium text-foreground">Ready to build</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">Send a message to start the agent.</p>
        </div>
      </div>
    )
  }

  const renderFeedItem = (event: ComputerTimelineEvent, isLatest: boolean, key: string) => (
    <motion.div key={key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <FeedItem
        event={event}
        isLatest={isLatest}
        isSessionRunning={isRunning}
        onSupabaseSetup={onSupabaseSetup}
        onSupabaseDecline={onSupabaseDecline}
        onClarificationAnswer={onClarificationAnswer}
        onApprovePlan={onApprovePlan}
      />
    </motion.div>
  )

  return (
    <div className="space-y-2.5 pb-4">
      {prompt && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="pb-5">
          <UserMessageBubble
            content={prompt} index={-1} isEditing={editingIndex === -1}
            editText={editingIndex === -1 ? editText : ""}
            onEditStart={onEditStart} onEditChange={onEditChange}
            onEditSubmit={onEditSubmit} onEditCancel={onEditCancel}
          />
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {isStarting && (
          <motion.div key="optimistic" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="py-2">
            <TextShimmer className="text-[13px] font-medium">Starting...</TextShimmer>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {initialEvents.map((event, i) =>
          renderFeedItem(event, i === initialEvents.length - 1 && isRunning, event.id ?? `${event.title}-${i}`)
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {localMessages.map((msg, i) =>
          msg.role === "user" ? (
            <Fragment key={`user-fragment-${i}`}>
              <motion.div key={`user-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="pt-5">
                <UserMessageBubble
                  content={msg.content} index={i} isEditing={editingIndex === i}
                  editText={editingIndex === i ? editText : ""}
                  onEditStart={onEditStart} onEditChange={onEditChange}
                  onEditSubmit={onEditSubmit} onEditCancel={onEditCancel}
                />
              </motion.div>
              {(runEventsById.get(msg.runId ?? followUpRunIds[localMessages.slice(0, i).filter((item) => item.role === "user").length]) ?? []).map((event, eventIndex, runEvents) =>
                renderFeedItem(event, eventIndex === runEvents.length - 1 && isRunning, event.id ?? `${msg.runId}-${event.title}-${eventIndex}`)
              )}
            </Fragment>
          ) : (
            <motion.div key={`sys-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="flex justify-center py-2">
              <span className="text-[11px] text-muted-foreground/60">{msg.content}</span>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {unpairedRunIds.map((runId) =>
        (runEventsById.get(runId) ?? []).map((event, eventIndex, runEvents) =>
          renderFeedItem(event, eventIndex === runEvents.length - 1 && isRunning, event.id ?? `${runId}-${event.title}-${eventIndex}`)
        )
      )}

      <AnimatePresence>
        {showGlobalThinking && (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="py-2.5">
            <TextShimmer className="text-[13px] font-medium">
              {progress?.label ?? "Working..."}
            </TextShimmer>
            {progress?.description && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/70">
                {progress.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {status === "complete" && visible.length > 0 && events.some((e) => e.title === "Preview ready") && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="pt-5 border-t border-border/40">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground/70">Preview is ready.</p>
            {onSwitchToPreview && (
              <button
                type="button"
                onClick={onSwitchToPreview}
                className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent transition-colors hover:text-accent/80 sm:hidden"
              >
                <Monitor className="h-3.5 w-3.5" />
                Open preview
              </button>
            )}
          </div>
        </motion.div>
      )}

      <div ref={endRef} />
    </div>
  )
}

export { getRunIdGroups }
