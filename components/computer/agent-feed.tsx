"use client"

import { feedIncompleteCopy, incompleteDescription, type FeedIncompleteRun } from '@/lib/backend/feed-incomplete'
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react"
import { MessageAttachments } from "@/components/computer/message-attachments"
import type { AttachmentRef } from "@/lib/backend/attachments"
import { AnimatePresence, motion } from "framer-motion"
import { duration, ease } from "@/lib/motion"
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
  Copy,
  Database,
  FileCode2,
  Pencil,
  RotateCcw,
} from "lucide-react"
import { Shimmer } from "@/components/ai-elements/shimmer"
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
import { Markdown } from "@/components/ui/markdown"
import { PlanCard, type PlanCardActions } from "@/components/computer/plan-card"
import type { SessionPlan } from "@/lib/backend/session-plan"
import { DeliveryCard } from "@/components/computer/delivery-card"
import type { Delivery } from "@/lib/backend/delivery"
import { STILL_STOPPING_AFTER_MS, stoppingLabels } from "@/lib/backend/feed-labels"

const commandStates = { pending: 'pending', running: 'running', complete: 'idle', error: 'error', skipped: 'interrupted' } as const

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

function SupabaseQuestionCard({ onSetup, onDecline }: { onSetup: () => void; onDecline?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const [setting, setSetting] = useState(false)

  if (dismissed) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/70">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <Database className="h-3 w-3" />
              {setting ? "Setting up…" : "Set up Supabase"}
            </button>
            <button
              type="button"
              onClick={() => { setDismissed(true); onDecline?.() }}
              disabled={setting}
              className="rounded-md px-1 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedFileItem({
  filePath,
  variant,
  status,
  oldContent,
  newContent,
}: {
  filePath?: string
  variant: "edit" | "write"
  status: ComputerTimelineEvent['status']
  oldContent?: string
  newContent?: string
}) {
  const [open, setOpen] = useState(false)
  const fileName = filePath?.split("/").pop() || filePath || ""
  const isWrite = variant === "write"
  const isRunning = status === 'running'
  const isPending = status === 'pending'

  const diffOps = useMemo<DiffOp[] | null>(() => {
    if (status !== 'complete') return null
    if (isWrite && newContent) return newContent.split("\n").map((text) => ({ type: "add" as const, text }))
    if (oldContent !== undefined && newContent !== undefined) return lineDiff(oldContent, newContent)
    return null
  }, [status, isWrite, oldContent, newContent])

  const stats = useMemo(() => (diffOps ? countDiffStats(diffOps) : null), [diffOps])
  const hasDiff = Boolean(diffOps && diffOps.length > 0)

  const label = `${{
    pending: isWrite ? 'Waiting to create' : 'Waiting to edit',
    running: isWrite ? 'Creating' : 'Editing',
    complete: isWrite ? 'Created' : 'Edited',
    error: isWrite ? "Couldn't create" : "Couldn't edit",
    skipped: 'Interrupted:',
  }[status]} ${fileName}`

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        disabled={!hasDiff}
        onClick={() => hasDiff && setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {isPending || isRunning ? (
          <Shimmer className="min-w-0 flex-1 text-xs font-semibold">
            {label}
          </Shimmer>
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
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        )}
      </button>
      {open && hasDiff && (
        <div className="max-h-64 overflow-auto border-t border-border/70 bg-muted/55 font-mono text-[11.5px] leading-[1.55] [scrollbar-width:thin]">
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

/**
 * Splits a streamed markdown string into completed blocks. A blank line is a
 * stable boundary only where the following line cannot continue an open
 * construct: blockquotes, lists and indented continuations span blank lines,
 * so splitting there would turn one loose list or one blockquote into two.
 * Reference definitions are document-scoped, so every block is parsed with
 * the definitions seen so far — they render nothing on their own.
 */
const FENCE = /^ {0,3}```/
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:\s*\S/
const CONTINUATION_LINE = /^(?: {0,3}(?:>|[-*+]|\d{1,9}[.)])(?:[ \t]|$)| {2,}\S)/

export function splitStableBlocks(text: string): { done: string[]; tail: string; refs: string[] } {
  const done: string[] = []
  const refs: string[] = []
  const lines = text.split('\n')
  const offsets: number[] = []
  let offset = 0
  for (const line of lines) { offsets.push(offset); offset += line.length + 1 }
  let fenced = false
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { fenced = !fenced; continue }
    if (fenced || lines[i].trim() !== '') continue
    const next = lines.slice(i + 1).find((line) => line.trim() !== '') ?? ''
    if (CONTINUATION_LINE.test(next)) continue
    if (offsets[i] - 1 > start) done.push(text.slice(start, offsets[i] - 1))
    start = offsets[i + 1] ?? text.length
  }
  let refFenced = false
  for (const line of lines) {
    if (FENCE.test(line)) { refFenced = !refFenced; continue }
    if (!refFenced && REFERENCE_DEFINITION.test(line)) refs.push(line)
  }
  return { done, tail: text.slice(start), refs }
}

const StreamedMarkdown = memo(function StreamedMarkdown({ text }: { text: string }) {
  const { done, tail, refs } = splitStableBlocks(text)
  const suffix = refs.length === 0 ? '' : '\n\n' + refs.join('\n')
  return <>
    {done.map((block, i) => <Markdown key={i}>{block + suffix}</Markdown>)}
    <Markdown>{tail + suffix}</Markdown>
  </>
})

const FeedItem = memo(function FeedItem({
  event,
  isSessionRunning,
  onSupabaseSetup,
  onSupabaseDecline,
  onClarificationAnswer,
}: {
  event: ComputerTimelineEvent
  isLatest: boolean
  isSessionRunning: boolean
  onSupabaseSetup?: () => void
  onSupabaseDecline?: () => void
  onClarificationAnswer?: (answer: string) => void
}) {
  const isComplete = event.status === "complete"
  const isError = event.status === "error"
  const isRunning = isSessionRunning && event.status === "running"
  const isSkipped = event.status === "skipped"
  const toolStatus = event.status === 'running' && !isSessionRunning ? 'skipped' : event.status
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
      <div className="py-3 pr-2">
        <StreamedMarkdown text={event.description} />
      </div>
    )
  }

  const commandMetadata = getCommandMetadata(event)
  if (commandMetadata) {
    return (
      <BashTool
        state={commandStates[toolStatus]}
        command={commandMetadata.command}
        output={commandMetadata.output ?? description}
        className="my-2"
      />
    )
  }

  if (event.title === "Generating code") {
    if (!isRunning) return null
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Shimmer className="text-xs font-medium">Generating code…</Shimmer>
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
        status={toolStatus}
        oldContent={fileContent.oldContent}
        newContent={fileContent.newContent}
      />
    )
  }

  // The model's own reasoning for one step, streamed by the server. Collapsed
  // by default and never unfolded on its own: a calm line the user can open.
  if (event.kind === "thinking" && event.description) {
    return (
      <Reasoning className="my-2" isStreaming={isRunning} defaultOpen={false} autoOpen={false}>
        <ReasoningTrigger title={isRunning ? "Thinking" : "Thought process"} />
        <ReasoningContent>{event.description}</ReasoningContent>
      </Reasoning>
    )
  }

  const showDetail = isRunning || isError
  const secondaryLine = getFeedItemSecondaryLine(title, description, showDetail)

  const isStep = event.kind === "code"
  return (
    <div className={cn(isRunning ? "py-2" : isStep ? "py-[3px]" : "py-1")}>
      <div className="min-w-0 flex-1">
        {isRunning ? (
          <Shimmer className={cn("font-medium", isStep ? "text-[13px]" : "text-[13.5px] font-semibold")}>
            {title}
          </Shimmer>
        ) : (
          <p
            className={cn(
              "leading-snug",
              isStep ? "text-[13px] font-medium" : "text-[13.5px] font-semibold",
              isError
                ? "text-destructive"
                : isSkipped || isStep
                  ? "text-muted-foreground"
                  : "text-foreground/80",
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
})

type CheckpointRestoreState = "idle" | "confirming" | "restoring"

const UserMessageBubble = memo(function UserMessageBubble({
  canEdit = true,
  content, attachments, index, isEditing, editText,
  runId, isLastCheckpoint, onRestoreCheckpoint,
  onEditStart, onEditChange, onEditSubmit, onEditCancel,
}: {
  content: string
  attachments?: readonly AttachmentRef[]
  canEdit?: boolean
  index: number
  isEditing: boolean
  editText: string
  runId?: string
  isLastCheckpoint?: boolean
  onRestoreCheckpoint?: (runId: string) => Promise<void>
  onEditStart?: (i: number, c: string) => void
  onEditChange?: (t: string) => void
  onEditSubmit?: (i: number) => void
  onEditCancel?: () => void
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
          <div className="overflow-hidden rounded-2xl border border-border bg-muted/60 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
            <textarea
              ref={ref} value={editText} onChange={(e) => onEditChange?.(e.target.value)}
              aria-label="Edit message"
              rows={Math.max(2, editText.split("\n").length)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSubmit?.(index) }
                if (e.key === "Escape") onEditCancel?.()
              }}
              className="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-foreground/50"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button type="button" onClick={onEditCancel} className="min-h-6 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">Cancel</button>
            <button type="button" onClick={() => onEditSubmit?.(index)} className="min-h-6 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">Submit</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="group flex w-full justify-end pb-4">
      <div className="flex w-fit max-w-[min(84%,42rem)] min-w-0 flex-col items-end">
        <MessageAttachments attachments={attachments} className="mb-2" />
        <div className="max-w-full rounded-2xl bg-muted px-3.5 py-2.5 text-right">
          <p className="whitespace-pre-wrap break-words text-left text-[14px] leading-relaxed text-foreground [overflow-wrap:anywhere]">{content}</p>
        </div>

        {/* Action row — copy, edit, restore */}
        <div className="mt-1.5 flex items-center gap-1 pr-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={async () => {
            await navigator.clipboard?.writeText(content).catch(() => undefined)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }} aria-label="Copy message" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {canEdit && onEditStart && <button type="button" onClick={() => onEditStart?.(index, content)} aria-label="Edit message" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <Pencil className="h-3.5 w-3.5" />
          </button>}
          {showRestoreButton && restoreState !== "restoring" && (
            <button
              type="button"
              onClick={() => { setRestoreError(null); setRestoreState("confirming") }}
              aria-label="Restore project to this checkpoint"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {showRestoreButton && restoreState === "restoring" && (
            <Shimmer className="text-[11px] font-medium">Restoring…</Shimmer>
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
          <div className="bg-muted/40 mb-1 flex h-10 w-10 items-center justify-center rounded-full">
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
            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={restoreState === "restoring"}
            onClick={handleConfirmRestore}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {restoreState === "restoring" ? "Restoring…" : "Restore"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
})

export function AgentFeed({
  prompt, events, localMessages, status, optimisticStart,
  progress,
  editingIndex, editText, onEditStart, onEditChange, onEditSubmit, onEditCancel,
  onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, plan, planActions, delivery,
  onRestoreCheckpoint,
  canonicalMessages, queuedMessages, streamText, liveLabel, stopping = false, stoppingSince = null, incompleteRuns = [], endUnrecorded = false,
}: {
  /** Runs shown here whose events the server could not all record (one notice each, never a claim of completeness). */
  incompleteRuns?: readonly FeedIncompleteRun[]
  /** The session finished but its run's end never reached the record. */
  endUnrecorded?: boolean
  canonicalMessages?: { seq: number; role: 'user' | 'assistant'; voiceSpeaker?: 'user' | 'assistant'; content: string; createdAt: string; attachments?: AttachmentRef[] }[]
  queuedMessages?: { id: string; prompt: string; attachments?: AttachmentRef[] }[]
  streamText?: string
  liveLabel?: string | null
  /** The server accepted a Stop and is still ending the run; it reports the end itself. */
  stopping?: boolean
  /** When the server recorded the Stop, so a slow one can be explained rather than left silent. */
  stoppingSince?: string | null
  prompt?: string
  events: ComputerTimelineEvent[]
  localMessages: LocalMessage[]
  status: ComputerSessionStatus
  progress?: ComputerSessionProgress | null
  optimisticStart?: boolean
  editingIndex: number | null
  editText: string
  onEditStart?: (i: number, c: string) => void
  onEditChange?: (t: string) => void
  onEditSubmit?: (i: number) => void
  onEditCancel?: () => void
  onSupabaseSetup?: () => void
  onSupabaseDecline?: () => void
  onClarificationAnswer?: (answer: string) => void
  /** The session's structured plan, rendered once after the activity; absent until the agent proposes one. */
  plan?: SessionPlan | null
  planActions?: PlanCardActions
  /** The current pull-request delivery, kept visible while checks and deployment continue in the background. */
  delivery?: Delivery | null
  onRestoreCheckpoint?: (runId: string) => Promise<void>
}) {
  const [stoppingLong, setStoppingLong] = useState(false)
  useEffect(() => {
    if (!stopping) { setStoppingLong(false); return }
    const since = stoppingSince ? Date.parse(stoppingSince) : Date.now()
    const timer = setTimeout(() => setStoppingLong(true), Math.max(0, (Number.isFinite(since) ? since : Date.now()) + STILL_STOPPING_AFTER_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [stopping, stoppingSince])
  // Streamed text re-renders this component every frame while callers rebuild
  // these callbacks each render. Stable trampolines keep the memoized rows
  // cheap; each wrapper still invokes the latest callback.
  const latest = useRef({
    onEditStart, onEditChange, onEditSubmit, onEditCancel,
    onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, onRestoreCheckpoint,
  })
  latest.current = {
    onEditStart, onEditChange, onEditSubmit, onEditCancel,
    onSupabaseSetup, onSupabaseDecline, onClarificationAnswer, onRestoreCheckpoint,
  }
  const stable = useRef<typeof latest.current | undefined>(undefined)
  if (stable.current === undefined) {
    stable.current = {
      onEditStart: (i, c) => latest.current.onEditStart?.(i, c),
      onEditChange: (t) => latest.current.onEditChange?.(t),
      onEditSubmit: (i) => latest.current.onEditSubmit?.(i),
      onEditCancel: () => latest.current.onEditCancel?.(),
      onSupabaseSetup: () => latest.current.onSupabaseSetup?.(),
      onSupabaseDecline: () => latest.current.onSupabaseDecline?.(),
      onClarificationAnswer: (a) => latest.current.onClarificationAnswer?.(a),
      onRestoreCheckpoint: (r) => latest.current.onRestoreCheckpoint ? latest.current.onRestoreCheckpoint(r) : Promise.resolve(),
    }
  }
  const cb = stable.current
  const responseFallbacks = useRef(new WeakMap<object, ComputerTimelineEvent>())
  const editStart = onEditStart ? cb.onEditStart : undefined
  const editChange = onEditChange ? cb.onEditChange : undefined
  const editSubmit = onEditSubmit ? cb.onEditSubmit : undefined
  const editCancel = onEditCancel ? cb.onEditCancel : undefined
  const supabaseSetup = onSupabaseSetup ? cb.onSupabaseSetup : undefined
  const supabaseDecline = onSupabaseDecline ? cb.onSupabaseDecline : undefined
  const clarifyAnswer = onClarificationAnswer ? cb.onClarificationAnswer : undefined
  const restoreCheckpoint = onRestoreCheckpoint ? cb.onRestoreCheckpoint : undefined

  const isRunning = status === "running" || status === "planning" || status === "queued"
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

  if (canonicalMessages) {
    // Message objects are stable across stream frames; keep the synthesized
    // fallback events stable too so the memoized FeedItem can skip them.
    const rows = [
      ...canonicalMessages.map((message) => ({ time: Date.parse(message.createdAt), key: `message-${message.seq}`, message, event: undefined as ComputerTimelineEvent | undefined })),
      ...events.map((event) => ({ time: Date.parse(event.createdAt), key: `event-${event.id}`, message: undefined, event })),
    ].sort((left, right) => left.time - right.time)
    const fallbackFor = (message: NonNullable<(typeof rows)[number]['message']>): ComputerTimelineEvent => {
      let fallback = responseFallbacks.current.get(message)
      if (fallback === undefined) {
        fallback = { title: 'Response', description: message.content, status: 'complete', createdAt: message.createdAt, index: message.seq }
        responseFallbacks.current.set(message, fallback)
      }
      return fallback
    }
    return <div className="space-y-2.5 pb-4">
      {rows.map(({ key, message, event }) => { const role = message ? (message.voiceSpeaker ?? message.role) : undefined
        return <div key={key} className={role === 'user' ? 'pt-6 pb-3' : ''}>
        {role === 'user' ? <UserMessageBubble canEdit={false} content={message!.content} attachments={message!.attachments} index={message!.seq} isEditing={false} editText=""
          onEditStart={editStart} onEditChange={editChange} onEditSubmit={editSubmit} onEditCancel={editCancel} />
          : <FeedItem event={event ?? fallbackFor(message!)}
            isLatest={false} isSessionRunning={isRunning} onSupabaseSetup={supabaseSetup} onSupabaseDecline={supabaseDecline} onClarificationAnswer={clarifyAnswer} />}
      </div> })}
      {queuedMessages?.map((message) => <div key={message.id} className="pt-5">
        <UserMessageBubble canEdit={false} content={message.prompt} attachments={message.attachments} index={-1} isEditing={false} editText=""
          onEditStart={editStart} onEditChange={editChange} onEditSubmit={editSubmit} onEditCancel={editCancel} />
        <p className="mt-1 text-xs text-muted-foreground">Queued</p>
      </div>)}
      {streamText && <FeedItem event={{ title: 'Response', description: streamText, status: 'running', createdAt: '', index: 0 }} isLatest isSessionRunning={isRunning} />}
      {isRunning && stopping && <p role="status" className="py-2 text-[13px] font-medium text-muted-foreground">{stoppingLong ? stoppingLabels.stillStopping : stoppingLabels.stopping}</p>}
      {isRunning && !stopping && !hasActiveFeedStep && !streamText && <div role="status" className="py-2">
        <Shimmer className="text-[13px] font-medium">{liveLabel ?? (status === "queued" ? "Starting your request…" : "Working…")}</Shimmer>
      </div>}
      {incompleteRuns.map((run) => (
        <div key={run.execution} role="status" className="my-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-left" data-testid="feed-incomplete">
          <p className="text-[13px] font-medium text-foreground">{feedIncompleteCopy.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{incompleteDescription(run)}</p>
        </div>
      ))}
      {endUnrecorded && (
        <div role="status" className="my-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-left" data-testid="feed-end-unrecorded">
          <p className="text-[13px] font-medium text-foreground">{feedIncompleteCopy.unrecordedEnd}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{feedIncompleteCopy.unrecordedEndDescription}</p>
        </div>
      )}
      {plan && <PlanCard plan={plan} actions={planActions} />}
      {delivery && <DeliveryCard delivery={delivery} />}
    </div>
  }

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
    <motion.div
      key={key}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: duration.fast } }}
      transition={{ duration: duration.base, ease }}
    >
      <FeedItem
        event={event}
        isLatest={isLatest}
        isSessionRunning={isRunning}
        onSupabaseSetup={supabaseSetup}
        onSupabaseDecline={supabaseDecline}
        onClarificationAnswer={clarifyAnswer}
      />
    </motion.div>
  )

  return (
    <div className="space-y-2.5 pb-4">
      {prompt && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease }} className="pb-5">
          <UserMessageBubble
            content={prompt} index={-1} isEditing={editingIndex === -1}
            editText={editingIndex === -1 ? editText : ""}
            runId={firstRunId ?? undefined}
            isLastCheckpoint={isInitialPromptLastCheckpoint}
            onRestoreCheckpoint={restoreCheckpoint}
            onEditStart={editStart} onEditChange={editChange}
            onEditSubmit={editSubmit} onEditCancel={editCancel}
          />
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {isStarting && (
          <motion.div key="optimistic" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: duration.fast } }} transition={{ duration: duration.base, ease }} className="py-2">
            <Shimmer className="text-[13px] font-medium">Starting...</Shimmer>
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
              <motion.div key={`user-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease }} className="pt-5">
                <UserMessageBubble
                  content={msg.content} index={i} isEditing={editingIndex === i}
                  editText={editingIndex === i ? editText : ""}
                  runId={getFollowUpRunId(i)}
                  isLastCheckpoint={i === localUserCount - 1}
                  onRestoreCheckpoint={restoreCheckpoint}
                  onEditStart={editStart} onEditChange={editChange}
                  onEditSubmit={editSubmit} onEditCancel={editCancel}
                />
              </motion.div>
              {(runEventsById.get(msg.runId ?? followUpRunIds[localMessages.slice(0, i).filter((item) => item.role === "user").length]) ?? []).map((event, eventIndex, runEvents) =>
                renderFeedItem(event, eventIndex === runEvents.length - 1 && isRunning, event.id ?? `${msg.runId}-${event.title}-${eventIndex}`)
              )}
            </Fragment>
          ) : (
            <motion.div key={`sys-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease }} className="flex justify-center py-2">
              <span className="text-[11px] text-muted-foreground">{msg.content}</span>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {unpairedRunIds.map((runId) =>
        (runEventsById.get(runId) ?? []).map((event, eventIndex, runEvents) =>
          renderFeedItem(event, eventIndex === runEvents.length - 1 && isRunning, event.id ?? `${runId}-${event.title}-${eventIndex}`)
        )
      )}

      {plan && <PlanCard plan={plan} actions={planActions} />}
      {delivery && <DeliveryCard delivery={delivery} />}

      <AnimatePresence>
        {showGlobalThinking && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: duration.fast } }} transition={{ duration: duration.base, ease }} className="py-2.5">
            <Shimmer className="text-[13px] font-medium">
              {progress?.label ?? "Working..."}
            </Shimmer>
            {progress?.description && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {progress.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  )
}

export { getRunIdGroups }
