"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, ChevronDown, ChevronUp, CircleAlert, CircleArrowRight, CircleCheck, CircleDashed, CircleMinus, RotateCcw, type LucideIcon } from "lucide-react"
import { Markdown } from "@/components/ui/markdown"
import { duration, ease, softSpring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { PlanStep, PlanStepStatus, PlanUpdate, SessionPlan } from "@/lib/backend/session-plan"

export type PlanCardActions = {
  approvalRequired: boolean
  canApprove: boolean
  canEdit: boolean
  busy: boolean
  onApprove: (revision: number) => void
  onEdit: (revision: number, update: PlanUpdate) => void
}

/**
 * How a to-do looks for each step status, in one place: the list itself never
 * branches on status. `edit` is the one change the user may make to a step
 * (only the agent marks work started, done or blocked). Plan text is written
 * by the model from repository content: shown as text, never as HTML.
 */
type StepLook = { label: string; Mark: LucideIcon; mark: string; title: string; edit?: "skip" | "restore" }
const stepLooks: Record<PlanStepStatus, StepLook> = {
  proposed: { label: "Not started", Mark: CircleDashed, mark: "text-muted-foreground/60", title: "text-muted-foreground/80", edit: "skip" },
  in_progress: { label: "In progress", Mark: CircleArrowRight, mark: "text-foreground", title: "font-medium text-foreground" },
  done: { label: "Done", Mark: CircleCheck, mark: "text-muted-foreground/70", title: "text-muted-foreground/80 line-through decoration-muted-foreground/60" },
  skipped: { label: "Skipped", Mark: CircleMinus, mark: "text-muted-foreground/60", title: "text-muted-foreground/70 line-through decoration-muted-foreground/60", edit: "restore" },
  blocked: { label: "Blocked", Mark: CircleAlert, mark: "text-warning", title: "text-foreground" },
}

function PlanStepRow({ step, expanded, canEdit, onChange }: {
  step: PlanStep
  expanded: boolean
  canEdit: boolean
  onChange: (step: PlanStep, status: "proposed" | "skipped") => void
}) {
  const reducedMotion = useReducedMotion()
  const look = stepLooks[step.status]
  const active = step.status === "in_progress"
  return (
    <motion.li
      layout="position"
      initial={reducedMotion ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: duration.base, ease, layout: softSpring }}
      data-plan-step={step.id}
      data-plan-step-status={step.status}
      className={cn("flex items-start gap-2.5 rounded-lg transition-colors duration-300", active && "bg-accent/35 px-2 py-1.5 -mx-2")}
    >
      <span className="mt-[2px] h-4 w-4 shrink-0" title={look.label}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={step.status}
            className="block"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.65 }}
            animate={active && !reducedMotion
              ? { opacity: [1, 0.72, 1], scale: 1, x: [0, 2, 0] }
              : { opacity: 1, scale: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
            transition={active && !reducedMotion
              ? { duration: 1.45, repeat: Infinity, ease: "easeInOut" }
              : reducedMotion ? { duration: 0 } : softSpring}
          >
            <look.Mark className={cn("h-4 w-4 shrink-0", look.mark)} strokeWidth={1.75} aria-hidden />
          </motion.span>
        </AnimatePresence>
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] leading-5 transition-[color,opacity] duration-300", look.title)}>{step.title}</p>
        {step.detail && expanded && <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">{step.detail}</p>}
        <AnimatePresence initial={false}>
          {step.note && (
            <motion.p
              key={step.note}
              initial={reducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: duration.base, ease }}
              className="mt-0.5 text-[12px] text-muted-foreground"
            >
              {step.note}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {canEdit && look.edit && (
        <button
          type="button"
          onClick={() => onChange(step, look.edit === "skip" ? "skipped" : "proposed")}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {look.edit === "skip" ? "Skip" : <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" aria-hidden />Restore</span>}
        </button>
      )}
    </motion.li>
  )
}

function headline(plan: SessionPlan, actions?: PlanCardActions) {
  if (plan.approvedRevision === undefined) return actions?.approvalRequired === true ? (actions.canApprove ? "Before I build" : "Plan") : "Working plan"
  if (plan.approvedRevision === plan.revision) return "Approved plan"
  return "Plan changed since you approved it"
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const fraction = total === 0 ? 0 : done / total
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0 -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={radius} className="stroke-border" strokeWidth="2" fill="none" />
      <circle
        cx="9" cy="9" r={radius} className="stroke-foreground transition-[stroke-dashoffset] duration-500 ease-out" strokeWidth="2" fill="none"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)}
      />
    </svg>
  )
}

