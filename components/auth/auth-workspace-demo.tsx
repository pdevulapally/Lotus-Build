"use client"

import { motion } from "framer-motion"
import { AnimatedAIInput } from "@/components/ui/animated-ai-input"
import { TextShimmer } from "@/components/prompt-kit/text-shimmer"

type AuthWorkspaceDemoProps = {
  userMessage: string
  agentMessage: string
  workingLabel?: string
}

export function AuthWorkspaceDemo({
  userMessage,
  agentMessage,
  workingLabel = "Refining layout and typography…",
}: AuthWorkspaceDemoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
      className="max-w-xl rounded-lg bg-background/15 p-3 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div className="overflow-hidden rounded-md border border-primary-foreground/15 bg-card/95 text-foreground shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Builder
          </span>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-medium text-success-soft-foreground">
            Live preview
          </span>
        </div>

        <div className="pointer-events-none min-h-[220px] select-none space-y-4 px-4 py-5">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="flex justify-end"
          >
            <div className="max-w-[88%] rounded-lg bg-muted/60 px-3.5 py-2.5">
              <p className="text-left text-[13px] leading-relaxed text-foreground">{userMessage}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.32 }}
            className="max-w-[92%] space-y-3"
          >
            <p className="text-[13px] leading-relaxed text-foreground/90">{agentMessage}</p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.48 }}
              className="text-[13px] font-medium leading-relaxed"
            >
              <TextShimmer duration={2.8}>{workingLabel}</TextShimmer>
            </motion.p>
          </motion.div>
        </div>

        <div className="pointer-events-none select-none border-t border-border/60 bg-sidebar/80 px-3 py-3">
          <AnimatedAIInput
            mode="chat"
            compact
            compactSize="slim"
            placeholder="Message the agent..."
            wrapperClassName="bg-card border-border/40"
          />
        </div>
      </div>
    </motion.div>
  )
}
