"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp } from 'lucide-react'
import { Stack } from '@astryxdesign/core'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { clearTaskDraft, readTaskDraft, saveTaskDraft } from '@/lib/tasks/draft-transfer'

export function TaskEntry({ suggestedPrompt, promptRequestId }: { suggestedPrompt?: string; promptRequestId?: number }) {
  const { user, loading } = useAuth()
  const uid = user?.uid ?? null
  const router = useRouter()
  const [draft, setDraft] = useState<{ owner: string | null; text: string }>({ owner: uid, text: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const text = draft.owner === uid ? draft.text : ''
  useEffect(() => {
    if (loading) return
    setError(''); setBusy(false)
    try { setDraft({ owner: uid, text: readTaskDraft(sessionStorage, uid)?.text ?? '' }) }
    catch { setDraft({ owner: uid, text: '' }); setError('Draft storage is unavailable. You can type here, but continuing requires storage in this tab.') }
  }, [uid, loading])
  useEffect(() => {
    if (!suggestedPrompt) return
    setDraft({ owner: uid, text: suggestedPrompt })
    try { saveTaskDraft(sessionStorage, uid, suggestedPrompt) } catch { setError('This suggestion could not be saved in this tab.') }
  }, [suggestedPrompt, promptRequestId])
  const edit = (value: string) => {
    setDraft({ owner: uid, text: value }); setError('')
    try { if (value.trim()) saveTaskDraft(sessionStorage, uid, value); else clearTaskDraft(sessionStorage, uid) }
    catch { setError('Your draft could not be saved. Keep this page open and try again.') }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (loading || busy || draft.owner !== uid || !text.trim()) return
    try {
      saveTaskDraft(sessionStorage, uid, text.trim(), 'code', true)
      setBusy(true); setError('')
      router.push(user ? '/tasks' : '/login?redirect=%2Ftasks')
    } catch { setError('Could not carry your draft to the workspace. Allow session storage and try again; nothing has started.') }
  }
  return <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <label htmlFor="project-brief" className="sr-only">Describe what you want to build</label>
    <Textarea id="project-brief" value={text} onChange={event => edit(event.target.value)} maxLength={32000} disabled={loading || busy} placeholder="Describe what you want to build…" className="min-h-28 resize-y border-0 bg-transparent text-base shadow-none focus-visible:ring-0" aria-describedby="task-entry-help" />
    <Stack direction="horizontal" hAlign="between" vAlign="center" gap={4} className="pt-3">
      <p id="task-entry-help" className="max-w-sm text-xs leading-5 text-muted-foreground">Review and start in your workspace. {user ? 'Nothing runs until you confirm.' : 'Sign in to continue; nothing starts yet.'}</p>
      <Button type="submit" disabled={loading || busy || !text.trim()} aria-label="Continue with this task"><ArrowUp size={16} />{busy ? 'Opening…' : 'Continue'}</Button>
    </Stack>
    {error && <p role="alert" className="pt-3 text-sm text-destructive">{error}</p>}
  </form>
}
