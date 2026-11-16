'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@astryxdesign/core/Toast'
import { HStack } from '@astryxdesign/core/HStack'
import { TaskNotice, TaskNoticeActions, type TaskNoticeProps } from './task-notice'

/** Task errors belong in bottom notifications; a paused task keeps its controls. */
export function TaskFeedback(props: TaskNoticeProps) {
  const { notice } = props
  if (notice?.kind === 'error' || notice?.failure) return <TaskErrorNotification {...props} />
  return <TaskNotice {...props} />
}

export function TaskErrorNotification(props: TaskNoticeProps) {
  const showToast = useToast()
  const latest = useRef(props)
  latest.current = props
  const { title, description, failure } = props.notice ?? {}

  useEffect(() => {
    if (!title) return
    const current = latest.current
    return showToast({
      type: 'error',
      body: description ? `${title}. ${description}` : title,
      isAutoHide: false,
      uniqueID: 'computer-task-error',
      endContent: current.notice?.actions.length ? <HStack gap={2} wrap="wrap"><TaskNoticeActions {...current} /></HStack> : undefined,
    })
  }, [showToast, title, description, failure?.execution, failure?.message, props.busy])

  return null
}
