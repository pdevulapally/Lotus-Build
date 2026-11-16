import type { ReactNode } from 'react'
import { ToastViewport } from '@astryxdesign/core/Toast'

export default function ComputerLayout({ children }: { children: ReactNode }) {
  return <ToastViewport position="bottomEnd" maxVisible={3}>{children}</ToastViewport>
}
