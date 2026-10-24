'use client'
import { useState } from 'react'
import { Stack } from '@astryxdesign/core'
import { Button } from '@/components/ui/button'
import { approvalDecisions, type TaskSession, type ApprovalDecision } from '@/lib/tasks/contract'

export function TaskApproval({ session, busy, onDecision }: { session: TaskSession; busy: boolean; onDecision: (id: string, decisions: ApprovalDecision[]) => Promise<boolean> }) {
  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const pending = session.pending_approval!
  const required = pending.calls.filter(call => call.risky)
  const complete = required.length > 0 && required.every(call => typeof choices[call.id] === 'boolean')
  return <Stack as="section" gap={4} className="rounded-xl bg-muted p-6" aria-labelledby="approval-heading">
    <Stack gap={1}><h2 id="approval-heading" className="text-lg font-semibold">Before I continue</h2><p className="text-sm text-muted-foreground">Review this permission boundary before work continues. Your decision applies only to this request.</p></Stack>
    {pending.calls.map(call => <Stack as="section" gap={2} key={call.id}>
      <Stack direction="horizontal" hAlign="between" vAlign="center" gap={2}><h3 className="font-medium">{call.name}</h3><span className="text-xs text-muted-foreground">{call.risky ? 'Decision required' : 'Runs when this batch resumes'}</span></Stack>
      <details open><summary className="cursor-pointer text-sm text-muted-foreground">Inspect exact action details</summary><pre className="max-h-48 overflow-auto rounded-lg bg-background p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(call.input, null, 2)}</pre></details>
      {call.risky && <fieldset disabled={busy} className="flex gap-4"><legend className="sr-only">Decision for {call.name} ({call.id})</legend>
        {[{ label: 'Approve', value: true }, { label: 'Deny', value: false }].map(choice => <label key={choice.label} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name={`decision-${call.id}`} checked={choices[call.id] === choice.value} onChange={() => setChoices(value => ({ ...value, [call.id]: choice.value }))} />{choice.label}</label>)}
      </fieldset>}
    </Stack>)}
    <p className="text-xs text-muted-foreground">Denying a requested action does not cancel other actions in the batch. Use Stop task to stop the whole task.</p>
    <Button disabled={busy || !complete || session.recovery_required} className="self-start" onClick={() => void onDecision(pending.id, approvalDecisions(session, choices))}>{busy ? 'Sending decision…' : 'Submit decisions'}</Button>
  </Stack>
}
