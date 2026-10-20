"use client"

import { Check, X } from "lucide-react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"

type VoiceWaveformProps = {
  levels: number[]
  transcript: string
  onCancel: () => void
  onDone: () => void
  className?: string
}

/** Codex-style recording state: live bars from the microphone, the words so far, and Cancel/Done. */
export function VoiceWaveform({ levels, transcript, onCancel, onDone, className }: VoiceWaveformProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} role="status" aria-live="polite" aria-label="Recording voice prompt">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel recording"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[3px]" aria-hidden>
          {levels.map((level, index) => (
            <span
              key={index}
              className="w-[3px] rounded-full bg-foreground transition-[height] duration-75 ease-out motion-reduce:transition-none"
              style={{ height: `${Math.max(12, Math.round(12 + level * 88))}%`, opacity: 0.45 + level * 0.55 }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onDone}
          aria-label="Use this recording"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
      {transcript
        ? <p className="line-clamp-3 text-[15px] leading-[1.55] text-foreground">{transcript}</p>
        : <Shimmer as="p" className="text-sm font-medium">Listening…</Shimmer>}
    </div>
  )
}
