"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { BackendSession } from "@/lib/backend/client"
import { Markdown } from "@/components/ui/markdown"

type PendingInput = NonNullable<BackendSession['pendingInput']>
type Question = NonNullable<PendingInput['questions']>[number]

export function formatPendingInputAnswers(questions: readonly Question[], answers: Readonly<Record<string, string>>) {
  return questions.map((question) => `Question: ${question.prompt}\nAnswer: ${answers[question.id]}`).join('\n\n')
}

export function firstUnansweredQuestion(questions: readonly Question[], answers: Readonly<Record<string, string>>) {
  return questions.findIndex((question) => !answers[question.id]?.trim())
}

export function PendingInputCard({ request, busy, onAnswer }: {
  request: PendingInput
  busy: boolean
  onAnswer(answer: string): void
}) {
  const questions = request.questions ?? [{ id: request.id, prompt: request.prompt }]
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [customQuestions, setCustomQuestions] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const question = questions[index]!
  const selectedAnswer = answers[question.id]
  const custom = customQuestions[question.id] === true
  const submit = (answer: string) => {
    if (!request.questions) { onAnswer(answer); return }
    const next = { ...answers, [question.id]: answer }
    setAnswers(next)
    if (index < questions.length - 1) { setIndex(index + 1); return }
    const unanswered = firstUnansweredQuestion(questions, next)
    if (unanswered >= 0) { setIndex(unanswered); return }
    onAnswer(formatPendingInputAnswers(questions, next))
  }
  return (
    <section aria-label="Waiting for your response" className="mb-3 text-sm text-foreground">
      {request.kind === 'approval' ? (
        <>
        <Markdown className="text-[13px] leading-relaxed">{request.prompt}</Markdown>
        <div className="mt-2 flex gap-3">
          <button type="button" className="underline" disabled={busy} onClick={() => onAnswer('approve')}>Approve</button>
          <button type="button" className="underline" disabled={busy} onClick={() => onAnswer('reject')}>Reject</button>
        </div>
        </>
      ) : (
        <>
          {request.questions && <Markdown className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{request.prompt}</Markdown>}
          {questions.length > 1 && <p className="mb-2 text-[11px] font-medium text-muted-foreground">Question {index + 1} of {questions.length}</p>}
          <Markdown className="text-[14px] font-medium leading-relaxed">{question.prompt}</Markdown>
          {question.options && !custom && <div className="mt-3 space-y-2">
            {question.options.map((option) => {
              const selected = selectedAnswer === option.label
              return <button key={option.label} type="button" disabled={busy} aria-pressed={selected} onClick={() => submit(option.label)}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted disabled:opacity-60">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60">
                {selected && <span className="h-2 w-2 rounded-full bg-foreground" />}
              </span>
              <span><span className="block text-[13px] font-medium">{option.label}</span>
                {option.description && <span className="mt-0.5 block text-[12px] text-muted-foreground">{option.description}</span>}</span>
            </button>
            })}
            <button type="button" disabled={busy} onClick={() => {
              setCustomQuestions((current) => ({ ...current, [question.id]: true }))
              if (question.options?.some((option) => option.label === selectedAnswer)) {
                setDrafts((current) => ({ ...current, [question.id]: '' }))
              }
            }}
              className="px-3.5 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-60">Something else</button>
          </div>}
          {(!question.options || custom) && <form className="mt-3 flex gap-2" onSubmit={(event) => {
            event.preventDefault(); const answer = (drafts[question.id] ?? '').trim(); if (answer) submit(answer)
          }}>
            <input name="answer" autoFocus disabled={busy} placeholder="Type your answer" value={drafts[question.id] ?? selectedAnswer ?? ''}
              onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))} maxLength={8000}
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring/50" />
            <button type="submit" disabled={busy} className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground disabled:opacity-60">Continue</button>
            {question.options && <button type="button" disabled={busy}
              onClick={() => setCustomQuestions((current) => ({ ...current, [question.id]: false }))}
              className="px-2 text-[12px] text-muted-foreground disabled:opacity-60">Back</button>}
          </form>}
          {questions.length > 1 && <div className="mt-3 flex items-center justify-between">
            <button type="button" aria-label="Previous question" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}
              className="rounded-lg p-1.5 text-muted-foreground disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Next question" disabled={busy || index === questions.length - 1} onClick={() => setIndex(index + 1)}
              className="rounded-lg p-1.5 text-muted-foreground disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>}
        </>
      )}
    </section>
  )
}
