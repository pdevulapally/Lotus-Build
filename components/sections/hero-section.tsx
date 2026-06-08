"use client"

import { Leaf } from "lucide-react"
import { motion, cubicBezier } from "motion/react"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { PromptSuggestion } from "@/components/prompt-kit/prompt-suggestion"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: cubicBezier(0.22, 1, 0.36, 1) },
  },
}

const suggestions = [
  "Build a SaaS landing page",
  "Task management app",
  "E-commerce store",
  "Blog with markdown",
]

export function HeroSection() {
  const handleSuggestionClick = (suggestion: string) => {
    setTimeout(() => {
      const textarea = document.querySelector(
        "#ai-input-hero"
      ) as HTMLTextAreaElement
      if (textarea) {
        textarea.value = suggestion
        textarea.focus()
        const event = new Event("input", { bubbles: true })
        textarea.dispatchEvent(event)
      }
    }, 100)
  }

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
      {/* ── Background layers ── */}

      {/* ── Animated ambient orbs ── */}

      {/* ── Main card ── */}
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-10 shadow-[0_24px_90px_-68px_var(--primary)] sm:rounded-3xl sm:px-10 sm:py-14 lg:px-16 lg:py-20"
        >
          {/* Inner highlight border */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-px rounded-[inherit] ring-1 ring-inset ring-primary-foreground/40"
          />

          {/* Subtle top‑edge shine */}

          {/* ── Content ── */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center"
          >
            {/* Badge */}
            <motion.div variants={item}>
              <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 shadow-sm">
                <Leaf className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium tracking-wide text-muted-foreground sm:text-sm">
                  AI powered full-stack application builder
                </span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={item}
              className="mb-5 mt-2 font-display text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            >
              <span className="block text-foreground">Describe your idea.</span>
              <span className="mt-1 block text-muted-foreground sm:mt-2">
                We build it.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={item}
              className="mb-10 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:max-w-2xl sm:text-base md:text-lg lg:text-xl"
            >
              Turn your ideas into full-stack web applications with AI. Just
              describe what you want to build and watch your app come to life in
              seconds.
            </motion.p>

            {/* Input */}
            <motion.div variants={item} className="flex w-full justify-center">
              <AnimatedAIInput />
            </motion.div>

            {/* Suggestions */}
            <motion.div variants={item} className="mt-5 w-full sm:mt-6">
              <div className="scrollbar-hidden -mx-1 flex flex-row flex-nowrap items-center justify-start gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-center">
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.7 + index * 0.08,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="shrink-0"
                  >
                    <PromptSuggestion
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </PromptSuggestion>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}


