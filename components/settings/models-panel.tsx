import type { BackendAccount, BackendSession } from '@/lib/backend/client'
import { modelLabel } from '@/lib/backend/model-selection'
import { sessionModel } from '@/lib/settings/models'

export function ModelsPanel({ account, sessionId, session, error, loading }: {
  account: BackendAccount; sessionId: string | null; session: BackendSession | null; error: string | null; loading: boolean
}) {
  const current = session ? sessionModel(session) : null
  return (
    <section className="space-y-7">
      {sessionId && <section className="border-b border-border/60 pb-6" aria-labelledby="settings-current-model">
        <h3 id="settings-current-model" className="text-xs font-medium text-muted-foreground">This session</h3>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">The session model could not be loaded. {error}</p> : current ? <>
          <p className="mt-3 text-xl font-semibold tracking-tight">{modelLabel(account.models, current.id)}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.continuation ? 'Free continuation model' : 'Selected model for this session'}</p>
          {current.continuation && <p className="mt-2 text-xs text-muted-foreground">Original selection: {modelLabel(account.models, session!.model)}</p>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Account usage includes all your sessions and any continuation models, not only this model.</p>
        </> : <p role="status" className="mt-3 text-sm text-muted-foreground">{loading ? 'Loading the session model…' : 'The session model is unavailable. Refresh to try again.'}</p>}
      </section>}
      <section aria-labelledby="settings-available-models">
        <h3 id="settings-available-models" className="text-sm font-semibold">Available for new sessions</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Choose a model in the message box when starting a new session. These are the same models available to your {account.plan.name} account.</p>
        {account.models.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No models are currently available. Refresh to check again.</p> : <ul className="mt-4 divide-y divide-border/60">
          {account.models.map((model) => <li key={model.id} className="py-4">
            <p className="text-sm font-medium">{modelLabel(account.models, model.id)}</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="w-fit cursor-pointer rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">Model details</summary>
              <section className="mt-2 space-y-2 leading-relaxed">
                <dl><dt className="font-medium">Model ID</dt><dd className="break-all">{model.id}</dd></dl>
                <dl><dt className="font-medium">Maximum output per response</dt><dd>{model.maxOutputTokens.toLocaleString()} tokens</dd></dl>
              </section>
              <p className="mt-2">This response limit is separate from your account allowance.</p>
            </details>
          </li>)}
        </ul>}
      </section>
    </section>
  )
}
