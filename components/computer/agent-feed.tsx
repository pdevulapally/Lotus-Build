"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Check,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Database,
  FileCode2,
  Loader2,
  Pencil,
  RotateCcw,
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
    <div className="space-y-0.5 text-[13px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (/^[-*_]{3,}$/.test(t)) return null
        if (t.match(/^#\s+/)) return null
        const h2 = t.match(/^##\s+(.+)/)
        if (h2) return <p key={i} className="pt-2 pb-0.5 text-[13px] font-semibold text-foreground">{renderInline(h2[1])}</p>
        const h3 = t.match(/^###\s+(.+)/)
        if (h3) return <p key={i} className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{h3[1]}</p>
        const li = t.match(/^[-*]\s+(.+)/)
        if (li) return (
          <div key={i} className="flex items-start gap-2 font-semibold text-muted-foreground">
            <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-border" />
            <span>{renderInline(li[1])}</span>
          </div>
        )
        return <p key={i} className="font-semibold text-muted-foreground">{renderInline(t)}</p>
      })}
    </div>
  )
}

function SupabaseQuestionCard({ onSetup, onDecline }: { onSetup: () => void; onDecline?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const [setting, setSetting] = useState(false)

  if (dismissed) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-border/55 bg-card/78 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-muted/70">
          <Database className="h-4 w-4 text-foreground/70" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">This app needs a database</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Connect Supabase to add auth and persistent storage.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={async () => {
                setSetting(true)
                try { await onSetup() } finally { setSetting(false) }
              }}
              disabled={setting}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background shadow-sm transition-all hover:bg-foreground/85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              {setting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              {setting ? "Setting up..." : "Set up Supabase"}
            </button>
            <button
              type="button"
              onClick={() => { setDismissed(true); onDecline?.() }}
              disabled={setting}
              className="rounded-md px-1 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:opacity-60"
            >
              Not now
            </button>
          </div>
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
    <div className="overflow-hidden rounded-2xl border border-border/55 bg-card/78 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-border/35 px-3.5 py-2.5">
        <span className="text-xs font-semibold text-muted-foreground">Plan drafted</span>
        {summary && (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-md px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
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
            "overflow-hidden px-3.5 pb-3.5 pt-3",
            !isExpanded && "max-h-[94px]",
          )}
        >
          <PlanDescription text={summary} />
        </div>
      )}
      {onApprovePlan && (
        <div className="flex items-center gap-3 border-t border-border/35 px-3.5 py-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
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
    <div className="overflow-hidden rounded-2xl border border-border/55 bg-card/78 shadow-sm backdrop-blur-xl">
      <button
        type="button"
        disabled={!hasDiff}
        onClick={() => hasDiff && setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/35"
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        {isPending || isRunning ? (
          <TextShimmer className="min-w-0 flex-1 text-xs font-semibold">
            {label}
          </TextShimmer>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted-foreground">{label}</span>
        )}
        {stats && !isPending && !isRunning && (stats.added > 0 || stats.removed > 0) && (
          <span className="flex shrink-0 gap-1.5 font-mono text-[11px]">
            {stats.added > 0 && <span className="text-success-soft-foreground">+{stats.added}</span>}
            {stats.removed > 0 && <span className="text-destructive/80">-{stats.removed}</span>}
          </span>
        )}
        {hasDiff && (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        )}
      </button>
      {open && hasDiff && (
        <div className="max-h-64 overflow-auto border-t border-border/35 bg-muted/55 font-mono text-[11.5px] leading-[1.55] [scrollbar-width:thin]">
          {diffOps!.map((op, i) => (
            <div
              key={i}
              className={cn(
                "flex min-w-max items-start px-3 py-px",
                op.type === "add" && "bg-success-soft/55 text-success-soft-foreground",
                op.type === "remove" && "bg-destructive/10 text-destructive",
                op.type === "context" && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "w-4 shrink-0 select-none",
                  op.type === "add" && "text-success-soft-foreground",
                  op.type === "remove" && "text-destructive",
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
            <TextShimmer className="text-[13.5px] font-semibold">
              {title}
            </TextShimmer>
          </div>
        ) : (
          <p
            className={cn(
              "text-[13.5px] leading-snug",
              isError
                ? "font-semibold text-destructive"
                : isSkipped
                  ? "font-semibold text-muted-foreground/60"
                  : "font-semibold text-foreground/80",
            )}
          >
            {title}
          </p>
        )}
        {secondaryLine && (
          <p
            className={cn(
              "mt-1 text-[12.5px] leading-relaxed [overflow-wrap:anywhere]",
              isError ? "text-destructive/80" : "text-muted-foreground",
            )}
          >
            {secondaryLine}
          </p>
        )}
      </div>
    </div>
  )
}

type CheckpointRestoreState = "idle" | "confirming" | "restoring"

function UserMessageBubble({
  content, index, isEditing, editText,
  runId, isLastCheckpoint, onRestoreCheckpoint,
  onEditStart, onEditChange, onEditSubmit, onEditCancel,
}: {
  content: string
  index: number
  isEditing: boolean
  editText: string
  runId?: string
  isLastCheckpoint?: boolean
  onRestoreCheckpoint?: (runId: string) => Promise<void>
  onEditStart: (i: number, c: string) => void
  onEditChange: (t: string) => void
  onEditSubmit: (i: number) => void
  onEditCancel: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [restoreState, setRestoreState] = useState<CheckpointRestoreState>("idle")
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const showRestoreButton = Boolean(runId && onRestoreCheckpoint && !isLastCheckpoint)

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      const len = ref.current.value.length
      ref.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  const handleConfirmRestore = async () => {
    if (!runId || !onRestoreCheckpoint) return
    setRestoreError(null)
    setRestoreState("restoring")
    try {
      await onRestoreCheckpoint(runId)
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed")
      setRestoreState("confirming")
    }
  }

  if (isEditing) {
    return (
      <div className="flex justify-end pb-4">
        <div className="w-full max-w-[min(84%,42rem)]">
          <div className="overflow-hidden rounded-2xl bg-foreground shadow-sm">
            <textarea
              ref={ref} value={editText} onChange={(e) => onEditChange(e.target.value)}
              rows={Math.max(2, editText.split("\n").length)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit(index) }
                if (e.key === "Escape") onEditCancel()
              }}
              className="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed text-background outline-none placeholder:text-background/50"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button type="button" onClick={onEditCancel} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">Cancel</button>
            <button type="button" onClick={() => onEditSubmit(index)} className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background shadow-sm transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">Submit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="group flex w-full justify-end pb-4">
      <div className="flex w-fit max-w-[min(84%,42rem)] min-w-0 flex-col items-end">
        <div className="max-w-full rounded-2xl bg-foreground px-3.5 py-2.5 text-right shadow-sm ring-1 ring-foreground/10">
          <p className="whitespace-pre-wrap break-words text-left text-[14px] font-medium leading-relaxed text-background [overflow-wrap:anywhere]">{content}</p>
        </div>

        {/* Action row — copy, edit, restore */}
        <div className="mt-1.5 flex items-center gap-1 pr-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={async () => {
            await navigator.clipboard?.writeText(content).catch(() => undefined)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }} aria-label="Copy message" className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => onEditStart(index, content)} aria-label="Edit message" className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {showRestoreButton && restoreState !== "restoring" && (
            <button
              type="button"
              onClick={() => { setRestoreError(null); setRestoreState("confirming") }}
              aria-label="Restore project to this checkpoint"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {showRestoreButton && restoreState === "restoring" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

      </div>
    </div>

    {/* Restore confirmation — rendered as a portal modal, not inside the feed */}
    <Dialog
      open={restoreState === "confirming" || restoreState === "restoring"}
      onOpenChange={(open) => {
        if (!open && restoreState !== "restoring") {
          setRestoreState("idle")
          setRestoreError(null)
        }
      }}
    >
      <DialogContent showCloseButton={restoreState !== "restoring"} className="max-w-sm">
        <DialogHeader>
          <div className="lotus-glass-inset mb-1 flex h-10 w-10 items-center justify-center rounded-full">
            <RotateCcw className="h-4 w-4 text-foreground" />
          </div>
          <DialogTitle>Restore to this point?</DialogTitle>
          <DialogDescription>
            Changes made after this message will be undone. You can always rebuild from here.
          </DialogDescription>
        </DialogHeader>
        {restoreError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{restoreError}</p>
        )}
        <DialogFooter>
          <button
            type="button"
            disabled={restoreState === "restoring"}
            onClick={() => { setRestoreState("idle"); setRestoreError(null) }}
            className="lotus-glass-control inline-flex h-9 items-center justify-center rounded-full border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={restoreState === "restoring"}
            onClick={handleConfirmRestore}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-semibold text-background transition-colors hover:bg-foreground/85 disabled:opacity-70"
          >
            {restoreState === "restoring" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {restoreState === "restoring" ? "Restoring…" : "Restore"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export function AgentFeed({
  prompt, events, localMessages, status, optimisticStart,
  progress,
  editingIndex, editText, onEditStart, onEditChange, onEditSubmit, onEditCancel,
  onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, onApprovePlan,
  onRestoreCheckpoint,
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
  onRestoreCheckpoint?: (runId: string) => Promise<void>
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
  const localUserMessages = localMessages.filter((msg) => msg.role === "user")
  const localUserCount = localUserMessages.length
  const unpairedRunIds = followUpRunIds.slice(localUserCount)
  // A checkpoint is "last" when there's nothing to undo after it.
  // Initial prompt is last if no follow-up runs exist; follow-up[i] is last if it's the final one.
  const totalCheckpoints = (firstRunId ? 1 : 0) + localUserCount
  const isInitialPromptLastCheckpoint = totalCheckpoints <= 1
  const getFollowUpRunId = (msgIndex: number) =>
    localUserMessages[msgIndex]?.runId ?? followUpRunIds[msgIndex] ?? undefined
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
            runId={firstRunId ?? undefined}
            isLastCheckpoint={isInitialPromptLastCheckpoint}
            onRestoreCheckpoint={onRestoreCheckpoint}
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
                  runId={getFollowUpRunId(i)}
                  isLastCheckpoint={i === localUserCount - 1}
                  onRestoreCheckpoint={onRestoreCheckpoint}
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


      <div ref={endRef} />
    </div>
  )
}

export { getRunIdGroups }
