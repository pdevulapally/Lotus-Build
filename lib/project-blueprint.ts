import type {
  BlueprintItemStatus,
  BlueprintSection,
  Message,
  PlanningStatus,
  ProjectBlueprint,
} from "@/lib/projects/types"


export interface GuidedAnswerOption {
  id: string
  label: string
  value: string
}


export interface GuidedAnswerSet {
  key: string
  question: string
  helper: string
  selectionMode: "single" | "multiple"
  options: GuidedAnswerOption[]
  allowsCustomAnswer: boolean
}


export interface PlanningStudioStage {
  step: "define" | "plan"
  planReady: boolean
  blueprintVisible: boolean
  stepIndex: number
  questionsRemaining: number
  composerSubmitLabel: string
  statusLabel: string
  heading: string
  description: string
  reassurance: string
  nextStepLabel: string
  stepItems: Array<{
    key: "define" | "plan" | "build"
    label: string
    state: "current" | "upcoming"
  }>
}


function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim()
}


function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}


function normalizeList(items: string[]) {
  return Array.from(new Set(items.map((item) => tidy(item)).filter(Boolean)))
}


export function getBlueprintItem(blueprint: ProjectBlueprint, key: string) {
  return blueprint.sections.flatMap((section) => section.items).find((item) => item.key === key)
}


function buildOption(id: string, label: string, value = label): GuidedAnswerOption {
  return { id, label, value }
}


export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}


function splitCandidateParts(value: string) {
  return value
    .replace(/\b(?:and|or)\b/gi, ",")
    .split(",")
    .map((part) => tidy(part.replace(/^[\-\u2022]\s*/, "")))
    .filter(Boolean)
}


function cleanCandidate(value: string) {
  return tidy(
    value
      .replace(/^a\s+/i, "")
      .replace(/^an\s+/i, "")
      .replace(/^the\s+/i, "")
      .replace(/\bfor version one\b/gi, "")
      .replace(/\bversion one\b/gi, "")
      .replace(/\bneeds(?: [a-z]+)?\b/gi, "")
      .replace(/\bstill\b/gi, "")
      .replace(/\bconfirmation\b/gi, "")
      .replace(/\bclarified\b/gi, "")
      .replace(/[.:]$/g, "")
  )
}


function normalizeCandidateOptions(values: string[]) {
  return normalizeList(
    values
      .flatMap((value) => splitCandidateParts(value))
      .map(cleanCandidate)
      .filter((value) => value.length > 1)
  )
}


function extractChoicesFromQuestion(question: string) {
  const sources: string[] = []
  const colonMatch = question.match(/:\s*(.+?)(?:\?|$)/)
  if (colonMatch?.[1]) sources.push(colonMatch[1])

  const shouldThisMatch = question.match(/should this be (.+?)(?:\?|$)/i)
  if (shouldThisMatch?.[1]) sources.push(shouldThisMatch[1])

  const whatDirectionMatch = question.match(/should the build follow[: ]+(.+?)(?:\?|$)/i)
  if (whatDirectionMatch?.[1]) sources.push(whatDirectionMatch[1])

  const doYouNeedMatch = question.match(/do you need (.+?)(?:\?|$)/i)
  if (doYouNeedMatch?.[1]) sources.push(doYouNeedMatch[1])

  const provideMatch = question.match(/will you provide (.+?)(?:\?|$)/i)
  if (provideMatch?.[1]) sources.push(provideMatch[1])

  return normalizeCandidateOptions(sources)
}


function extractChoicesFromItemValue(item?: { value: string; status: BlueprintItemStatus }) {
  if (!item || item.status === "unknown") return []
  if (/(not defined|needs|should be confirmed|still open|unknown)/i.test(item.value)) return []
  return normalizeCandidateOptions([item.value])
}


function extractAudienceChoices(prompt: string) {
  const matches = [
    prompt.match(/for ([a-z0-9 ,/&-]+)/i)?.[1],
    prompt.match(/target(?:ing)? ([a-z0-9 ,/&-]+)/i)?.[1],
    prompt.match(/aimed at ([a-z0-9 ,/&-]+)/i)?.[1],
  ].filter(Boolean) as string[]

  return normalizeCandidateOptions(matches)
}


function extractExplicitPages(prompt: string) {
  return normalizeList(
    (prompt.match(/\b(home|about|pricing|contact|blog|faq|dashboard|settings|checkout|login|signup|features|testimonials|onboarding|billing|help)\b/gi) || [])
      .map(titleCase)
  )
}


function deriveGuidedOptions(blueprint: ProjectBlueprint, unresolvedItem: { key: string; value: string; status: BlueprintItemStatus }) {
  const question = blueprint.openQuestions[0] || ""
  const prompt = getBlueprintItem(blueprint, "goal")?.value || blueprint.summary
  const questionChoices = extractChoicesFromQuestion(question)
  const itemChoices = extractChoicesFromItemValue(unresolvedItem)

  if (unresolvedItem.key === "audience") {
    return normalizeList([...questionChoices, ...itemChoices, ...extractAudienceChoices(prompt)])
  }

  if (unresolvedItem.key === "pages") {
    return normalizeList([...itemChoices, ...extractExplicitPages(prompt)])
  }

  return normalizeList([...questionChoices, ...itemChoices])
}


