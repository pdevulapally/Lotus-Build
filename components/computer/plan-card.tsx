"use client"

import { useState } from "react"
import { AlertTriangle, Check, ChevronsDown, ChevronsUp, Circle, Loader2, Minus, RotateCcw } from "lucide-react"
import { Markdown } from "@/components/ui/markdown"
import { cn } from "@/lib/utils"
import type { PlanStep, PlanStepStatus, PlanUpdate, SessionPlan } from "@/lib/backend/session-plan"

export type PlanCardActions = {
  canApprove: boolean
  canEdit: boolean
  busy: boolean
  onApprove: (revision: number) => void
  onEdit: (revision: number, update: PlanUpdate) => void
}

/** Plan text is written by the model from repository content: shown as text, never as HTML. */
const stepLabels: Record<PlanStepStatus, string> = {
  proposed: "Not started", in_progress: "In progress", done: "Done", skipped: "Skipped", blocked: "Blocked",
}

function StepMark({ status }: { status: PlanStepStatus }) {
  const className = "h-3.5 w-3.5 shrink-0"
  if (status === "done") return <Check className={cn(className, "text-foreground")} aria-hidden />
  if (status === "in_progress") return <Loader2 className={cn(className, "animate-spin text-foreground")} aria-hidden />
  if (status === "skipped") return <Minus className={cn(className, "text-muted-foreground")} aria-hidden />
  if (status === "blocked") return <AlertTriangle className={cn(className, "text-warning")} aria-hidden />
  return <Circle className={cn(className, "text-muted-foreground/70")} aria-hidden />
}

function headline(plan: SessionPlan, canApprove: boolean) {
  if (plan.approvedRevision === undefined) return canApprove ? "Before I build" : "Plan"
  if (plan.approvedRevision === plan.revision) return "Approved plan"
  return "Plan changed since you approved it"
}

export function PlanCard({ plan, actions }: { plan: SessionPlan; actions?: PlanCardActions }) {
  const [expanded, setExpanded] = useState(false)
  const [answering, setAnswering] = useState<{ id: string; text: string } | null>(null)
  const canApprove = actions?.canApprove === true && !actions.busy
  const canEdit = actions?.canEdit === true && !actions.busy
  const open = plan.questions.filter((question) => question.answer === undefined)
  const extras = [...plan.checks.map((item) => ({ group: "Checks", item })), ...plan.risks.map((item) => ({ group: "Risks", item })), ...plan.decisions.map((item) => ({ group: "Decisions", item }))]
  const progress = plan.steps.filter((step) => step.status === "done").length

  const setStep = (step: PlanStep, status: "proposed" | "skipped") => {
    actions?.onEdit(plan.revision, { steps: [status === "skipped" ? { id: step.id, status, note: "Skipped by you" } : { id: step.id, status }] })
  }
  const submitAnswer = () => {
    if (!answering || answering.text.trim().length === 0) return
    actions?.onEdit(plan.revision, { answers: [{ id: answering.id, answer: answering.text.trim() }] })
    setAnswering(null)
  }

  return (
    <section aria-label="Plan" data-plan-revision={plan.revision} className="my-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
        <span className="text-xs font-semibold text-muted-foreground">{headline(plan, actions?.canApprove === true)}</span>
        <span className="text-[11px] text-muted-foreground">{plan.steps.length === 0 ? "" : `${progress} of ${plan.steps.length} done`}</span>
      </div>
      <div className="px-3.5 pb-3.5 pt-3">
        <h3 className="text-[14px] font-semibold text-foreground">{plan.title}</h3>
        {plan.summary && <Markdown className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{plan.summary}</Markdown>}
        {plan.steps.length > 0 && (
          <ol className="mt-3 space-y-2">
            {plan.steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2.5">
                <span className="mt-[3px]" title={stepLabels[step.status]}>
                  <StepMark status={step.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] leading-snug text-foreground", step.status === "skipped" && "text-muted-foreground line-through")}>{step.title}</p>
                  {step.detail && expanded && <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">{step.detail}</p>}
                  {step.note && <p className="mt-0.5 text-[12px] text-muted-foreground">{step.note}</p>}
                </div>
                {canEdit && (step.status === "proposed" || step.status === "skipped") && (
                  <button
                    type="button"
                    onClick={() => setStep(step, step.status === "proposed" ? "skipped" : "proposed")}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {step.status === "proposed" ? "Skip" : <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" aria-hidden />Restore</span>}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {plan.questions.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{open.length > 0 ? "What still needs your input" : "Your answers"}</p>
            <ul className="mt-2 space-y-2">
              {plan.questions.map((question) => (
                <li key={question.id} className="text-[13px] leading-snug">
                  <p className="text-foreground">{question.text}</p>
                  {question.answer !== undefined ? (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">You: {question.answer}</p>
                  ) : canEdit && answering?.id === question.id ? (
                    <form className="mt-1.5 flex items-start gap-2" onSubmit={(event) => { event.preventDefault(); submitAnswer() }}>
                      <textarea
                        autoFocus rows={2} maxLength={2000} value={answering.text}
                        onChange={(event) => setAnswering({ id: question.id, text: event.target.value })}
                        className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        placeholder="Your answer"
                      />
                      <button type="submit" className="rounded-xl bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">Save</button>
                      <button type="button" onClick={() => setAnswering(null)} className="px-1 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">Cancel</button>
                    </form>
                  ) : canEdit ? (
                    <button type="button" onClick={() => setAnswering({ id: question.id, text: "" })} className="mt-0.5 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Answer</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(extras.length > 0 || plan.steps.some((step) => step.detail)) && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-3 flex items-center gap-1 rounded-md px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {expanded ? <ChevronsUp className="h-3 w-3 shrink-0" aria-hidden /> : <ChevronsDown className="h-3 w-3 shrink-0" aria-hidden />}
            {expanded ? "Show less" : "Show details"}
          </button>
        )}
        {expanded && extras.length > 0 && (
          <dl className="mt-2 space-y-2">
            {(["Checks", "Risks", "Decisions"] as const).filter((group) => extras.some((entry) => entry.group === group)).map((group) => (
              <div key={group}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group}</dt>
                {extras.filter((entry) => entry.group === group).map((entry, index) => (
                  <dd key={`${group}-${index}`} className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{entry.item}</dd>
                ))}
              </div>
            ))}
          </dl>
        )}
      </div>
      {actions && (actions.canApprove || actions.busy) && (
        <div className="flex items-center gap-3 border-t border-border/70 px-3.5 py-3">
          <button
            type="button"
            onClick={() => actions.onApprove(plan.revision)}
            disabled={!canApprove}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {actions.busy ? "One moment…" : plan.approvedRevision === undefined ? "Approve and build" : "Approve the changes and build"}
          </button>
          <span className="text-[11px] text-muted-foreground">{open.length > 0 ? "or answer the questions first" : "or type to revise"}</span>
        </div>
      )}
    </section>
  )
}
