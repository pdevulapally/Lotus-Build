"use client"

import type { ReactNode } from "react"
import { MotionConfig } from "framer-motion"
import { duration, ease } from "@/lib/motion"

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: duration.base, ease }}>
      {children}
    </MotionConfig>
  )
}
