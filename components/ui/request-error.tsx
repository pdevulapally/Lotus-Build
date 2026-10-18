"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Banner } from '@astryxdesign/core/Banner'
import { AlertCircle, FolderOpen, Gauge, X } from 'lucide-react'
import { presentRequestError } from '@/lib/backend/error-presentation'
import styles from './request-error.module.css'

export function RequestError({ error, planName, children, announce = true, onManageProjects }: { error: Error; planName?: string; children?: ReactNode; announce?: boolean; onManageProjects?: () => void }) {
  const message = presentRequestError(error, planName)
  const quota = message.quota
  const used = quota ? quota.consumed + quota.reserved : 0
  const consumedWidth = quota && quota.limit > 0 ? Math.min(100, quota.consumed / quota.limit * 100) : 0
  const reservedWidth = quota && quota.limit > 0 ? Math.min(100 - consumedWidth, quota.reserved / quota.limit * 100) : 0
  return (
    <div data-astryx-theme="neutral" className={styles.theme}>
      <Banner
        status={message.isQuota || message.isProjectLimit ? 'info' : 'error'}
        role={announce ? 'alert' : undefined}
        title={<div className={styles.heading}><span>{message.title}</span>{message.isQuota && planName && <span className={styles.plan}>{planName}</span>}</div>}
        icon={message.isProjectLimit ? <FolderOpen size={21} strokeWidth={1.7} /> : message.isQuota ? <Gauge size={21} strokeWidth={1.7} /> : <AlertCircle size={21} strokeWidth={1.7} />}
        collapsible={false}
        className={`${styles.banner} ${message.isProjectLimit ? styles.projectLimit : ''}`}
      >
        <div className={styles.body}>
          <p className={styles.description}>{message.description}</p>
          {quota && <div className={styles.usage}>
            <div className={styles.usageHeading}><span>{quota.label}</span><span className={styles.amount}><strong>{used.toLocaleString()}</strong><span> / {quota.limit.toLocaleString()}</span></span></div>
            <div className={styles.track} aria-hidden="true"><span className={styles.consumed} style={{ width: `${consumedWidth}%` }} /><span className={styles.reserved} style={{ width: `${reservedWidth}%` }} /></div>
            <dl className={styles.legend}>
              <div><dt><span className={styles.usedDot} aria-hidden />Used</dt><dd>{quota.consumed.toLocaleString()}</dd></div>
              <div><dt><span className={styles.reservedDot} aria-hidden />Reserved</dt><dd>{quota.reserved.toLocaleString()}</dd></div>
            </dl>
            {quota.reserved > 0 && <p className={styles.note}>Reserved usage is held for work in progress.</p>}
          </div>}
          {(message.isQuota || message.isProjectLimit || children) && <div className={styles.actions}>
            {(message.isQuota || message.isProjectLimit) && <Link href="/pricing" className={styles.primary}>View plans</Link>}
            {message.isProjectLimit && <Link href="/" onClick={onManageProjects} className={styles.secondary}>Manage projects</Link>}
            {!message.isProjectLimit && children}
          </div>}
        </div>
      </Banner>
    </div>
  )
}

export function RequestErrorNotice({ error, planName, onClose, restoreFocus, onManageProjects, children }: {
  error: Error | null; planName?: string; onClose: () => void; restoreFocus?: () => void; onManageProjects?: () => void; children?: ReactNode
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!error) return null
  const dismiss = () => { onClose(); restoreFocus?.() }
  if (presentRequestError(error).isProjectLimit) return <section aria-label="Project limit" className={styles.inlineLimit}>
    <RequestError error={error} planName={planName} onManageProjects={() => { onClose(); onManageProjects?.() }} />
    <button type="button" aria-label="Dismiss project limit message" className={styles.close} onClick={dismiss}><X size={18} aria-hidden /></button>
  </section>
  if (!host) return null
  return createPortal(<aside aria-label="Request notification" className={styles.notice} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.stopPropagation(); dismiss() }
  }}>
    <RequestError error={error} planName={planName} onManageProjects={() => { onClose(); onManageProjects?.() }}>{children}</RequestError>
    <button type="button" aria-label="Dismiss request notification" className={styles.close} onClick={dismiss}><X size={18} aria-hidden /></button>
  </aside>, host)
}
