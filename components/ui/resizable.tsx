'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type Orientation,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels'

import { cn } from '@/lib/utils'

const ResizablePanelGroupContext = React.createContext<Orientation>('horizontal')

function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: GroupProps & { direction?: Orientation }) {
  const resolvedOrientation = orientation ?? direction ?? 'horizontal'

  return (
    <ResizablePanelGroupContext.Provider value={resolvedOrientation}>
      <Group
        data-slot="resizable-panel-group"
        orientation={resolvedOrientation}
        className={cn(
          'flex h-full w-full',
          resolvedOrientation === 'vertical' && 'flex-col',
          className,
        )}
        {...props}
      />
    </ResizablePanelGroupContext.Provider>
  )
}

function ResizablePanel({
  ...props
}: PanelProps) {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & {
  withHandle?: boolean
}) {
  const orientation = React.useContext(ResizablePanelGroupContext)

  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative flex items-center justify-center focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        orientation === 'vertical'
          ? 'h-px w-full after:absolute after:left-0 after:h-1 after:w-full after:-translate-y-1/2 [&>div]:rotate-90'
          : 'w-px after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
