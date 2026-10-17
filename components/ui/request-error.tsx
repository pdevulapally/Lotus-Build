"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Banner } from '@astryxdesign/core/Banner'
import { AlertCircle, CircleAlert, X } from 'lucide-react'
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

export function RequestErrorNotice({ error, planName, onClose, restoreFocus, children }: {
  error: Error | null; planName?: string; onClose: () => void; restoreFocus?: () => void; children?: ReactNode
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!error || !host) return null
  const dismiss = () => { onClose(); restoreFocus?.() }
  return createPortal(<aside aria-label="Request notification" className={styles.notice} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); dismiss() }
  }}>
    <RequestError error={error} planName={planName}>{children}</RequestError>
    <button type="button" aria-label="Dismiss request notification" className={styles.close} onClick={dismiss}><X size={18} aria-hidden /></button>
  </aside>, host)
}
