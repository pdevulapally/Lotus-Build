import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Settings actions share one pill shape and a comfortable 44px target. */
export const SettingsButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => <Button ref={ref} {...props} className={cn('min-h-11 min-w-11 rounded-full', className)} />,
)
SettingsButton.displayName = 'SettingsButton'
