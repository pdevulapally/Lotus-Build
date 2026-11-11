'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { SideNav, SideNavItem } from '@astryxdesign/core/SideNav'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { ChartBarIcon, CircleStackIcon, CreditCardIcon, PuzzlePieceIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import styles from './settings-dialog.module.css'

// One registry drives desktop and mobile navigation.
const sections = [
  { id: 'account', label: 'Account', title: 'Account', description: 'Your profile, privacy and account details.', icon: UserCircleIcon },
  { id: 'billing', label: 'Billing', title: 'Plan & billing', description: 'Your subscription, payment details and invoices.', icon: CreditCardIcon },
  { id: 'usage', label: 'Usage', title: 'Usage', description: 'Your plan allowance and when it resets.', icon: ChartBarIcon },
  { id: 'on-demand', label: 'Credits', title: 'Credits & top-ups', description: 'View your credit balance and buy extra AI usage.', icon: CircleStackIcon },
  { id: 'plugins', label: 'Plugins', title: 'Plugins', description: 'Connected tools, permissions and project access.', icon: PuzzlePieceIcon },
] as const

export type SettingsPage = typeof sections[number]['id']

export function SettingsShell({ open, onOpenChange, page, onPageChange, onRestoreFocus, busy, footer, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: SettingsPage
  onPageChange: (page: SettingsPage) => void
  onRestoreFocus?: () => void
  busy: boolean
  footer: ReactNode
  children: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const contentId = useId()
  const activeSection = sections.find(section => section.id === page)!
  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }) }, [page])

  const navigation = sections.map(({ id, label, icon }) => <SideNavItem key={id} label={label} size="lg"
    icon={<Icon icon={icon} size="sm" color="primary" />} isSelected={page === id}
    aria-controls={contentId} onClick={() => onPageChange(id)} />)

  // Keep the shared modal boundary: Cookie preferences uses a Radix portal,
  // which would sit behind Astryx's native top-layer dialog. The composition
  // inside follows the Astryx settings-dialog template.
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className={`${styles.dialog} settings-theme my-0 flex w-full max-w-full flex-col gap-0 overflow-hidden border-border bg-card p-0 text-foreground`}
      onCloseAutoFocus={onRestoreFocus ? event => { event.preventDefault(); onRestoreFocus() } : undefined}>
      <DialogTitle className="sr-only">Settings</DialogTitle>
      <DialogDescription className="sr-only">Manage your LotusBuild account, billing, usage, credits and plugins.</DialogDescription>
      <VStack className={styles.shell} gap={0}>
        <VStack className={styles.mobileHeader} gap={2} padding={3}>
          <HStack justify="between" align="center">
            <Heading level={4}>Settings</Heading>
            <IconButton label="Close settings" tooltip="Close settings" variant="ghost" icon={<Icon icon="close" size="sm" />} onClick={() => onOpenChange(false)} />
          </HStack>
          <HStack as="nav" aria-label="Settings sections" gap={2} isScrollable>
            {sections.map(({ id, label }) => <Button key={id} label={label} size="sm" variant={id === page ? 'secondary' : 'ghost'}
              aria-current={id === page ? 'page' : undefined} aria-controls={contentId} onClick={() => onPageChange(id)} />)}
          </HStack>
        </VStack>
        <Layout className={styles.layout} start={<SideNav className={styles.sidebar} aria-label="Settings sections"
          header={<HStack paddingInline={2} paddingBlock={2}><Heading level={4}>Settings</Heading></HStack>}>
          <VStack gap={2} paddingBlock={2}>{navigation}</VStack>
        </SideNav>}
          content={<VStack height="100%" gap={0}>
            <LayoutContent ref={contentRef} id={contentId} role="region" aria-labelledby={titleId} aria-busy={busy} isScrollable padding={4}>
              <VStack className={styles.panel} gap={4}>
                <HStack align="start" justify="between" gap={3}>
                  <VStack gap={1}>
                    <Heading level={3} id={titleId}>{activeSection.title}</Heading>
                    <Text type="supporting" color="secondary">{activeSection.description}</Text>
                  </VStack>
                  <IconButton className={styles.desktopClose} label="Close settings" tooltip="Close settings" variant="ghost"
                    icon={<Icon icon="close" size="sm" />} onClick={() => onOpenChange(false)} />
                </HStack>
                {children}
              </VStack>
            </LayoutContent>
            {footer}
          </VStack>} />
      </VStack>
    </DialogContent>
  </Dialog>
}
