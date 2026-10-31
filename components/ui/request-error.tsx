"use client"

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { presentRequestError } from '@/lib/backend/error-presentation'
import { CloseIcon, FilesIcon, NoticeIcon, UsageIcon } from '@/components/ui/lotus-icons'
import styles from './request-error.module.css'

export function RequestError({ error, planName, children, announce = true, onManageProjects }: { error: Error; planName?: string; children?: ReactNode; announce?: boolean; onManageProjects?: () => void }) {
  const message = presentRequestError(error, planName)
  const Icon = message.isProjectLimit ? FilesIcon : message.isQuota ? UsageIcon : NoticeIcon
  return (
    <article role={announce ? 'alert' : undefined} className={styles.card} data-kind={message.isProjectLimit ? 'project-limit' : message.isQuota ? 'quota' : 'error'}>
      <Icon className={styles.icon} />
      <h2 className={styles.title}>{message.title}</h2>
      <p className={styles.description}>{message.description}</p>
      {(message.isQuota || message.isProjectLimit || children) && <div className={styles.actions}>
        {(message.isQuota || message.isProjectLimit) && <Link href="/pricing" className={styles.primary}>View plans</Link>}
        {message.isProjectLimit && <Link href="/" onClick={onManageProjects} className={styles.secondary}>Manage projects</Link>}
        {!message.isProjectLimit && children}
      </div>}
    </article>
  )
}

export function RequestErrorNotice({ error, planName, onClose, restoreFocus, onManageProjects, children }: {
  error: Error | null; planName?: string; onClose: () => void; restoreFocus?: () => void; onManageProjects?: () => void; children?: ReactNode
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  // Portal into the nearest themed ancestor so a forced-dark workspace keeps its palette.
  useEffect(() => { setHost((anchor.current?.closest<HTMLElement>('.dark, .light, [data-theme]')) ?? document.body) }, [])
  if (!error) return <span ref={anchor} hidden />
  const dismiss = () => { onClose(); restoreFocus?.() }
  if (presentRequestError(error).isProjectLimit) return <section aria-label="Project limit" className={styles.inlineLimit}>
    <RequestError error={error} planName={planName} onManageProjects={() => { onClose(); onManageProjects?.() }} />
    <button type="button" aria-label="Dismiss project limit message" className={styles.close} onClick={dismiss}><CloseIcon className={styles.closeIcon} /></button>
  </section>
  if (!host) return <span ref={anchor} hidden />
  return <>
    <span ref={anchor} hidden />
    {createPortal(<motion.aside aria-label="Request notification" className={styles.notice}
    initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); dismiss() } }}>
    <RequestError error={error} planName={planName} onManageProjects={() => { onClose(); onManageProjects?.() }}>{children}</RequestError>
    <button type="button" aria-label="Dismiss request notification" className={styles.close} onClick={dismiss}><CloseIcon className={styles.closeIcon} /></button>
  </motion.aside>, host)}
  </>
}
