"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ShimmerProps<T extends React.ElementType = "span"> = {
  as?: T
  children: React.ReactNode
  className?: string
  duration?: number
  spread?: number
  style?: React.CSSProperties
} & Omit<
  React.ComponentPropsWithoutRef<T>,
  "as" | "children" | "className" | "style"
>

function getTextLength(children: React.ReactNode): number {
  if (typeof children === "string" || typeof children === "number") {
    return String(children).length
  }

  if (Array.isArray(children)) {
    return children.reduce((length, child) => length + getTextLength(child), 0)
  }

  return 24
}

export function Shimmer<T extends React.ElementType = "span">({
  as,
  children,
  className,
  duration = 2,
  spread = 2,
  style,
  ...props
}: ShimmerProps<T>) {
  const Component = as ?? "span"
  const shimmerSpread = Math.max(12, getTextLength(children) * spread)

  return (
    <Component
      className={cn(
        "inline-block animate-shimmer bg-clip-text",
        "bg-gradient-to-r from-foreground/40 from-[34%] via-foreground via-[50%] to-foreground/40 to-[66%]",
        className,
        "text-transparent"
      )}
      style={{
        ...style,
        backgroundSize: `calc(100% + ${shimmerSpread}px) 100%`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}
