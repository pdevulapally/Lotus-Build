"use client"

import React from "react"

import { Shimmer } from "@/components/ai-elements/shimmer"

interface TextShimmerProps {
  children: React.ReactNode
  className?: string
  duration?: number
  spread?: number
}

export function TextShimmer({
  children,
  className,
  duration = 3.5,
  spread,
}: TextShimmerProps) {
  return (
    <Shimmer className={className} duration={duration} spread={spread}>
      {children}
    </Shimmer>
  )
}
