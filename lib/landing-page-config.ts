export const landingCapabilities = [
  "Live sandbox preview",
  "Production React",
  "Guided edits",
  "Team workspaces",
] as const

export const landingWorkflowSteps = [
  {
    step: "01",
    title: "Describe it",
    description: "Start with a sentence about the product, page, or flow you want.",
  },
  {
    step: "02",
    title: "Generate",
    description: "Lotus builds structure, copy, and code in one pass.",
  },
  {
    step: "03",
    title: "Preview live",
    description: "Open a real sandbox and see the product as it runs.",
  },
  {
    step: "04",
    title: "Keep refining",
    description: "Edit in plain language without losing context.",
  },
] as const

export const landingWorkspaceLines = [
  { role: "you" as const, text: "Build a launch page for a finance app — sharp, premium, mobile-first." },
  { role: "lotus" as const, text: "Generating layout, copy, and React code…" },
  { role: "lotus" as const, text: "Preview ready. Hero, pricing, and onboarding flow included." },
] as const

export const landingPreviewBlocks = [
  { width: "w-3/5", height: "h-3" },
  { width: "w-full", height: "h-20" },
  { width: "w-4/5", height: "h-2.5" },
  { width: "w-full", height: "h-28" },
] as const

export const landingEditHint = "Make the hero feel sharper and more premium."

export const landingCodeLines = [
  { name: "page.tsx", active: true },
  { name: "layout.tsx", active: false },
  { name: "globals.css", active: false },
] as const

export const landingEditResults = ["Copy updated", "Layout preserved", "Preview synced"] as const
