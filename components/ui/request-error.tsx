"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Banner } from '@astryxdesign/core/Banner'
import { AlertCircle, CircleAlert, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { presentRequestError } from '@/lib/backend/error-presentation'
import styles from './request-error.module.css'

export function RequestError({ error, planName, children, announce = true }: { error: Error; planName?: string; children?: ReactNode; announce?: boolean }) {
  const message = presentRequestError(error, planName)
  return (
    <div data-astryx-theme="neutral" className={styles.theme}>
      <Banner
        status={message.isQuota ? 'warning' : 'error'}
        role={announce ? 'alert' : undefined}
        title={message.title}
        icon={message.isQuota ? <CircleAlert size={20} /> : <AlertCircle size={20} />}
        description={<div className={styles.description}>
          <p>{message.description}</p>
          {message.quota && <dl className={styles.usage}>
            <div><dt>Used</dt><dd>{message.quota.consumed.toLocaleString()}</dd></div>
            <div><dt>Reserved</dt><dd>{message.quota.reserved.toLocaleString()}</dd></div>
            <div><dt>Plan limit</dt><dd>{message.quota.limit.toLocaleString()}</dd></div>
          </dl>}
          {message.quota && message.quota.reserved > 0 && <p className={styles.note}>Reserved usage is held for work in progress.</p>}
        </div>}
        collapsible={false}
        className={styles.banner}
      >
        {(message.isQuota || children) && <div className={styles.actions}>
          {message.isQuota && <Link href="/pricing" className={styles.primary}>View plans</Link>}
          {children}
        </div>}
      </Banner>
    </div>
  )
}

export function RequestErrorDialog({ error, planName, onClose, restoreFocus, children }: {
  error: Error | null; planName?: string; onClose: () => void; restoreFocus?: () => void; children?: ReactNode
}) {
  return <Dialog open={error !== null} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogContent showCloseButton={false} className={styles.dialog} onCloseAutoFocus={(event) => {
      if (restoreFocus) { event.preventDefault(); restoreFocus() }
    }}>
      <DialogTitle className="sr-only">{error ? presentRequestError(error).title : 'Request error'}</DialogTitle>
      <DialogDescription className="sr-only">Review the request details below. Close this notice to return to your prompt.</DialogDescription>
      {error && <RequestError error={error} planName={planName} announce={false}>{children}</RequestError>}
      <DialogClose asChild><button type="button" aria-label="Close request notice" className={styles.close}><X size={18} aria-hidden /></button></DialogClose>
    </DialogContent>
  </Dialog>
}
