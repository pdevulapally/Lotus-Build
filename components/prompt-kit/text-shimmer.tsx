"use client"

import React from "react"

import { cn } from "@/lib/utils"

interface TextShimmerProps {
  children: React.ReactNode
  className?: string
  duration?: number
}

export function TextShimmer({
  children,
  className,
  duration = 3.5,
}: TextShimmerProps) {
  return (
    <span
      className={cn(
        "inline-block animate-shimmer bg-[length:300%_100%] bg-clip-text text-transparent",
        "bg-gradient-to-r from-foreground/40 from-[35%] via-foreground via-[50%] to-foreground/40 to-[65%]",
        className
      )}
      style={{
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </span>
  )
}
