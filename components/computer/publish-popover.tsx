'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Popover } from '@astryxdesign/core/Popover'
import { Button } from '@astryxdesign/core/Button'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { currentBackend } from '@/lib/backend/browser'
import { loadNetlifyDeploymentHistory, netlifyPreparationAccess, pendingNetlifyDeployment, type NetlifyDeployment } from '@/lib/backend/netlify'
import { redactSecrets, type TerminalEntry } from '@/lib/backend/terminal'
import type { ComputerTimelineEvent } from './session-types'
import { NetlifyDeploymentCard } from '@/components/integrations/netlify-deployment-card'
import { Terminal, TerminalContent, TerminalCopyButton, TerminalHeader, TerminalTitle } from '@/components/ai-elements/terminal'

type Props = {
  projectId: string
  blockedReason?: string
  running: boolean
  terminal: TerminalEntry[]
  events: ComputerTimelineEvent[]
  onPrepare: () => Promise<void>
}
const accessMessages = {
  unavailable: 'Netlify publishing isn’t available yet. Check Integrations or contact support.',
  connect: 'Connect Netlify before preparing a deployment.',
  access: 'Grant this project access and enable deployment preparation in Integration access.',
}

export function PublishPopover(props: Props) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<NetlifyDeployment[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [request, setRequest] = useState<'none' | 'checking' | 'sending' | 'accepted' | 'uncertain'>('none')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [boundary, setBoundary] = useState<{ commands: string[]; events: string[]; deployments: string[] } | null>(null)
  const latest = useRef(props)
  latest.current = props
  const inFlight = useRef(false)
  const attempted = useRef(false)
  const lifetime = useRef<AbortController | null>(null)

  useEffect(() => {
    lifetime.current = new AbortController()
    return () => lifetime.current?.abort()
  }, [])

  // A panel close stops status reads, not the task or an accepted publication.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const result = await loadNetlifyDeploymentHistory(currentBackend(), props.projectId, controller.signal)
        if (controller.signal.aborted) return
        setRecords(result.deployments)
        if (result.refreshFailed) { setMessage('Some statuses couldn’t be checked. Use Refresh before trying another publication.'); return }
        const expiry = result.deployments.filter(record => record.status === 'awaiting_approval').map(record => Date.parse(record.expiresAt) - Date.now()).filter(delay => delay > 0)
        const delay = Math.min(5000, ...expiry)
        timer = setTimeout(() => { void load() }, Math.max(1, delay))
      } catch {
        if (!controller.signal.aborted) setMessage('Deployment status couldn’t be loaded. Use Refresh to check again.')
      }
    }
    void load()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [open, props.projectId, revision])

  const prepare = async () => {
    if (inFlight.current || attempted.current) return
    const signal = lifetime.current?.signal
    if (!signal || signal.aborted) return
    inFlight.current = true
    setMessage(null); setRequest('checking')
    try {
      const client = currentBackend()
      const history = await loadNetlifyDeploymentHistory(client, latest.current.projectId, signal)
      if (signal.aborted) return
      setRecords(history.deployments)
      if (history.refreshFailed) { setMessage('Check the existing deployment status before starting another publication.'); setRequest('none'); return }
      if (pendingNetlifyDeployment(history.deployments)) { setRequest('none'); return }
      if (latest.current.blockedReason) { setMessage(latest.current.blockedReason); setRequest('none'); return }
      const access = await netlifyPreparationAccess(client, latest.current.projectId, signal)
      if (signal.aborted) return
      if (access !== 'ready') { setMessage(accessMessages[access]); setRequest('none'); return }
      if (latest.current.blockedReason) { setMessage(latest.current.blockedReason); setRequest('none'); return }
      attempted.current = true
      setBoundary({ commands: latest.current.terminal.map(entry => entry.id), events: latest.current.events.flatMap(event => event.id ? [event.id] : []), deployments: history.deployments.map(record => record.id) })
      setRequest('sending')
      await latest.current.onPrepare()
      if (!signal.aborted) setRequest('accepted')
    } catch {
      if (!signal.aborted) {
        setRequest(attempted.current ? 'uncertain' : 'none')
        setMessage(attempted.current ? 'The preparation request couldn’t be confirmed. Use Retry original message in the workspace; reopening this panel won’t send it again.' : 'Publishing access couldn’t be checked. Use Refresh and try again.')
      }
    } finally { inFlight.current = false }
  }

  const submit = async (record: NetlifyDeployment, action: 'approve' | 'reject') => {
    if (inFlight.current) return
    if (action === 'approve' && Date.parse(record.expiresAt) <= Date.now()) { setMessage('This review expired. Ask the project agent to prepare a fresh build.'); return }
    inFlight.current = true; setBusy(true); setMessage(null)
    try {
      const client = currentBackend()
      const result = action === 'approve' ? await client.approveNetlifyDeployment(props.projectId, record.id, record.sha256)
        : await client.rejectNetlifyDeployment(props.projectId, record.id)
      if (!lifetime.current?.signal.aborted) setRecords(previous => previous.map(item => item.id === record.id ? result.deployment : item))
    } catch {
      if (!lifetime.current?.signal.aborted) setMessage('The publication outcome couldn’t be confirmed. Refresh its status before trying again.')
    } finally { inFlight.current = false; if (!lifetime.current?.signal.aborted) { setBusy(false); setRevision(value => value + 1) } }
  }

  const commands = boundary ? props.terminal.filter(entry => !boundary.commands.includes(entry.id)) : []
  const activities = boundary ? props.events.filter(event => event.id !== undefined && !boundary.events.includes(event.id)
    && ['prepare_netlify_deployment', 'netlify_deployment_options', 'get_netlify_deployment'].includes(String(event.metadata?.toolName))) : []
  const output = redactSecrets([
    ...commands.map(entry => [`$ ${entry.command}`, entry.output, entry.exitCode === undefined ? undefined : `Exit code: ${entry.exitCode}`].filter(Boolean).join('\n')),
    ...activities.map(event => `${event.title} (${event.status})`),
  ].join('\n\n'))
  const visibleRecords = boundary ? records.filter(record => !boundary.deployments.includes(record.id)) : records
  const current = pendingNetlifyDeployment(visibleRecords) ?? visibleRecords[0]
  const canPrepareAgain = request === 'accepted' && !props.running && current && (['ready', 'error', 'rejected'].includes(current.status)
    || (current.status === 'awaiting_approval' && Date.parse(current.expiresAt) <= Date.now()))
  useEffect(() => {
    if (request === 'uncertain' && current) { setRequest('accepted'); setMessage(null) }
  }, [request, current?.id])

  return <Popover label="Publish to Netlify" placement="below" alignment="end" width="min(36rem, calc(100vw - 2rem))" padding={4} isOpen={open}
    onOpenChange={next => { setOpen(next); if (next) void prepare() }} content={
      <VStack gap={4} className="max-h-[80dvh] overflow-y-auto">
        <HStack align="center" justify="between" gap={3}><h2 className="text-base font-semibold">Publish to Netlify</h2><Button label="Close" variant="ghost" onClick={() => setOpen(false)} /></HStack>
        <p className="text-sm text-muted-foreground">Prepare the build here, then review and approve publication. Preparation uses your AI allowance.</p>
        <p role="status" className="text-sm">{request === 'checking' ? 'Checking saved deployments and access…' : request === 'sending' ? 'Sending preparation request…' : props.running && request === 'accepted' ? 'The project agent is preparing your deployment.' : request === 'accepted' && !current ? 'The preparation request was accepted. Check the conversation for progress or questions.' : 'Only an approved build can be published.'}</p>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <Terminal output={output} isStreaming={props.running && request === 'accepted'}>
          <TerminalHeader><TerminalTitle>Deployment output</TerminalTitle><TerminalCopyButton /></TerminalHeader><TerminalContent className="max-h-64" />
        </Terminal>
        {!output && <p className="text-xs text-muted-foreground">No terminal output has been reported for this preparation request yet. Upload progress is shown by deployment status.</p>}
        {current && <ul className="list-none p-0"><NetlifyDeploymentCard record={current} busy={busy || request === 'sending' || request === 'checking'} onSubmit={action => { void submit(current, action) }} /></ul>}
        <HStack gap={3} wrap="wrap"><Button label="Refresh" variant="secondary" isDisabled={busy} onClick={() => { setMessage(null); setRevision(value => value + 1) }} />
          {request === 'none' && !pendingNetlifyDeployment(records) && <Button label="Prepare deployment" isDisabled={Boolean(props.blockedReason)} onClick={() => { void prepare() }} />}
          {canPrepareAgain && <Button label="Prepare new deployment" isDisabled={busy || Boolean(props.blockedReason)} onClick={() => { attempted.current = false; void prepare() }} />}
          <Link href="/integrations#integration-access" className="text-sm underline">Integration access</Link>
          <Link href={`/integrations/netlify/deployments?projectId=${encodeURIComponent(props.projectId)}`} className="text-sm underline">Deployment history</Link>
        </HStack>
      </VStack>
    }><Button label="Publish" variant="primary" /></Popover>
}
