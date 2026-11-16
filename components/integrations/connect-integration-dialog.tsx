'use client'

import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Info, MoreHorizontal } from 'lucide-react'
import { HStack } from '@astryxdesign/core/HStack'
import { VStack } from '@astryxdesign/core/VStack'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LotusLogo } from '@/components/ui/lotus-logo'
import { BrandLogo } from '@/components/integrations/connector-icons'
import type { Connector } from '@/lib/backend/connections'
import { connectionInformation } from '@/lib/integrations/connection-information'

type Props = {
  connector: Connector | null
  configured: boolean
  busy: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onConnect: (connector: Connector) => void | Promise<void>
}

export function ConnectIntegrationDialog({ connector, configured, busy, error, onOpenChange, onConnect }: Props) {
  const ready = Boolean(connector && configured && connector.status === 'available')
  const StatusIcon = ready ? CheckCircle2 : Info
  return <Dialog open={Boolean(connector)} onOpenChange={onOpenChange}>
    <DialogContent className="dark integration-connect-dialog">
      {connector && <>
        <VStack gap={4} className="integration-connect-dialog__header">
          <HStack gap={4} align="center" justify="center" aria-hidden="true">
            <span className="integration-connect-dialog__brand"><LotusLogo size={48} /></span>
            <MoreHorizontal className="integration-connect-dialog__dots" />
            <span className="integration-connect-dialog__brand integration-connect-dialog__service"><BrandLogo connector={connector.key} name={connector.name} iconPath={connector.iconPath} /></span>
          </HStack>
          <VStack gap={2} className="integration-connect-dialog__heading">
            <DialogTitle className="integration-connect-dialog__title">Connect {connector.name}</DialogTitle>
            <DialogDescription className="integration-connect-dialog__summary">{connector.summary}</DialogDescription>
          </VStack>
          <p className={`integration-connect-dialog__status${ready ? ' integration-connect-dialog__status--ready' : ''}`} role="status"><StatusIcon aria-hidden="true" />{ready ? 'Ready to connect' : configured ? 'Not available yet' : 'Connection status unavailable'}</p>
        </VStack>
        <VStack gap={0} className="integration-connect-dialog__information">
          {connectionInformation(connector).map(section => <section key={section.key} className="integration-connect-dialog__section">
            <h3>{section.title}</h3><p>{section.description}{section.link && <> <Link href={section.link.href} target="_blank" rel="noopener noreferrer">{section.link.label}</Link></>}</p>
            {section.capabilities && section.capabilities.length > 0 && <ul>{section.capabilities.map(capability => <li key={capability.key}>{capability.title}{capability.requiresApproval ? ' — requires your approval' : ''}</li>)}</ul>}
          </section>)}
        </VStack>
        {error && <p role="alert" className="rounded-lg bg-muted p-4 text-sm text-foreground">{error}</p>}
        {!ready && <p className="text-sm text-muted-foreground">This integration isn’t ready to connect yet. Refresh or contact support.</p>}
        <button type="button" className="integration-connect-dialog__continue" aria-label={connector.auth === 'mcp-remote' ? 'Set up plugin' : `Continue to ${connector.name}`} disabled={busy || !ready} onClick={() => { void onConnect(connector) }}>
          {busy ? 'Connecting…' : connector.auth === 'mcp-remote' ? 'Set up plugin' : `Continue to ${connector.name}`}
          {!busy && connector.auth !== 'mcp-remote' && <ArrowUpRight aria-hidden="true" />}
        </button>
      </>}
    </DialogContent>
  </Dialog>
}
