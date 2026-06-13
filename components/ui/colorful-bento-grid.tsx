import Link from "next/link"
import type { ComponentType } from "react"
import { ArrowRight, Code2, Eye, Gauge, PenLine, Rocket, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

type BentoCard = {
  href: string
  eyebrow: string
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  className?: string
  titleClassName?: string
  preview: "timeline" | "code" | "browser" | "deploy"
}

const cards: BentoCard[] = [
  {
    href: "/login",
    eyebrow: "From prompt to working surface",
    title: "Build the first version",
    description: "Describe the product you want. Lotus turns it into a real project with code, structure, and a live preview.",
    icon: Sparkles,
    className: "md:col-span-2 bg-accent-soft",
    titleClassName: "bg-accent text-accent-foreground",
    preview: "timeline",
  },
  {
    href: "/#features",
    eyebrow: "Context-aware edits",
    title: "Refine live",
    description: "Ask for changes in plain language while Lotus keeps the preview and files together.",
    icon: PenLine,
    className: "bg-slate-soft",
    titleClassName: "bg-primary text-primary-foreground",
    preview: "browser",
  },
  {
    href: "/teams",
    eyebrow: "For client and team work",
    title: "Share the workspace",
    description: "Keep founders, collaborators, and project context in one focused build environment.",
    icon: Eye,
    className: "bg-secondary",
    titleClassName: "bg-card text-foreground",
    preview: "code",
  },
  {
    href: "/pricing",
    eyebrow: "Ready when it feels right",
    title: "Launch faster",
    description: "Move from rough idea to polished product surface without waiting on a traditional handoff.",
    icon: Rocket,
    className: "bg-card",
    titleClassName: "bg-primary text-primary-foreground",
    preview: "deploy",
  },
]

const workflowSteps = ["Prompt", "Generate", "Preview", "Refine"]

function CardPreview({ type }: { type: BentoCard["preview"] }) {
  if (type === "timeline") {
    return (
      <div className="mt-10 grid gap-2 sm:grid-cols-4">
        {workflowSteps.map((step, index) => (
          <div key={step} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-7 text-sm font-medium text-foreground">{step}</p>
          </div>
        ))}
      </div>
    )
  }

  if (type === "code") {
    return (
      <div className="mt-auto w-full rounded-2xl border border-border/70 bg-background/75 p-3 text-left">
        {["project.tsx", "preview ready", "team access"].map((line) => (
          <div key={line} className="flex items-center gap-2 border-b border-border/60 py-2 last:border-0">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{line}</span>
          </div>
        ))}
      </div>
    )
  }

  if (type === "browser") {
    return (
      <div className="mt-auto w-full rounded-2xl border border-border/70 bg-background/75 p-3">
        <div className="mb-3 flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          <span className="h-2 w-2 rounded-full bg-border-strong" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-2/3 rounded-full bg-muted" />
          <div className="h-3 w-full rounded-full bg-muted" />
          <div className="h-16 rounded-xl border border-border bg-card" />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-auto flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Gauge className="h-4 w-4 text-accent" />
        Launch-ready
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </div>
  )
}

export function ColorfulBentoGrid() {
  return (
    <section className="mx-auto max-w-6xl rounded-[2rem] border border-border bg-card p-4 sm:p-6">
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
            Features
          </p>
          <h2 className="text-4xl font-semibold leading-[1em] tracking-[-0.05em] text-foreground md:text-5xl">
            Build like you have a senior product team in the room.
          </h2>
        </div>
        <p className="max-w-sm text-sm font-medium leading-6 text-muted-foreground">
          Lotus keeps prompting, generation, preview, edits, and launch in one calm workspace.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-accent-soft-foreground">
        <p>Live sandbox preview</p>
        <p>Production React code</p>
        <p>Context-aware edits</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon

          return (
            <Link
              key={card.title}
              href={card.href}
              className={cn(
                "group relative flex min-h-[330px] flex-col overflow-hidden rounded-3xl border border-border p-5 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong",
                card.className
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={cn("mb-2 text-sm text-muted-foreground", index === 0 ? "-rotate-1" : "rotate-1")}>
                    {card.eyebrow}
                  </p>
                  <h3
                    className={cn(
                      "inline-flex rounded-full px-5 py-2 text-xl font-semibold tracking-[-0.03em]",
                      index % 2 === 0 ? "-rotate-1" : "rotate-1",
                      card.titleClassName
                    )}
                  >
                    {card.title}
                  </h3>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-card/80 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
                {card.description}
              </p>

              <CardPreview type={card.preview} />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export const Component = ColorfulBentoGrid