export function getGuidedAnswerSet(blueprint: ProjectBlueprint): GuidedAnswerSet | null {
  const unresolvedItem = blueprint.sections
    .flatMap((section) => section.items)
    .find((item) => item.status === "unknown" || item.status === "suggested")

  if (!unresolvedItem) return null
  const derivedOptions = deriveGuidedOptions(blueprint, unresolvedItem)
  
  // Only return guided options if we have derived options
  if (derivedOptions.length < 2) return null

  const questionText = (blueprint.openQuestions[0] || unresolvedItem.label || "").toLowerCase()
  const optionCount = derivedOptions.length
  const mentionsMultipleIntent =
    /\b(select all|all that apply|which of these|any of these|what pages|which pages|what features|which features|integrations|systems)\b/i.test(
      questionText
    )
  const keyDefaultsToMultiple =
    unresolvedItem.key === "pages" || unresolvedItem.key === "systems" || unresolvedItem.key === "features"

  const selectionMode: "single" | "multiple" =
    keyDefaultsToMultiple || mentionsMultipleIntent || optionCount >= 5
      ? "multiple"
      : "single"

  const helper =
    selectionMode === "multiple"
      ? "Select all that apply, then adjust anything in chat if needed."
      : "Choose the closest option, then adjust it in chat if needed."

  return {
    key: unresolvedItem.key,
    question: blueprint.openQuestions[0] || unresolvedItem.label,
    helper,
    selectionMode,
    options: derivedOptions.map((option) => buildOption(slugify(option), option)),
    allowsCustomAnswer: true,
  }
}


const GUIDED_DRAFT_BUILDERS: Partial<Record<string, (optionLabels: string[]) => string>> = {
  pages: (optionLabels) => `Pages for version one: ${optionLabels.join(", ")}.`,
  systems: (optionLabels) => `For version one, include: ${optionLabels.join(", ")}.`,
  features: (optionLabels) => `For version one, include: ${optionLabels.join(", ")}.`,
  scope: (optionLabels) => `Scope for version one: ${optionLabels.join(", ")}.`,
}


export function buildGuidedAnswerDraft(
  guidedAnswerSet: GuidedAnswerSet | null,
  optionLabels: string[]
) {
  if (!guidedAnswerSet || optionLabels.length === 0) return ""

  if (guidedAnswerSet.selectionMode === "single") {
    return optionLabels[0]
  }

  if (guidedAnswerSet.options.some((option) => option.id === "none" && optionLabels.includes(option.label))) {
    return "None of these for version one."
  }

  return GUIDED_DRAFT_BUILDERS[guidedAnswerSet.key]?.(optionLabels) || optionLabels.join(", ")
}


export function getPlanningStudioStage(
  blueprint: ProjectBlueprint,
  planningStatus: PlanningStatus
): PlanningStudioStage {
  const planReady = blueprint.openQuestions.length === 0
  const blueprintVisible = planningStatus === "plan-generated" || planningStatus === "approved"
  const questionsRemaining = blueprint.openQuestions.length
  const stepIndex = blueprintVisible ? 2 : 1
  const stepItems: Array<{ key: "define" | "plan" | "build"; label: string; state: "current" | "upcoming" }> = [
    { key: "define", label: "Define", state: blueprintVisible ? "upcoming" : "current" },
    { key: "plan", label: "Plan", state: blueprintVisible ? "current" : "upcoming" },
    { key: "build", label: "Build", state: "upcoming" },
  ]

  return {
    step: blueprintVisible ? "plan" : "define",
    planReady,
    blueprintVisible,
    stepIndex,
    questionsRemaining,
    composerSubmitLabel: blueprintVisible
      ? "Refine plan"
      : planReady
        ? "Next"
        : "Next",
    statusLabel: blueprintVisible
      ? "Plan ready to review"
      : planReady
        ? "Ready to generate plan"
        : "Shaping your brief",
    heading: blueprintVisible ? "Your plan is ready to review" : "Let's shape your site before we build it",
    description: blueprintVisible
      ? "You now have a clear version-one plan. Review it, refine anything that feels off, then build when you're ready."
      : "A few clear decisions now will make the first build feel much closer to what you actually want.",
    reassurance: blueprintVisible
      ? "You're past the open-ended part. This is the review step before the build."
      : planReady
        ? "You're very close. One approval turns these answers into a plan you can review."
        : questionsRemaining === 1
          ? "This should only take one more decision before the plan is ready."
          : `${questionsRemaining} key decisions left before we draft the plan.`,
    nextStepLabel: blueprintVisible
      ? "Next: approve the plan for build"
      : planReady
        ? "Next: generate your plan"
        : "Next: answer the current question",
    stepItems,
  }
}