export function PlanCard({ plan, actions }: { plan: SessionPlan; actions?: PlanCardActions }) {
  const [expanded, setExpanded] = useState(false)
  const [answering, setAnswering] = useState<{ id: string; text: string } | null>(null)
  const canApprove = actions?.canApprove === true && !actions.busy
  const canEdit = actions?.canEdit === true && !actions.busy
  const open = plan.questions.filter((question) => question.answer === undefined)
  const answered = plan.questions.filter((question) => question.answer !== undefined)
  const extras = [...plan.checks.map((item) => ({ group: "Checks", item })), ...plan.risks.map((item) => ({ group: "Risks", item })), ...plan.decisions.map((item) => ({ group: "Decisions", item }))]
  const done = plan.steps.filter((step) => step.status === "done").length
  const progress = `${done} of ${plan.steps.length} done`

  // Waiting for the user's approval, the whole plan matters. Otherwise the to-dos lead and the
  // rest of the plan folds away behind "Show plan".
  const awaitingApproval = actions?.approvalRequired === true && plan.approvedRevision !== plan.revision
  const showPlanBody = awaitingApproval || expanded
  const hasDetails = extras.length > 0 || plan.steps.some((step) => step.detail)
  const showToggle = awaitingApproval ? hasDetails : true
  const toggleLabel = awaitingApproval ? (expanded ? "Show less" : "Show details") : (expanded ? "Hide plan" : "Show plan")

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
      <div className="flex items-center justify-between gap-3 px-3.5 pt-3 pb-1">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
          <ProgressRing done={done} total={plan.steps.length} />
          <span className="truncate">{awaitingApproval ? headline(plan, actions) : "To-dos"}</span>
        </span>
        {plan.steps.length > 0 && (
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground" title={progress} aria-label={progress}>{done}/{plan.steps.length}</span>
        )}
      </div>
      <div className="px-3.5 pb-3.5">
        {showPlanBody ? (
          <div className="pt-1.5">
            <h3 className="text-[14px] font-semibold text-foreground">{plan.title}</h3>
            {plan.summary && <Markdown className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{plan.summary}</Markdown>}
          </div>
        ) : (
          <p className="truncate pt-0.5 text-[12px] text-muted-foreground">{headline(plan, actions)} · {plan.title}</p>
        )}
        {plan.steps.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {plan.steps.map((step) => (
                <PlanStepRow key={step.id} step={step} expanded={expanded} canEdit={canEdit} onChange={setStep} />
              ))}
            </AnimatePresence>
          </ol>
        )}
        {(open.length > 0 || (showPlanBody && answered.length > 0)) && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{open.length > 0 ? "What still needs your input" : "Your answers"}</p>
            <ul className="mt-2 space-y-2">
              {(showPlanBody ? plan.questions : open).map((question) => (
                <li key={question.id} className="text-[13px] leading-snug">
                  <p className="text-foreground">{question.text}</p>
                  {question.answer !== undefined ? (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">You: {question.answer}</p>
                  ) : canEdit && answering?.id === question.id ? (
                    <form className="mt-1.5 flex items-start gap-2" onSubmit={(event) => { event.preventDefault(); submitAnswer() }}>
                      <textarea
                        autoFocus rows={2} maxLength={2000} value={answering.text}
                        onChange={(event) => setAnswering({ id: question.id, text: event.target.value })}
                        className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-3 flex items-center gap-1 rounded-md px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? <ChevronUp className="h-3 w-3 shrink-0" aria-hidden /> : <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />}
            {toggleLabel}
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
      {actions?.approvalRequired === true && (actions.canApprove || actions.busy) && (
        <div className="flex items-center gap-3 border-t border-border/70 px-3.5 py-3">
          <button
            type="button"
            onClick={() => actions.onApprove(plan.revision)}
            disabled={!canApprove}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
