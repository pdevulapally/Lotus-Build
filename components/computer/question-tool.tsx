"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { MessageCircle, ChevronUp, ChevronDown } from "lucide-react"

const QUESTION_CUSTOM_ID = "__custom__"

function optionBadge(idx: number) {
  return String.fromCharCode(65 + idx)
}

export type QuestionOption = {
  id: string
  label: string
  description?: string
}

export type QuestionConfig = {
  kind: "single" | "multi" | "text"
  title: string
  description?: string
  options?: QuestionOption[]
  allowCustom?: boolean
  customLabel?: string
  customPlaceholder?: string
  minSelections?: number
  maxSelections?: number
  placeholder?: string
}

export type QuestionAnswer = {
  kind: "single" | "multi" | "text" | "skip"
  selectedIds?: string[]
  text?: string
}

type QuestionPromptProps = {
  questions: QuestionConfig[]
  questionIndex?: number
  totalQuestions?: number
  onPreviousQuestion?: () => void
  onNextQuestion?: () => void
  initialAnswer?: QuestionAnswer
  submitLabel?: string
  nextLabel?: string
  skipLabel?: string
  allowSkip?: boolean
  onSubmit: (answer: QuestionAnswer) => void
  onSkip?: () => void
  className?: string
}

function QuestionPrompt({
  questions,
  questionIndex = 1,
  totalQuestions,
  submitLabel = "Send",
  nextLabel = "Next",
  skipLabel = "Skip",
  allowSkip = true,
  initialAnswer,
  onSubmit,
  onSkip,
  className,
}: QuestionPromptProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customText, setCustomText] = useState("")
  const [textValue, setTextValue] = useState("")
  const resolvedTotal = totalQuestions ?? questions.length
  const clampedIndex = Math.max(1, Math.min(questionIndex, resolvedTotal))
  const activeQuestion = questions[clampedIndex - 1]
  const customEnabled = activeQuestion?.allowCustom ?? false
  const isLastQuestion = clampedIndex >= resolvedTotal
  const primaryLabel = isLastQuestion ? submitLabel : nextLabel

  useEffect(() => {
    if (!initialAnswer || initialAnswer.kind === "skip") {
      setSelectedIds([])
      setCustomText("")
      setTextValue("")
      return
    }
    if (activeQuestion?.kind === "text") {
      setSelectedIds([])
      setCustomText("")
      setTextValue(initialAnswer.text ?? "")
      return
    }
    const nextSelected = new Set(initialAnswer.selectedIds ?? [])
    const nextCustomText = initialAnswer.text ?? ""
    if (customEnabled && nextCustomText.trim().length > 0) {
      nextSelected.add(QUESTION_CUSTOM_ID)
    }
    setSelectedIds(Array.from(nextSelected))
    setCustomText(nextCustomText)
    setTextValue("")
  }, [
    activeQuestion?.kind,
    clampedIndex,
    customEnabled,
    initialAnswer?.kind,
    initialAnswer?.text,
    initialAnswer?.selectedIds?.join("|"),
  ])

  const canSubmit = useMemo(() => {
    if (activeQuestion?.kind === "text") return textValue.trim().length > 0
    const selectedNonCustom = selectedIds.filter((id) => id !== QUESTION_CUSTOM_ID).length
    const hasCustomText = customText.trim().length > 0
    const total = selectedNonCustom + (hasCustomText ? 1 : 0)
    if (activeQuestion?.kind === "single") return total === 1
    const min = activeQuestion?.minSelections ?? 1
    const max = activeQuestion?.maxSelections
    if (total < min) return false
    if (typeof max === "number" && total > max) return false
    return total > 0
  }, [activeQuestion?.kind, activeQuestion?.minSelections, activeQuestion?.maxSelections, selectedIds, customText, textValue])

  const toggleMulti = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleCustomTextChange = (nextValue: string) => {
    setCustomText(nextValue)
    if (!activeQuestion) return
    if (activeQuestion.kind === "single") {
      setSelectedIds(nextValue.trim().length > 0 ? [QUESTION_CUSTOM_ID] : [])
      return
    }
    setSelectedIds((prev) => {
      const hasCustom = prev.includes(QUESTION_CUSTOM_ID)
      if (nextValue.trim().length > 0 && !hasCustom) return [...prev, QUESTION_CUSTOM_ID]
      if (nextValue.trim().length === 0 && hasCustom) return prev.filter((id) => id !== QUESTION_CUSTOM_ID)
      return prev
    })
  }

  const handleSubmit = () => {
    if (!canSubmit || !activeQuestion) return
    if (activeQuestion.kind === "text") {
      onSubmit({ kind: "text", text: textValue.trim() })
      return
    }
    const selectedNonCustom = selectedIds.filter((id) => id !== QUESTION_CUSTOM_ID)
    onSubmit({
      kind: activeQuestion.kind,
      selectedIds: selectedNonCustom,
      text: customText.trim() || undefined,
    })
  }

  const handleSkip = () => {
    onSkip?.()
    onSubmit({ kind: "skip" })
  }

  if (!activeQuestion) return null

  const optionRowBase = "w-full text-left rounded-xl px-2.5 py-2 flex items-center gap-2 -mx-1 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
  const badgeBase = "h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-semibold border shrink-0"
  const badgeOff = "bg-muted/45 text-muted-foreground border-border/55"
  const badgeOn = "bg-foreground/12 text-foreground border-foreground/30"

  return (
    <div className={cn("lotus-glass-panel space-y-2 px-3 py-2.5", className)}>
      <p className="text-sm font-medium text-foreground leading-snug">{activeQuestion.title}</p>
      {activeQuestion.description && (
        <p className="text-xs text-muted-foreground">{activeQuestion.description}</p>
      )}

      {activeQuestion.kind !== "text" && (activeQuestion.options?.length ?? 0) > 0 && (
        <div className="space-y-1 pt-0.5">
          {activeQuestion.options!.map((option, idx) => {
            const checked = selectedIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (activeQuestion.kind === "single") {
                    setSelectedIds([option.id])
                    if (customEnabled) setCustomText("")
                  } else {
                    toggleMulti(option.id)
                  }
                }}
                className={optionRowBase}
              >
                <span className={cn(badgeBase, checked ? badgeOn : badgeOff)}>{optionBadge(idx)}</span>
                <span className="text-sm text-foreground">
                  {option.label}
                  {option.description && (
                    <span className="text-muted-foreground"> {option.description}</span>
                  )}
                </span>
              </button>
            )
          })}

          {customEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <span className={cn(badgeBase, selectedIds.includes(QUESTION_CUSTOM_ID) ? badgeOn : badgeOff)}>
                {optionBadge(activeQuestion.options!.length)}
              </span>
              <input
                value={customText}
                onChange={(e) => handleCustomTextChange(e.target.value)}
                placeholder={activeQuestion.customPlaceholder ?? "Type your answer"}
                className="lotus-glass-control h-8 w-full rounded-full border px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-ring"
              />
            </div>
          )}
        </div>
      )}

      {activeQuestion.kind === "text" && (
        <textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder={activeQuestion.placeholder ?? "Type your answer"}
          rows={3}
          className="lotus-glass-control w-full resize-none rounded-2xl border px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-ring"
        />
      )}

      <div className="flex items-center justify-end gap-1.5 pt-0.5">
        {allowSkip && (
          <button
            type="button"
            onClick={handleSkip}
            className="h-6 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {skipLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-6 rounded-full border border-border-strong bg-muted px-2.5 text-xs font-semibold text-foreground transition-all hover:bg-muted/70 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-muted disabled:active:scale-100"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}

function formatAnswer(answer: QuestionAnswer) {
  if (answer.kind === "skip") return "Skipped"
  if (answer.kind === "text") return answer.text || "Answered"
  const ids = answer.selectedIds?.length ? answer.selectedIds.join(", ") : ""
  if (answer.text) return ids ? `${ids} (${answer.text})` : answer.text
  return ids || "Answered"
}

export type QuestionToolProps = {
  questions: QuestionConfig[]
  questionIndex?: number
  totalQuestions?: number
  onPreviousQuestion?: () => void
  onNextQuestion?: () => void
  submitLabel?: string
  nextLabel?: string
  skipLabel?: string
  allowSkip?: boolean
  onSubmitAnswer?: (answer: QuestionAnswer, answersByQuestion?: Record<number, QuestionAnswer>) => void
  output?: { answer?: QuestionAnswer }
  toolCallId?: string
  className?: string
}

export function QuestionTool({
  questions,
  questionIndex,
  totalQuestions: totalQuestionsProp,
  onPreviousQuestion,
  onNextQuestion,
  submitLabel,
  nextLabel,
  skipLabel,
  allowSkip,
  onSubmitAnswer,
  output,
  toolCallId,
  className,
}: QuestionToolProps) {
  const totalQuestions = totalQuestionsProp ?? questions.length
  const [localIndex, setLocalIndex] = useState(questionIndex ?? 1)
  const isControlled = typeof questionIndex === "number"
  const effectiveIndex = isControlled ? (questionIndex ?? 1) : questions.length > 0 ? localIndex : 1
  const clampedIndex = Math.max(1, Math.min(effectiveIndex, totalQuestions))
  const question = questions[clampedIndex - 1]
  const [localAnswers, setLocalAnswers] = useState<Record<number, QuestionAnswer>>({})

  useEffect(() => {
    if (typeof questionIndex === "number") setLocalIndex(questionIndex)
  }, [questionIndex])

  useEffect(() => {
    setLocalAnswers({})
    setLocalIndex(questionIndex ?? 1)
  }, [toolCallId])

  const outputAnswer = output?.answer
  const answeredCount = Object.keys(localAnswers).length
  const isComplete =
    totalQuestions === 1
      ? !!outputAnswer || answeredCount >= 1
      : totalQuestions > 0 && answeredCount >= totalQuestions

  const showNavigation = totalQuestions > 1 && !isComplete
  const canGoPrev = clampedIndex > 1
  const canGoNext = clampedIndex < totalQuestions && Boolean(localAnswers[clampedIndex])

  const summaryAnswers = useMemo(() => {
    if (!isComplete || totalQuestions <= 1) return []
    return Array.from({ length: totalQuestions }, (_, idx) => ({
      index: idx + 1,
      answer: localAnswers[idx + 1],
    }))
  }, [isComplete, localAnswers, totalQuestions])

  const summaryText = useMemo(() => {
    if (!isComplete) return ""
    if (summaryAnswers.length > 0) {
      return summaryAnswers
        .map((item) => `${item.index}: ${item.answer ? formatAnswer(item.answer) : "Pending"}`)
        .join(" • ")
    }
    if (outputAnswer) return formatAnswer(outputAnswer)
    if (localAnswers[clampedIndex]) return formatAnswer(localAnswers[clampedIndex])
    return "Pending"
  }, [isComplete, summaryAnswers, outputAnswer, localAnswers, clampedIndex])

  const goPrev = () => {
    if (!canGoPrev) return
    onPreviousQuestion?.()
    if (!isControlled) setLocalIndex((prev) => Math.max(1, prev - 1))
  }

  const goNext = () => {
    if (!canGoNext) return
    onNextQuestion?.()
    if (!isControlled) setLocalIndex((prev) => Math.min(totalQuestions, prev + 1))
  }

  if (!question) return null

  return (
    <div className={cn("lotus-glass-panel overflow-hidden rounded-2xl border border-border/55", className)}>
      <div className="lotus-glass-inset flex h-8 items-center justify-between border-b border-border/35 px-3 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Question{totalQuestions > 1 ? `s (${clampedIndex}/${totalQuestions})` : ""}</span>
        </div>
        {showNavigation && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              aria-label="Previous question"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span>{clampedIndex} of {totalQuestions}</span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-muted disabled:opacity-40"
              aria-label="Next question"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isComplete ? (
        <div className="lotus-glass-inset px-3 py-2 text-xs text-muted-foreground">{summaryText}</div>
      ) : (
        <QuestionPrompt
          key={`${clampedIndex}-${question.title}`}
          questions={questions}
          questionIndex={clampedIndex}
          totalQuestions={totalQuestions}
          initialAnswer={localAnswers[clampedIndex]}
          submitLabel={submitLabel}
          nextLabel={nextLabel}
          skipLabel={skipLabel}
          allowSkip={allowSkip}
          onSubmit={(nextAnswer) => {
            if (nextAnswer.kind === "skip") {
              const skippedAnswers = Object.fromEntries(
                Array.from({ length: totalQuestions }, (_, idx) => [idx + 1, nextAnswer])
              ) as Record<number, QuestionAnswer>
              setLocalAnswers(skippedAnswers)
              onSubmitAnswer?.(nextAnswer, skippedAnswers)
              return
            }

            const nextAnswers = { ...localAnswers, [clampedIndex]: nextAnswer }
            setLocalAnswers(nextAnswers)
            if (clampedIndex < totalQuestions) goNext()
            else if (Object.keys(nextAnswers).length >= totalQuestions) onSubmitAnswer?.(nextAnswer, nextAnswers)
            else if (!isControlled) {
              const firstUnanswered = Array.from(
                { length: totalQuestions },
                (_, idx) => idx + 1
              ).find((idx) => !nextAnswers[idx])
              if (firstUnanswered) setLocalIndex(firstUnanswered)
            }
          }}
        />
      )}
    </div>
  )
}
