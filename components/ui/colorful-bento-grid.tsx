import Link from "next/link"

import { cn } from "@/lib/utils"

type BentoCard = {
  href: string
  eyebrow: string
  title: string
  description: string
  className?: string
  preview: "timeline" | "code" | "browser" | "deploy"
}

const cards: BentoCard[] = [
  {
    href: "/login",
    eyebrow: "From prompt to working surface",
    title: "Build the first version",
    description: "Describe the product you want. Lotus turns it into a real project with code, structure, and a live preview.",
    className: "md:col-span-2 bg-primary text-primary-foreground",
    preview: "timeline",
  },
  {
    href: "/#features",
    eyebrow: "Edit what you see",
    title: "Refine live",
    description: "Change copy, layout, and details while the preview stays connected to the project.",
    className: "bg-slate-soft text-foreground",
    preview: "browser",
  },
  {
    href: "/teams",
    eyebrow: "For client and team work",
    title: "Share the workspace",
    description: "Keep founders, collaborators, and project context in one focused build environment.",
    className: "bg-secondary text-foreground",
    preview: "code",
  },
  {
    href: "/pricing",
    eyebrow: "Ready when it feels right",
    title: "Launch faster",
    description: "Move from rough idea to polished product surface without waiting on a traditional handoff.",
    className: "bg-card text-foreground",
    preview: "deploy",
  },
]

const workflowSteps = ["Prompt", "Generate", "Preview", "Refine"]
const codePreviewLines = ["project.tsx", "preview ready", "team access"]
const editPreviewResults = ["Copy updated", "Layout preserved", "Preview synced"]
const launchPreviewItems = ["Preview checked", "Code packaged", "Ready to publish"]

function CardPreview({ type }: { type: BentoCard["preview"] }) {
  if (type === "timeline") {
    return (
      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-primary-foreground/15 sm:grid-cols-4">
        {workflowSteps.map((step, index) => (
          <div key={step} className="bg-primary px-4 py-4">
            <span className="text-[11px] tabular-nums text-primary-foreground/45">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="mt-8 text-sm font-medium text-primary-foreground">{step}</p>
          </div>
        ))}
      </div>
    )
  }

  if (type === "code") {
    return (
      <div className="mt-auto w-full rounded-2xl border border-border/70 bg-background/75 p-3 text-left">
        {codePreviewLines.map((line, index) => (
          <div key={line} className="grid grid-cols-[44px_1fr] border-b border-border/60 py-2 last:border-0">
            <span className="text-[11px] tabular-nums text-muted-foreground/60">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs text-muted-foreground">{line}</span>
          </div>
        ))}
      </div>
    )
  }

  if (type === "browser") {
    return (
      <div className="mt-auto w-full rounded-2xl bg-card/85 p-3 text-left shadow-[0_18px_50px_-42px_var(--primary)]">
        <div className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-foreground/55">
              Selected section
            </span>
            <span className="text-xs text-primary-foreground/65">Hero</span>
          </div>
          <p className="mt-5 text-sm font-medium leading-5">
            “Make this feel sharper and more premium.”
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {editPreviewResults.map((result, index) => (
            <div
              key={result}
              className="flex items-center justify-between rounded-xl bg-background/80 px-3 py-2 text-xs"
            >
              <span className="font-medium text-foreground">{result}</span>
              <span className="tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-auto w-full rounded-2xl bg-secondary/70 p-3 text-left">
      <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-medium text-foreground">
        <span>Launch-ready</span>
        <span className="text-xs tabular-nums text-muted-foreground">04</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {launchPreviewItems.map((item) => (
          <div key={item} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">{item}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ColorfulBentoGrid() {
  return (
    <section className="mx-auto max-w-6xl">
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
        <p>Guided refinements</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <Link
            key={card.title}
            href={card.href}
            className={cn(
              "group relative flex min-h-[340px] flex-col overflow-hidden rounded-3xl border border-border p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong",
              card.className
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className={cn(
                    "mb-5 text-[11px] font-medium uppercase tracking-[0.16em]",
                    index === 0 ? "text-primary-foreground/55" : "text-muted-foreground"
                  )}
                >
                  {card.eyebrow}
                </p>
                <h3
                  className={cn(
                    "max-w-sm text-3xl font-medium leading-[1.02] tracking-[-0.055em]",
                    index === 0 ? "text-primary-foreground sm:text-5xl" : "text-foreground"
                  )}
                >
                  {card.title}
                </h3>
              </div>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  index === 0 ? "text-primary-foreground/45" : "text-muted-foreground/60"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <p
              className={cn(
                "mt-5 max-w-md text-sm leading-6",
                index === 0 ? "text-primary-foreground/65" : "text-muted-foreground"
              )}
            >
              {card.description}
            </p>

            <CardPreview type={card.preview} />
          </Link>
        ))}
      </div>
    </section>
  )
}

export const Component = ColorfulBentoGrid
