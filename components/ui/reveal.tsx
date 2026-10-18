"use client"

import { useMemo, type ComponentType, type HTMLAttributes, type ReactNode } from "react"
import { motion, type MotionProps } from "framer-motion"
import { duration, ease, fadeUp, stagger } from "@/lib/motion"

type MotionElementProps = Omit<HTMLAttributes<HTMLElement>, keyof MotionProps> & MotionProps & {
  children?: ReactNode
  type?: string
}

type MotionElement = ComponentType<MotionElementProps>
type ElementProps = Omit<HTMLAttributes<HTMLElement>, keyof MotionProps> & {
  as?: string
  children?: ReactNode
  type?: string
}

function useMotionElement(as: string): MotionElement {
  return useMemo(() => motion.create(as) as MotionElement, [as])
}

type RevealProps = ElementProps & {
  delay?: number
}

export function Reveal({ children, className, delay = 0, as = "div", ...props }: RevealProps) {
  const MotionElement = useMotionElement(as)

  return (
    <MotionElement
      {...props}
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: duration.slow, ease, delay }}
    >
      {children}
    </MotionElement>
  )
}

type RevealGroupProps = ElementProps & {
  animateOnMount?: boolean
  delayChildren?: number
  step?: number
}

export function RevealGroup({
  children,
  className,
  as = "div",
  animateOnMount = false,
  delayChildren = 0,
  step = 0.06,
  ...props
}: RevealGroupProps) {
  const MotionElement = useMotionElement(as)

  return (
    <MotionElement
      {...props}
      className={className}
      variants={stagger(step, delayChildren)}
      initial="hidden"
      animate={animateOnMount ? "show" : undefined}
      whileInView={animateOnMount ? undefined : "show"}
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </MotionElement>
  )
}

type RevealItemProps = ElementProps

export function RevealItem({ children, className, as = "div", ...props }: RevealItemProps) {
  const MotionElement = useMotionElement(as)

  return (
    <MotionElement {...props} className={className} variants={fadeUp}>
      {children}
    </MotionElement>
  )
}
