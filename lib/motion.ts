import type { Variants } from "framer-motion"

export const ease = [0.22, 1, 0.36, 1] as const
export const duration = { fast: 0.16, base: 0.24, slow: 0.4 } as const
export const spring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const
export const softSpring = { type: "spring", stiffness: 260, damping: 32 } as const

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease } },
} satisfies Variants

export const stagger = (step = 0.06, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren } },
}) satisfies Variants
