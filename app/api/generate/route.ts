import OpenAI from "openai"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { DEFAULT_PLANS } from "@/lib/firebase"
import { normalizeGeneratedCodeFiles } from "@/lib/generated-code-normalization"
import {
  ensureGeneratedProjectScaffold,
  injectMissingComponentStubs,
  validateGeneratedProjectFiles,
  GENERATED_APP_DEPENDENCY_VERSIONS,
  type GeneratedProjectFile,
} from "@/lib/generated-project-validation"
import { chargeTokensForGeneration } from "@/lib/charge-tokens"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
})

const DEFAULT_MODEL = "GPT-5.5"  // Full model (not mini) - more capable for better library knowledge and code quality
const OPENAI_MODEL_MAP: Record<string, string> = {
  "o3-mini": "o3-mini",
  "GPT-5.5 Pro": "gpt-5.5-pro",
  "GPT-5.5": "gpt-5.5",
  "GPT-5.4 Pro": "gpt-5.4-pro",
  "GPT-5.4": "gpt-5.4",
  "GPT-5.4 Mini": "gpt-5.4-mini",
  "GPT-5.4 Nano": "gpt-5.4-nano",
  "GPT-5 Mini": "gpt-5-mini",
  "GPT-5 Nano": "gpt-5-nano",
  "GPT-4-1": "gpt-4.1",
}

const CURATED_NVIDIA_MODELS = [
  "minimaxai/minimax-m2.1",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-405b-instruct",
  "deepseek-ai/deepseek-r1",
  "qwen/qwen2.5-coder-32b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  "google/gemma-3-27b-it",
]

const OPEN_SOURCE_MODEL_PATTERNS = [
  "meta/",
  "mistralai/",
  "deepseek-ai/",
  "qwen/",
  "google/gemma",
  "minimaxai/",
  "moonshotai/",
  "nvidia/",
]

let cachedNvidiaModels: { models: string[]; expiresAt: number } | null = null

type ParsedFileBlock = {
  path: string
  content: string
}

type ProjectFileInput = {
  path: string
  content: string
}

type Provider = "openai" | "nvidia"

type StreamState = {
  usageInfo: any
  streamedLength: number
  closed: boolean
}

const FILE_SELECTION_LIMIT = 8
const FILE_CONTENT_SCAN_LIMIT = 1500
const PROMPT_KEYWORD_LIMIT = 12
const OPENAI_TIMEOUT_MS = 90000
const GENERATION_MAX_OUTPUT_TOKENS = (() => {
  const parsed = Number(process.env.GENERATION_MAX_OUTPUT_TOKENS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16000
})()
const MAX_CONTINUATION_ROUNDS = 2
const MAX_PROMPT_CHARS = 12000
const STRICT_FILE_FORMAT_RETRY_PROMPT = `Your previous response did not follow the required file format.

You MUST output ONLY file blocks using:

===FILE: path===
content
===END_FILE===

Do not include anything else.`
const PROMPT_KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "app",
  "build",
  "change",
  "create",
  "file",
  "for",
  "from",
  "in",
  "into",
  "make",
  "page",
  "project",
  "section",
  "site",
  "the",
  "this",
  "to",
  "update",
  "with",
])

function dedupeFilesByPath(files: ProjectFileInput[]) {
  const seen = new Set<string>()
  return files.filter((file) => {
    const path = typeof file.path === "string" ? file.path : ""
    if (!path || seen.has(path) || typeof file.content !== "string") return false
    seen.add(path)
    return true
  })
}

function isCoreContextFile(path: string) {
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase()
  return (
    normalizedPath === "package.json" ||
    normalizedPath === "vite.config.ts" ||
    normalizedPath === "index.html" ||
    normalizedPath === "src/index.css" ||
    normalizedPath === "tailwind.config.ts" ||
    normalizedPath === "postcss.config.js" ||
    normalizedPath === "app.tsx" ||
    normalizedPath === "main.tsx" ||
    normalizedPath === "src/app.tsx" ||
    normalizedPath === "src/main.tsx" ||
    normalizedPath.endsWith("/app.tsx") ||
    normalizedPath.endsWith("/main.tsx")
  )
}

function extractPromptKeywords(prompt: string) {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9/_.\-\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !PROMPT_KEYWORD_STOPWORDS.has(token))
    )
  ).slice(0, PROMPT_KEYWORD_LIMIT)
}

function scoreFileForPrompt(file: ProjectFileInput, keywords: string[]) {
  if (isCoreContextFile(file.path)) return Number.MAX_SAFE_INTEGER

  const normalizedPath = file.path.toLowerCase()
  const fileName = normalizedPath.split("/").pop() || normalizedPath
  const contentPreview = file.content.slice(0, FILE_CONTENT_SCAN_LIMIT).toLowerCase()
  let score = 0

  for (const keyword of keywords) {
    if (fileName.includes(keyword)) score += 8
    else if (normalizedPath.includes(keyword)) score += 5
    if (contentPreview.includes(keyword)) score += 2
  }

  return score
}

function extractRelativeImports(content: string): string[] {
  const importRegex = /from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g
  const imports: string[] = []
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(content)) !== null) {
    const raw = match[1] || match[2]
    if (raw && raw.startsWith(".")) {
      imports.push(raw)
    }
  }

  return imports
}

function resolveImportPath(basePath: string, relativePath: string): string {
  const baseDir = basePath.includes("/") ? basePath.slice(0, basePath.lastIndexOf("/")) : ""
  const combined = `${baseDir}/${relativePath}`

  const normalizedParts: string[] = []
  for (const part of combined.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      normalizedParts.pop()
      continue
    }
    normalizedParts.push(part)
  }

  return normalizedParts.join("/")
}

function collectDependencyFiles(
  files: ProjectFileInput[],
  seedFiles: ProjectFileInput[]
): ProjectFileInput[] {
  const fileMap = new Map(files.map((f) => [f.path, f]))
  const visited = new Set<string>()
  const result: ProjectFileInput[] = []

  const stack = [...seedFiles]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current.path)) continue

    visited.add(current.path)
    result.push(current)

    const imports = extractRelativeImports(current.content)

    for (const imp of imports) {
      const resolved = resolveImportPath(current.path, imp)

      const candidates = [
        resolved,
        `${resolved}.ts`,
        `${resolved}.tsx`,
        `${resolved}.js`,
        `${resolved}.jsx`,
        `${resolved}/index.tsx`,
        `${resolved}/index.ts`,
      ]

      for (const candidate of candidates) {
        const found = fileMap.get(candidate)
        if (found && !visited.has(found.path)) {
          stack.push(found)
        }
      }
    }
  }

  return result
}

function trimPromptFilesToBudget(
  prompt: string,
  files: ProjectFileInput[]
): ProjectFileInput[] {
  let totalLength = prompt.length
  const result: ProjectFileInput[] = []

  for (const file of files) {
    const fileLength = file.path.length + file.content.length + 50

    if (totalLength + fileLength > MAX_PROMPT_CHARS) break

    result.push(file)
    totalLength += fileLength
  }

  return result
}

function buildFollowUpUserMessage(
  prompt: string,
  files: ProjectFileInput[]
) {
  return `The user wants these changes or additions to their existing project:\n\n${prompt}\n\nCurrent project files (only modify or add as needed; do not output unchanged files):\n${files.map((f) => `\n--- FILE: ${f.path} ---\n${f.content}\n--- END ${f.path} ---`).join("")}`
}

function selectRelevantFiles(existingFiles: ProjectFileInput[], prompt: string) {
  const dedupedFiles = dedupeFilesByPath(existingFiles)
  if (dedupedFiles.length <= FILE_SELECTION_LIMIT) return dedupedFiles

  const keywords = extractPromptKeywords(prompt)
  const coreFiles = dedupedFiles.filter((file) => isCoreContextFile(file.path))
  const rankedNonCoreFiles = dedupedFiles
    .filter((file) => !isCoreContextFile(file.path))
    .map((file, index) => ({
      file,
      index,
      score: scoreFileForPrompt(file, keywords),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.file)

  const topKeywordFiles = rankedNonCoreFiles.slice(0, FILE_SELECTION_LIMIT)

  const dependencyExpanded = collectDependencyFiles(
    dedupedFiles,
    [...coreFiles, ...topKeywordFiles]
  )

  return dedupeFilesByPath(dependencyExpanded).slice(0, FILE_SELECTION_LIMIT * 2)
}

function isOpenSourceNvidiaModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase()
  return OPEN_SOURCE_MODEL_PATTERNS.some((pattern) => normalized.includes(pattern))
}

async function getNvidiaModels(): Promise<string[]> {
  const now = Date.now()
  if (cachedNvidiaModels && cachedNvidiaModels.expiresAt > now) {
    return cachedNvidiaModels.models
  }

  const fallbackModels = [...CURATED_NVIDIA_MODELS].sort((a, b) => a.localeCompare(b))
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY
  if (!apiKey) {
    cachedNvidiaModels = { models: fallbackModels, expiresAt: now + 5 * 60 * 1000 }
    return fallbackModels
  }

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`NVIDIA models request failed with ${response.status}`)
    }

    const data = await response.json() as { data?: Array<{ id?: string }> }
    const discoveredModels = (data.data || [])
      .map((entry) => entry.id?.trim())
      .filter((id): id is string => Boolean(id && isOpenSourceNvidiaModel(id)))

    const mergedModels = Array.from(new Set([...CURATED_NVIDIA_MODELS, ...discoveredModels]))
      .sort((a, b) => a.localeCompare(b))

    cachedNvidiaModels = { models: mergedModels, expiresAt: now + 10 * 60 * 1000 }
    return mergedModels
  } catch (error) {
    console.error("Failed to load NVIDIA models:", error)
    cachedNvidiaModels = { models: fallbackModels, expiresAt: now + 5 * 60 * 1000 }
    return fallbackModels
  }
}

async function resolveModel(model: string) {
  if (OPENAI_MODEL_MAP[model]) {
    return {
      client: openai,
      selectedModel: OPENAI_MODEL_MAP[model],
      provider: "openai" as const,
    }
  }

  const nvidiaModels = await getNvidiaModels()
  if (nvidiaModels.includes(model)) {
    return {
      client: nvidia,
      selectedModel: model,
      provider: "nvidia" as const,
    }
  }

  return {
    client: openai,
    selectedModel: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    provider: "openai" as const,
  }
}

function getFirstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

function getPeriodEndDate(raw: unknown): Date | null {
  if (!raw) return null
  if (typeof raw === "object" && raw !== null && "toDate" in raw && typeof (raw as { toDate: () => Date }).toDate === "function") {
    return (raw as { toDate: () => Date }).toDate()
  }
  const d = new Date(raw as string | number)
  return isNaN(d.getTime()) ? null : d
}

function parseFileBlocks(content: string): ParsedFileBlock[] {
  const files: ParsedFileBlock[] = []
  // Tempered pattern: a block's content can never contain another ===FILE: marker,
  // so an unterminated truncated block cannot match or swallow a re-emitted complete copy.
  const fileRegex = /===FILE:\s*(.*?)===((?:(?!===FILE:)[\s\S])*?)===END_FILE===/g
  let match: RegExpExecArray | null

  while ((match = fileRegex.exec(content)) !== null) {
    const path = match[1].trim()
    const fileContent = match[2]
      .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim()

    if (path) {
      files.push({ path, content: fileContent })
    }
  }

  return files
}

// When a generation hits the output token cap mid-file, strip the unterminated
// trailing ===FILE: block so the continuation request can re-emit it completely.
function splitTruncatedFileTail(content: string): { content: string; cutOffPath: string } {
  const lastFileIdx = content.lastIndexOf("===FILE:")
  const lastEndIdx = content.lastIndexOf("===END_FILE===")
  if (lastFileIdx === -1 || lastFileIdx <= lastEndIdx) {
    return { content, cutOffPath: "" }
  }
  const cutOffPath = content.slice(lastFileIdx).match(/^===FILE:\s*(.*?)===/)?.[1]?.trim() || ""
  return { content: content.slice(0, lastFileIdx), cutOffPath }
}

function buildContinuationInstruction(cutOffPath: string) {
  return [
    "Your previous response was cut off because it hit the output length limit. Continue the same response.",
    "- Do NOT repeat any file that already ended with ===END_FILE===.",
    cutOffPath
      ? `- The file "${cutOffPath}" was cut off mid-output. Re-emit it COMPLETELY, starting again from its ===FILE: ${cutOffPath}=== line through its ===END_FILE===.`
      : "",
    "- Then emit any files you had not started yet.",
    "- Output ONLY file blocks in the ===FILE: path=== ... ===END_FILE=== format. No other text.",
  ].filter(Boolean).join("\n")
}

function serializeFileBlocks(files: ParsedFileBlock[]) {
  return files.map((file) => `===FILE: ${file.path}===\n${file.content}\n===END_FILE===`).join("\n")
}

function getAgentMessageBlock(content: string) {
  return content.match(/===AGENT_MESSAGE===[\s\S]*?===END_AGENT_MESSAGE===\s*/)?.[0] ?? ""
}

function serializeGeneratorOutput(agentMessage: string, files: ParsedFileBlock[]) {
  const fileBlocks = serializeFileBlocks(files)
  if (!agentMessage) return fileBlocks
  return `${agentMessage.trimEnd()}\n${fileBlocks}`
}

function mergeFilesByPath(baseFiles: GeneratedProjectFile[], updateFiles: GeneratedProjectFile[]) {
  const byPath = new Map<string, GeneratedProjectFile>()
  for (const file of baseFiles) {
    if (typeof file?.path === "string" && typeof file.content === "string") {
      byPath.set(file.path, file)
    }
  }
  for (const file of updateFiles) {
    if (typeof file?.path === "string" && typeof file.content === "string") {
      byPath.set(file.path, file)
    }
  }
  return Array.from(byPath.values())
}

function getChangedFiles(beforeFiles: GeneratedProjectFile[], afterFiles: GeneratedProjectFile[]) {
  const beforeByPath = new Map(beforeFiles.map((file) => [file.path, file.content]))
  return afterFiles.filter((file) => beforeByPath.get(file.path) !== file.content)
}

function assertValidFileBlockOutput(content: string) {
  if (!content.includes("===FILE:")) {
    throw new Error("Invalid generator output: no file blocks")
  }

  const fileBlocks = parseFileBlocks(content)
  if (fileBlocks.length === 0) {
    throw new Error("Invalid generator output: no parseable file blocks")
  }

  return fileBlocks
}

function buildGenerationRepairPrompt(issues: string[], brokenContent?: string) {
  return `Repair the project output and return a fully corrected response in the exact required file streaming format.

Detected issues:
${issues.map((issue) => `- ${issue}`).join("\n")}
${brokenContent ? `\nBroken output:\n${brokenContent}\n` : ""}
Rules:
- Keep the same product request, app intent, and design direction.
- Ensure package.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/index.css, tailwind.config.ts, and postcss.config.js are present for new apps.
- Ensure src/main.tsx imports './index.css'.
- Fix all missing imports, missing components, missing assets, and missing package dependencies.
- Do not explain the fixes.
- Return exactly one AGENT_MESSAGE and corrected file blocks only.
- Do not wrap files in JSON or markdown.`
}

function validateGeneratedFiles(generatedContent: string, existingFiles?: { path: string; content: string }[]) {
  const fileBlocks = parseFileBlocks(generatedContent)
  const validation = validateGeneratedProjectFiles(fileBlocks, {
    existingFiles,
    requireNewAppScaffold: !existingFiles?.length,
  })

  return {
    fileBlocks,
    issues: validation.issueMessages,
  }
}

function injectMissingCssFiles(fileBlocks: ParsedFileBlock[]): ParsedFileBlock[] {
  return ensureGeneratedProjectScaffold(fileBlocks)
}

async function generateWithNvidiaValidation(params: {
  client: OpenAI
  selectedModel: string
  systemPrompt: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
}) {
  const initial = await params.client.chat.completions.create({
    model: params.selectedModel,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessageContent },
    ],
    max_tokens: GENERATION_MAX_OUTPUT_TOKENS,
  })

  let finalContent = initial.choices[0]?.message?.content || ""
  let usageInfo: any = initial.usage || null

  // One continuation round if the model hit the output token cap mid-response:
  // strip the unterminated trailing file block and ask it to resume, re-emitting
  // the cut-off file completely. On failure, fall through — downstream
  // validation/repair handles whatever we have.
  if (initial.choices[0]?.finish_reason === "length") {
    try {
      const { content: cleanContent, cutOffPath } = splitTruncatedFileTail(finalContent)
      finalContent = cleanContent

      const continued = await params.client.chat.completions.create({
        model: params.selectedModel,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessageContent },
          { role: "assistant", content: finalContent },
          { role: "user", content: buildContinuationInstruction(cutOffPath) },
        ],
        max_tokens: GENERATION_MAX_OUTPUT_TOKENS,
      })

      finalContent += continued.choices[0]?.message?.content || ""
      usageInfo = continued.usage || usageInfo
    } catch (err) {
      console.error("NVIDIA generation continuation failed:", err)
    }
  }

  try {
    assertValidFileBlockOutput(finalContent)
  } catch {
    const retried = await params.client.chat.completions.create({
      model: params.selectedModel,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: finalContent },
        { role: "user", content: STRICT_FILE_FORMAT_RETRY_PROMPT },
      ],
      max_tokens: GENERATION_MAX_OUTPUT_TOKENS,
    })

    finalContent = retried.choices[0]?.message?.content || ""
    usageInfo = retried.usage || usageInfo
    assertValidFileBlockOutput(finalContent)
  }

  let validation = validateGeneratedFiles(finalContent, params.existingFiles)

  if (validation.issues.length > 0) {
    const repairPrompt = buildGenerationRepairPrompt(validation.issues)

    const repaired = await params.client.chat.completions.create({
      model: params.selectedModel,
      messages: [
        { role: "system", content: `${params.systemPrompt}\n\nYou must repair invalid output when issues are reported.` },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: finalContent },
        { role: "user", content: repairPrompt },
      ],
      max_tokens: GENERATION_MAX_OUTPUT_TOKENS,
    })

    finalContent = repaired.choices[0]?.message?.content || finalContent
    usageInfo = repaired.usage || usageInfo
    validation = validateGeneratedFiles(finalContent, params.existingFiles)
  }

  let finalFileBlocks = validation.fileBlocks
  const agentMessage = getAgentMessageBlock(finalContent)
  const beforeScaffold = mergeFilesByPath(params.existingFiles ?? [], finalFileBlocks)
  const afterScaffold = injectMissingCssFiles(beforeScaffold)
  const scaffoldChanges = getChangedFiles(beforeScaffold, afterScaffold)
  finalFileBlocks = mergeFilesByPath(finalFileBlocks, scaffoldChanges)

  // Deterministic safety net for any local component imports the model left
  // unresolved, so the preview always builds.
  const beforeStub = mergeFilesByPath(params.existingFiles ?? [], finalFileBlocks)
  const afterStub = injectMissingComponentStubs(beforeStub)
  const stubChanges = getChangedFiles(beforeStub, afterStub)
  finalFileBlocks = mergeFilesByPath(finalFileBlocks, stubChanges)

  finalFileBlocks = normalizeGeneratedCodeFiles(finalFileBlocks)
  finalContent = serializeGeneratorOutput(agentMessage, finalFileBlocks)
  validation = validateGeneratedFiles(finalContent, params.existingFiles)

  return {
    finalContent,
    usageInfo,
    streamedLength: finalContent.length,
    remainingIssues: validation.issues,
  }
}

// Derives a specific design brief from the user's prompt before generation.
// Uses no category defaults — every decision is reasoned from the actual business context.
async function deriveDesignBrief(prompt: string): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
      messages: [
        {
          role: "system",
          content: `You are the creative director at a world-class digital agency (Pentagram, Fantasy Interactive, Instrument, Huge). Your job is to produce a committed, specific design brief that will make the AI developer generate a genuinely distinctive website — one that could not have been produced by any other AI tool.

STEP 1 — DOMAIN ANALYSIS (think silently):
Before choosing anything, answer these internally:
- What industry/domain is this? Who are their customers and what do those customers already trust?
- What is the best-designed real website in this exact niche? (e.g. for a law firm: Debevoise; for a bakery: Tartine; for a SaaS: Linear, Vercel, Craft)
- What visual language does that reference use? (type scale, palette, whitespace, image style)
- What would make THIS specific business look credible, premium, and on-brand — not just "a website for that category"?

STEP 2 — OUTPUT THE BRIEF:
Every decision must be specific. Vague is not allowed.
- NOT: "warm tones" → MUST: "#f2ede4 background, #b8652a accent, #1a1612 text"
- NOT: "large hero" → MUST: "full-bleed #0f0f0e bg, 108px Playfair Display italic left-aligned, max 6 words, no subheadline, single ghost-border button bottom-left corner"
- NOT: "clean layout" → MUST: "two-column grid: large stat/number left (120px bold), short descriptor right (14px/1.6), 5 rows"

CRITICAL CONSTRAINT — this brief must produce a site that looks nothing like a generic AI output:
- No gradient hero. No centered headline + subheadline + two buttons. No three identical feature cards. No "Why Choose Us". No testimonial card grid.
- The site must be immediately readable as a specific brand in a specific industry — not as "a website".
- At least one section must use a structural device no AI tool would default to: a large editorial number as section anchor, a full-bleed split screen, a horizontal scroll strip, a table-style service list, or a typographic-only hero with no imagery.

Output this exact structure (plain text, no markdown headers, no bullet points outside the SECTIONS list):
PALETTE: [bg hex] [primary-text hex] [accent hex] [muted-surface hex] [border hex]
FONTS: [display font name, Google Fonts] / [body font name, Google Fonts]
PERSONALITY: [adjective 1], [adjective 2], [adjective 3]
VISUAL_REFERENCE: [name of 1-2 real-world websites this should feel inspired by — be specific, e.g. "Linear.app (tight grid, monospace accents) and Notion.so (generous whitespace)"]
HERO_FORMAT: [exact implementation — bg color, type size in px, alignment, max words in headline, subheadline yes/no, CTA style and position, any image/no image]
HERO_HEADLINE: [the actual headline for this business — punchy, specific, under 8 words, sounds like the brand owner wrote it]
SECTIONS: [ordered list of sections, each as: SectionName: layout-description — be specific about number of columns, what anchors each row, image placement, type treatment]
TYPOGRAPHY_APPROACH: [display size range, label style, body size/line-height, any mixed-weight techniques]
STANDOUT: [one concrete unexpected layout or composition decision that makes this site immediately memorable — must be implementable in React/Tailwind]
ANTI_PATTERN: [describe the generic AI version of this exact site — the one we must NOT produce]`,
        },
        {
          role: "user",
          content: prompt.slice(0, 2000),
        },
      ],
      max_completion_tokens: 700,
      temperature: 0.25,
    })
    return res.choices[0]?.message?.content?.trim() || ""
  } catch {
    return ""
  }
}

async function salvageWithOpenAI(params: {
  systemPrompt: string
  userMessageContent: string
  brokenContent: string
  issues: string[]
}) {
  const salvagePrompt = buildGenerationRepairPrompt(params.issues, params.brokenContent)

  const repaired = await openai.chat.completions.create({
    model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    messages: [
      { role: "system", content: `${params.systemPrompt}\n\nYou are repairing an invalid project output into a buildable final result.` },
      { role: "user", content: params.userMessageContent },
      { role: "user", content: salvagePrompt },
    ],
    max_completion_tokens: GENERATION_MAX_OUTPUT_TOKENS,
  })

  let content = repaired.choices[0]?.message?.content || params.brokenContent
  
  const agentMessage = getAgentMessageBlock(content)
  const fileBlocks = normalizeGeneratedCodeFiles(injectMissingCssFiles(parseFileBlocks(content)))
  content = serializeGeneratorOutput(agentMessage, fileBlocks)

  return {
    content,
    usage: repaired.usage || null,
  }
}

async function repairInvalidFileFormatWithOpenAI(params: {
  systemPrompt: string
  userMessageContent: string
  brokenContent: string
}) {
  const repaired = await openai.chat.completions.create({
    model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessageContent },
      { role: "assistant", content: params.brokenContent },
      { role: "user", content: STRICT_FILE_FORMAT_RETRY_PROMPT },
    ],
    max_completion_tokens: GENERATION_MAX_OUTPUT_TOKENS,
  })

  const content = repaired.choices[0]?.message?.content || ""
  assertValidFileBlockOutput(content)

  return {
    content,
    usage: repaired.usage || null,
  }
}

async function streamWithResolvedProvider(params: {
  client: OpenAI
  provider: Provider
  selectedModel: string
  systemPrompt: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  state: StreamState
}) {
  if (params.provider === "nvidia") {
    const validated = await generateWithNvidiaValidation({
      client: params.client,
      selectedModel: params.selectedModel,
      systemPrompt: params.systemPrompt,
      userMessageContent: params.userMessageContent,
      existingFiles: params.existingFiles,
    })
    params.state.usageInfo = validated.usageInfo
    params.state.streamedLength = validated.streamedLength
    try {
      assertValidFileBlockOutput(validated.finalContent)
    } catch {
      const repaired = await repairInvalidFileFormatWithOpenAI({
        systemPrompt: params.systemPrompt,
        userMessageContent: params.userMessageContent,
        brokenContent: validated.finalContent,
      })
      params.state.usageInfo = repaired.usage || params.state.usageInfo
      params.state.streamedLength = repaired.content.length
      params.controller.enqueue(params.encoder.encode(repaired.content))
      return
    }

    if (validated.remainingIssues.length > 0) {
      console.warn("NVIDIA generation still has unresolved validation issues:", validated.remainingIssues)
      const salvaged = await salvageWithOpenAI({
        systemPrompt: params.systemPrompt,
        userMessageContent: params.userMessageContent,
        brokenContent: validated.finalContent,
        issues: validated.remainingIssues,
      })
      assertValidFileBlockOutput(salvaged.content)
      params.state.usageInfo = salvaged.usage || params.state.usageInfo
      params.state.streamedLength = salvaged.content.length
      params.controller.enqueue(params.encoder.encode(salvaged.content))
    } else {
      params.controller.enqueue(params.encoder.encode(validated.finalContent))
    }
    return
  }

  const createOpenAICompletion = async (messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) => {
    const controllerAbort = new AbortController()
    const timeoutId = setTimeout(() => {
      controllerAbort.abort()
    }, OPENAI_TIMEOUT_MS)

    try {
      const completion = await params.client.chat.completions.create({
        model: params.selectedModel,
        stream: true,
        messages,
        max_completion_tokens: GENERATION_MAX_OUTPUT_TOKENS,
        stream_options: { include_usage: true } as any,
      }, { signal: controllerAbort.signal })
      clearTimeout(timeoutId)
      return completion
    } catch (err: any) {
      clearTimeout(timeoutId)

      if (err?.name === "AbortError") {
        console.error("OpenAI request aborted due to timeout")
        throw new Error("MODEL_TIMEOUT")
      }

      throw err
    }
  }

  const streamTokens = async (completion: Awaited<ReturnType<typeof createOpenAICompletion>>) => {
    let buffered = ""
    let finishReason: string | null = null
    for await (const chunk of completion) {
      if ((chunk as any).usage) params.state.usageInfo = (chunk as any).usage
      const chunkFinishReason = chunk.choices?.[0]?.finish_reason
      if (chunkFinishReason) finishReason = chunkFinishReason
      const content = chunk.choices?.[0]?.delta?.content
      if (!content) continue
      buffered += content
      if (!params.state.closed) {
        try { params.controller.enqueue(params.encoder.encode(content)) }
        catch { params.state.closed = true }
      }
    }
    return { buffered, finishReason }
  }

  let basePrompt = params.userMessageContent
  if (params.userMessageContent.includes("\n\nCurrent project files")) {
    basePrompt = params.userMessageContent.split("\n\nCurrent project files")[0]
  }

  let completion
  try {
    completion = await createOpenAICompletion([
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessageContent },
    ])
  } catch (err: any) {
    if (err?.message === "MODEL_TIMEOUT" && params.existingFiles?.length) {
      const retrySeedFiles = selectRelevantFiles(params.existingFiles, params.userMessageContent)
      const reducedFiles = trimPromptFilesToBudget(
        params.userMessageContent,
        retrySeedFiles.slice(0, Math.max(2, Math.ceil(retrySeedFiles.length / 2)))
      )
      completion = await createOpenAICompletion([
        { role: "system", content: params.systemPrompt },
        { role: "user", content: buildFollowUpUserMessage(basePrompt, reducedFiles) },
      ])
    } else {
      throw err
    }
  }

  const firstPass = await streamTokens(completion)
  let output = firstPass.buffered
  let finishReason = firstPass.finishReason

  // Continuation: the model hit the output token cap mid-response. Strip the
  // unterminated trailing file block and ask it to resume, re-emitting the
  // cut-off file completely. The tempered parse regex guarantees the dead
  // truncated tail already streamed to the client can never match.
  let continuationRounds = 0
  while (finishReason === "length" && continuationRounds < MAX_CONTINUATION_ROUNDS) {
    continuationRounds++
    try {
      const { content: cleanOutput, cutOffPath } = splitTruncatedFileTail(output)
      output = cleanOutput

      const continuation = await createOpenAICompletion([
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: output },
        { role: "user", content: buildContinuationInstruction(cutOffPath) },
      ])
      const continued = await streamTokens(continuation)
      output += continued.buffered
      finishReason = continued.finishReason
    } catch (err) {
      console.error("Generation continuation failed:", err)
      break
    }
  }

  params.state.streamedLength += output.length

  const parsedBlocks = parseFileBlocks(output)
  const beforeScaffold = mergeFilesByPath(params.existingFiles ?? [], parsedBlocks)
  const afterScaffold = injectMissingCssFiles(beforeScaffold)
  const scaffoldChanges = normalizeGeneratedCodeFiles(getChangedFiles(beforeScaffold, afterScaffold))
  let finalBlocks = mergeFilesByPath(parsedBlocks, scaffoldChanges)

  if (scaffoldChanges.length && !params.state.closed) {
    const scaffoldPayload = serializeFileBlocks(scaffoldChanges)
    try {
      params.controller.enqueue(params.encoder.encode(scaffoldPayload))
      params.state.streamedLength += scaffoldPayload.length
    } catch {
      params.state.closed = true
    }
  }

  let validation = validateGeneratedFiles(serializeFileBlocks(finalBlocks), params.existingFiles)
  if (validation.issues.length > 0 && !params.state.closed) {
    console.warn("OpenAI generation has validation issues, attempting salvage:", validation.issues)
    const salvaged = await salvageWithOpenAI({
      systemPrompt: params.systemPrompt,
      userMessageContent: params.userMessageContent,
      brokenContent: serializeFileBlocks(finalBlocks),
      issues: validation.issues,
    })
    const salvagedBlocks = normalizeGeneratedCodeFiles(parseFileBlocks(salvaged.content))
    if (salvagedBlocks.length) {
      const beforeSalvage = mergeFilesByPath(params.existingFiles ?? [], finalBlocks)
      const afterSalvage = mergeFilesByPath(beforeSalvage, salvagedBlocks)
      const salvageChanges = getChangedFiles(beforeSalvage, afterSalvage)
      const salvagePayload = serializeFileBlocks(salvageChanges.length ? salvageChanges : salvagedBlocks)
      try {
        params.controller.enqueue(params.encoder.encode(salvagePayload))
        params.state.usageInfo = salvaged.usage || params.state.usageInfo
        params.state.streamedLength += salvagePayload.length
      }
      catch { params.state.closed = true }
      finalBlocks = mergeFilesByPath(finalBlocks, salvagedBlocks)
      validation = validateGeneratedFiles(serializeFileBlocks(finalBlocks), params.existingFiles)
      if (validation.issues.length > 0) {
        console.warn("OpenAI salvage left unresolved validation issues:", validation.issues)
      }
    }
  }

  // Deterministic safety net: if a generated module still imports local
  // components that were never emitted, create minimal stub modules so the
  // preview always builds instead of failing on unresolved imports.
  if (!params.state.closed && validation.issues.some((issue) => issue.includes("Missing import target"))) {
    const beforeStub = mergeFilesByPath(params.existingFiles ?? [], finalBlocks)
    const afterStub = injectMissingComponentStubs(beforeStub)
    const stubChanges = normalizeGeneratedCodeFiles(getChangedFiles(beforeStub, afterStub))
    if (stubChanges.length) {
      const stubPayload = serializeFileBlocks(stubChanges)
      try {
        params.controller.enqueue(params.encoder.encode(stubPayload))
        params.state.streamedLength += stubPayload.length
      } catch {
        params.state.closed = true
      }
      finalBlocks = mergeFilesByPath(finalBlocks, stubChanges)
      validation = validateGeneratedFiles(serializeFileBlocks(finalBlocks), params.existingFiles)
      console.log(
        `Stub injection created ${stubChanges.length} placeholder module(s); remaining issues: ${validation.issues.length}`
      )
    }
  }
}

async function runBuilderRuntime(params: {
  client: OpenAI
  provider: Provider
  selectedModel: string
  systemPrompt: string
  userMessageContent: string
  existingFiles?: { path: string; content: string }[]
  controller: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  state: StreamState
}) {
  await streamWithResolvedProvider(params)
}

export async function GET() {
  const nvidiaModels = await getNvidiaModels()
  return Response.json({
    defaultModel: DEFAULT_MODEL,
    models: [...Object.keys(OPENAI_MODEL_MAP), ...nvidiaModels],
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    prompt: string
    model?: string
    idToken?: string
    existingFiles?: { path: string; content: string }[]
    intent?: string
    skipDesignBrief?: boolean
    inspirationContext?: { title: string; description: string; markdown: string; sourceUrl: string }
  } | null
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const {
    prompt: rawPrompt,
    model = DEFAULT_MODEL,
    idToken,
    existingFiles,
    intent,
  } = body
  const prompt = typeof rawPrompt === "string" ? rawPrompt.trim() : ""
  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 })
  }
  const safeExistingFiles = Array.isArray(existingFiles)
    ? dedupeFilesByPath(existingFiles.filter((file): file is ProjectFileInput =>
        Boolean(file && typeof file.path === "string" && typeof file.content === "string")
      ))
    : undefined

  // authenticate user via Firebase ID token (body) or Authorization Bearer token (header)
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null
  const authToken = (idToken && idToken.trim()) || bearerToken
  if (!authToken) {
    return new Response(JSON.stringify({ error: 'Missing idToken' }), { status: 401 })
  }

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(authToken)
    uid = decoded.uid
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid idToken' }), { status: 401 })
  }

  // Check if token period has ended → reset monthly, then check remaining tokens
  try {
    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }
    const userData = userSnap.data() as any

    const planId = userData?.planId || 'free'
    const planTokensPerMonth = userData?.tokensLimit != null ? Number(userData.tokensLimit) : (DEFAULT_PLANS[planId as keyof typeof DEFAULT_PLANS]?.tokensPerMonth || DEFAULT_PLANS.free.tokensPerMonth)

    const periodEnd = getPeriodEndDate(userData?.tokenUsage?.periodEnd)
    const now = new Date()
    const shouldReset = !periodEnd || isNaN(periodEnd.getTime()) || now >= periodEnd

    if (shouldReset) {
      const nextPeriodEnd = getFirstDayOfNextMonth(now)
      await userRef.update({
        tokenUsage: {
          used: 0,
          remaining: planTokensPerMonth,
          periodStart: Timestamp.fromDate(now),
          periodEnd: Timestamp.fromDate(nextPeriodEnd),
        },
      })
      console.log('Token period reset - User:', uid, 'Next periodEnd:', nextPeriodEnd.toISOString())
    }

    let remaining = shouldReset ? planTokensPerMonth : userData?.tokenUsage?.remaining

    if (remaining === undefined || remaining === null) {
      if (userData?.tokensLimit != null && userData?.tokensUsed !== undefined) {
        remaining = userData.tokensLimit - userData.tokensUsed
      } else {
        remaining = planTokensPerMonth
      }
    }
    remaining = Math.max(0, Number(remaining))

    console.log('Token check - User:', uid, 'Plan:', planId, 'Plan Tokens:', planTokensPerMonth, 'Remaining:', remaining, 'TokenUsage:', userData?.tokenUsage)
    if (remaining <= 0) {
      return new Response(JSON.stringify({ error: 'Insufficient tokens' }), { status: 402 })
    }
  } catch (e) {
    console.error('Token check failed', e)
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
  }

  const requestedModel = typeof model === "string" && model.trim() ? model : DEFAULT_MODEL
  const { client, selectedModel, provider } = await resolveModel(requestedModel)
  const isFollowUp = Array.isArray(safeExistingFiles) && safeExistingFiles.length > 0
  let promptFiles = isFollowUp ? selectRelevantFiles(safeExistingFiles || [], prompt) : []

  if (isFollowUp) {
    promptFiles = trimPromptFilesToBudget(prompt, promptFiles)
  }

  const systemPromptFollowUp = `You are an expert React developer. The user is asking for CHANGES or ADDITIONS to an existing project. You will receive the current project files.

INTENT CLASSIFICATION (do this first, silently):
Classify the user request into one of:
- STYLE: color, font, spacing, animation, visual tweak → max 1-2 files
- CONTENT: text, copy, labels, images → max 1-2 files
- COMPONENT: add/remove/modify a single UI section → max 3 files
- FEATURE: new functionality, state, logic → touch only affected files
- PAGE: new route/page → only new files + App.tsx routing
- REFACTOR: restructure existing code → affected files only

SCOPE RULES based on classification:
- STYLE/CONTENT: return ONLY the single file containing that element. Never touch package.json, vite.config.ts, or unrelated components.
- COMPONENT: return only the component file + its direct parent if wiring is needed.
- FEATURE: return only files that need new imports, state, or logic. Do not rewrite unrelated files.
- PAGE/REFACTOR: still do not rewrite unchanged files.

HARD RULES:
- Never rewrite a file just to "clean it up"
- Never return package.json unless a new dependency is genuinely needed
- For every changed file, return the complete updated file content inside its file block.
- If you are about to return more than 4 files for a STYLE or CONTENT request, stop and reconsider

PRODUCTION STANDARD (FOLLOW-UP):
- Maintain or elevate the existing design quality.
- Never downgrade visual polish when making changes.
- Match the domain aesthetic already established.
- Keep all existing content — only change what was asked.
- If adding new sections, they must match the visual language of existing sections exactly.
- Never introduce placeholder content in follow-up edits.
- Preserve the existing project architecture and file structure. Do NOT convert an existing React/Vite project into standalone HTML/CSS/JS.
- Never say you are building "a single-page HTML/CSS/JS file" in the agent message. Describe the actual targeted React/Vite change.

UI STANDARD: When adding or changing UI, match or elevate the existing design language. Specifically:
- Read the existing code before adding anything. Match the exact font variables, color system, spacing scale, and component patterns already in use.
- New sections must use the same typographic scale (large display sizes, label styles, body size) and section padding rhythm already established.
- Preserve the aesthetic direction of the existing site. If it is editorial/dark/luxury/playful — new sections must be the same. Do NOT regress to a generic style.
- NEVER add: rows of identical cards, centered-text banner CTAs, gradient backgrounds, generic section headings ("Why Choose Us", "Get Started"). These are banned regardless of context.
- New sections must use the same structural vocabulary: if the site uses alternating rows, add an alternating row. If it uses bento grids, add a bento cell. Do not introduce a new structural pattern that breaks visual cohesion.
- Motion: match the existing animation style. If the site uses scroll-triggered reveals, new elements must also reveal on scroll. Do not add animations that conflict with the existing motion language.
- Typography: never introduce a new font or change the font variables. Use the existing --font-display and --font-body from the CSS variables.
- Background: new sections must fit the existing section-tone alternation pattern. Check what backgrounds adjacent sections use before setting a background.

RESPONSIVE: Preserve or improve responsiveness on all devices. Use Tailwind breakpoints (sm:, md:, lg:) for layout and typography; avoid fixed widths that break on small screens; ensure touch targets are at least 44px on mobile; prevent horizontal overflow (max-w-full, min-w-0, overflow-hidden where needed). Generated UI must work on phone, tablet, and desktop.

DEPENDENCIES (CRITICAL):
- Before using ANY new import/package in your code, you MUST add it to package.json dependencies or devDependencies.
- NEVER import from react-icons subpackages like react-icons/hi2, react-icons/hi, react-icons/md etc unless "react-icons" is already in package.json.
- If you use react-icons, add "react-icons": "^5.0.0" to package.json dependencies AND import only from react-icons/fa or react-icons/fa6 — these are the most stable subpackages.
- NEVER use HiOutlineMenu, HiOutlineBars3 or any Hi* icon — they are unreliable across versions.
- PREFER lucide-react for ALL icons when it is listed in package.json. Only use react-icons when lucide-react does not have what you need and react-icons is listed in package.json.
- NEVER hallucinate lucide-react icon names. 'RocketLaunch' does not exist, use 'Rocket'. Use exact lucide casing: 'Github' not 'GitHub', 'Linkedin' not 'LinkedIn', 'Youtube' not 'YouTube'.
- If you import lucide-react, add "lucide-react": "${GENERATED_APP_DEPENDENCY_VERSIONS["lucide-react"]}" to dependencies if not already present.
- If you use framer-motion, add "framer-motion": "${GENERATED_APP_DEPENDENCY_VERSIONS["framer-motion"]}" to dependencies.
- Check the existing package.json first. Only add packages that are truly needed and don't already exist.
- NEVER use packages that don't exist on npm (e.g., @shadcn/ui).
- For the favicon in index.html, ALWAYS use an inline SVG: <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>"> to prevent 404 errors.

CRITICAL: Do NOT regenerate the entire project. Output ONLY:
1. One AGENT_MESSAGE (see below).
2. For each file that you MODIFY: output that file in ===FILE: path=== ... ===END_FILE=== with the COMPLETE updated file content.
3. For each NEW file (file that does not exist yet): output ===FILE: path=== complete file content ===END_FILE===.
Do NOT output any file that is unchanged. Do NOT output the full project; only changed or new files.

Use this exact streaming format for every file you output:
===FILE: path/to/file.tsx===
[complete updated file content]
===END_FILE===

AGENT MESSAGE (required): First, output exactly one conversational reply in this format on a single line (no newlines inside):
===AGENT_MESSAGE=== Your brief friendly reply, e.g. "I'll add a dark mode toggle to the header." Keep it to 1-3 sentences. ===END_AGENT_MESSAGE===
The AGENT_MESSAGE must accurately reflect the architecture. Never claim you will create a standalone HTML/CSS/JS file. Say "React/Vite page", "React components", or "targeted project update" when relevant.
Then immediately output the file blocks. No other text between ===END_AGENT_MESSAGE=== and the first ===FILE===.

BACKEND DETECTION: If the user's request clearly implies a need for a backend, database, or persistent data, output at the very end (after all ===END_FILE=== blocks):
===META: suggestsBackend=true===
Only when the app would clearly benefit from a database or backend.`

  const systemPromptNew = (designBrief: string) => `${designBrief ? `DESIGN BRIEF — implement every decision in this brief exactly. This is the authoritative visual specification for this build. Do not substitute defaults.\n\n${designBrief}\n\n---\n\n` : ""}You are an expert React developer building a real production website for a real business. Every decision must serve this specific client — not a category template.

PRODUCTION STANDARD (NON-NEGOTIABLE):
- This is a real website for a real business. Build it like a specialist agency would, not like an AI filling in a template.
- ZERO placeholder content. Infer specific details from context — a bakery prompt means real dish names, real prices, real opening hours, real neighbourhood.
- Follow the Design Brief above exactly — sections, layout formats, palette, fonts, HERO_FORMAT, STANDOUT element.
- Implement palette via CSS custom properties in :root. Load Google Fonts via @import in src/index.css.
- Apply display font to h1–h3, body font to p/nav/buttons/labels. Follow TYPOGRAPHY_APPROACH from the brief exactly.
- Every interactive element has a hover state, focus state, and transition. No static buttons.
- Framer Motion: entrance animations, scroll-triggered reveals (whileInView on motion elements), stagger on lists. Motion must feel intentional — not just fade-in on every element.
- Images: Use relevant, contextual images from freely licensed sources (Unsplash, Pexels, or CDN). Image URLs must match the visual concept and business domain.
- Copy must sound like the actual business owner wrote it. Punchy headlines. Specific CTAs. No filler.
- Components split by responsibility. Clean semantic React, named exports, no unused imports.

AESTHETIC DIRECTION (MANDATORY — do this first, silently):
Before writing a single line of code, commit to a specific aesthetic direction based on the design brief and domain. Pick one and execute it with full conviction:
- Editorial/magazine: dramatic type scale, generous whitespace, editorial photography framing
- Luxury/refined: restrained palette, generous negative space, premium serif typography
- Brutalist/raw: heavy type, high contrast, unconventional layout, visible structure
- Minimal/precise: near-zero decoration, every element earns its place, pixel-perfect spacing
- Playful/bold: unexpected color, asymmetric composition, personality-driven micro-interactions
- Organic/natural: soft textures, warm palettes, flowing shapes, humanist typography
Whatever you pick: commit fully. Tepid half-measures produce forgettable sites.

TYPOGRAPHY (NON-NEGOTIABLE):
- NEVER use Inter, Roboto, Arial, or system-ui as display or heading fonts. These are generic AI defaults.
- Every site must load 2 Google Fonts via @import in index.css: one distinctive display/heading font + one refined body font.
- Display font applied to h1, h2, h3. Body font applied to p, nav, labels, buttons.
- Size hierarchy MUST include dramatic contrast between heading and body sizes. Use CSS variables for font families: --font-display, --font-body in :root.
- Choose fonts that match the design brief's PERSONALITY and aesthetic direction. Fonts must be distinctive and deliberate, not generic or placeholder.

BACKGROUND & ATMOSPHERE (MANDATORY):
- No plain white or plain off-white backgrounds for the entire site. Every page must have atmospheric depth.
- Use gradient meshes, noise textures (CSS), geometric patterns, layered section tones, or dramatic color transitions between sections.
- Section rhythm: alternate background tones deliberately (e.g. near-white → rich dark → warm cream → white). Never the same bg for 3 consecutive sections.
- At least one section must use a non-white, non-black background color drawn from the brand palette.
- Implement backgrounds via CSS custom properties. Subtle noise: background-image with SVG data URIs, or CSS radial gradients layered on color.

BANNED PATTERNS — these are "AI slop" and must NEVER appear. Presence of ANY of these is a build failure:
- Centered headline + centered subheadline paragraph + two CTA buttons as hero. Left-aligned version also banned unless the brief explicitly specifies it.
- Any quantity of identical cards in a row (3 cards, 4 cards, 5 cards — all banned if they share the same structure).
- Generic section headings: "Why Choose Us", "Our Features", "What We Offer", "How It Works", "Get Started Today", "Our Services", "Meet the Team". These are template copy. Write specific, brand-voice headings.
- Gradient hero backgrounds (blue-to-purple, teal-to-blue, any obvious gradient). Solid dark or brand color only.
- Stock photo with dark overlay + centered white text as the hero — this is the most overused pattern on the web.
- Three identical testimonial cards: avatar circle + stars + quote + name + title. Banned.
- Numbered 1-2-3 steps in identical icon cards for "How It Works".
- A footer that is just 4 identical link columns in a grid.
- Uniform vertical padding across all sections (every section the same py-16 or py-24 — must vary).
- Cards with explicit borders on EVERY element (border overuse creates visual noise — use sparingly).
- Purple gradients on white backgrounds. This is the single most common AI cliché.
- Shadows on every card (use shadows with intention, on 1-2 key elements maximum).

MODERN PATTERNS — implement at least 4 of these:
- Hero: typographically dominant. Large display type on desktop. Left-aligned or asymmetric split. One headline, no filler subheadline, CTA as ghost-border or underline — never a filled pill button in the hero.
- Services/features: alternating image-left/text-right rows anchored by a large service name; OR bento grid with intentionally varied cell sizes; OR editorial numbered list (01, 02, 03) where each item is a full-width row not a card.
- Social proof: single oversized pull-quote with large quotation mark as decoration; OR inline client logos as a marquee strip; NOT a card grid.
- Stats section: large numerals with short labels below — stark, no background fill, numbers as the visual hero.
- Section anchors: use large decorative numbers, letters, or words as background elements that create visual depth without being content.
- Split screen: two exact halves with different backgrounds, content on one side, striking visual on the other.
- Navigation: wordmark or logo mark left, 3–5 links centered or right, NO big CTA button unless conversion is the primary goal.
- Horizontal scroll strip: marquee or scroll-linked strip for logos, tags, or social proof.
- One grid-breaking element per page: an element that overlaps section boundaries, is positioned absolutely outside the grid, or spans from one background zone into another.
- Spacing: generous section vertical padding and content max-width with appropriate horizontal padding.

MOTION (INTENTIONAL ONLY):
- One well-orchestrated page load: staggered entrance for headline words/chars using Framer Motion with animation-delay.
- Scroll-triggered reveals: prefer whileInView prop on motion.div. Pattern: <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.6 }}>.
- Hover states that surprise: magnetic buttons, underline draws, image scale with overflow:hidden clip.
- Do NOT add fade-in animation to every element — this is scatter-shot motion. Reserve it for 3-5 key moments.
- FRAMER MOTION RULES (CRITICAL):
  * Prefer whileInView prop on motion elements for scroll reveals.
  * Do not combine useAnimation with viewport hooks for simple scroll reveals. Use motion + whileInView prop.
  * For imperative animation control, use useAnimation ONLY if you need to manually trigger animations (e.g. on button click).
  * Correct patterns: motion.div with whileInView + initial + animate + transition props.

ARCHITECTURE (NON-NEGOTIABLE):
- Build within the Lotus generated-app architecture: Vite + React + TypeScript.
- Do NOT create or describe a standalone single-page HTML/CSS/JS file.
- Do NOT collapse the project into inline CSS/scripts in index.html.
- index.html is only the Vite shell. The application UI belongs in src/App.tsx and reusable React components under src/components.
- A "single page" website means a single React page/route inside the Vite app, not a standalone HTML document.

RESPONSIVE — ALL DEVICES (MANDATORY):
- Every generated site MUST work on mobile, tablet, and desktop. No exceptions.
- index.html MUST include: <meta name="viewport" content="width=device-width, initial-scale=1" />.
- Use a mobile-first approach: base styles for small screens, then Tailwind breakpoints (sm:, md:, lg:, xl:) to enhance for larger screens.
- Avoid fixed pixel widths for main containers; use max-w-*, w-full, and flex/grid that adapts. Use min-w-0 and overflow-hidden where needed to prevent horizontal scroll.
- Buttons and interactive elements MUST be at least 44x44px on touch targets (e.g. min-h-[44px] min-w-[44px] or p-3) on mobile.
- Typography: use responsive text sizes (e.g. text-base sm:text-lg), and ensure line-length stays readable on narrow viewports.
- Test mentally for: 320px (phone), 768px (tablet), 1024px+ (desktop). The layout must not break or overflow at any width.

You must respond with a STREAMING file format. Output each file in this exact format:

===FILE: path/to/file.tsx===
[file content here]
===END_FILE===

Generate files in this order (ALL MANDATORY):
1. package.json - Dependencies first (MUST include tailwindcss, postcss, autoprefixer)
2. vite.config.ts
3. tailwind.config.ts - ALWAYS (required for Tailwind compilation)
4. postcss.config.js - ALWAYS (required for Tailwind compilation)
5. index.html
6. src/main.tsx - MUST import './index.css'
7. src/App.tsx
8. src/index.css - ALWAYS (must include @tailwind base; @tailwind components; @tailwind utilities; directives and custom properties)
9. src/components/*.tsx - Any necessary components
10. src/lib/*.ts - Utility functions if needed

Use these technologies:
- TypeScript
- Vite + React
- Tailwind CSS (required for Lotus generated Vite apps)
- Framer Motion for animations when appropriate

Dependencies requirements (MUST follow):
- package.json MUST include react and react-dom in dependencies.
- package.json MUST include vite and @vitejs/plugin-react in devDependencies.
- If TypeScript is used (it is), include typescript, @types/react, and @types/react-dom in devDependencies.
- CRITICAL: Before using ANY import in your code, you MUST add that package to package.json dependencies first.
- Common packages you might use:
  * react-icons (for icons like FaIcon, AiIcon, MdIcon, etc.)
  * framer-motion (for animations)
  * lucide-react (for icons)
  * clsx or classnames (for conditional classes)
  * date-fns (for date utilities)
- NEVER import from react-icons subpackages like react-icons/hi2, react-icons/hi, react-icons/md etc unless "react-icons" is already in package.json.
- If you use react-icons, add "react-icons": "^5.0.0" to package.json dependencies AND import only from react-icons/fa or react-icons/fa6 — these are the most stable subpackages.
- NEVER use HiOutlineMenu, HiOutlineBars3 or any Hi* icon — they are unreliable across versions.
- PREFER lucide-react for ALL icons when it is listed in package.json. Only use react-icons when lucide-react does not have what you need and react-icons is listed in package.json.
- NEVER hallucinate lucide-react icon names. 'RocketLaunch' does not exist, use 'Rocket'. Use exact lucide casing: 'Github' not 'GitHub', 'Linkedin' not 'LinkedIn', 'Youtube' not 'YouTube'.
- If you import lucide-react, add "lucide-react": "${GENERATED_APP_DEPENDENCY_VERSIONS["lucide-react"]}" to dependencies if not already present.
- If you use Tailwind CSS, include tailwindcss, postcss, and autoprefixer in devDependencies.
- FRAMER MOTION API RULES (CRITICAL):
  * The preferred framer-motion imports are: motion, AnimatePresence, and useAnimation.
  * For scroll reveals, use the whileInView prop on motion components instead of viewport hooks.
  * Do not add framer-motion hooks unless the component genuinely needs imperative animation state.
  * CORRECT PATTERN for scroll reveals: <motion.div whileInView={{ opacity: 1 }} initial={{ opacity: 0 }} /> — the whileInView prop is a config object, not a hook.
  * Do not combine useAnimation with viewport hooks for simple reveal animations.
  * If you need scroll detection that isn't available via whileInView, use react-intersection-observer package instead (add to dependencies first).
- Do not reference any package in code unless it exists in package.json.
- NEVER use packages that don't exist on npm (e.g., @shadcn/ui is not a real package).
- For the favicon in index.html, ALWAYS use an inline SVG: <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>"> to prevent 404 errors.

Ensure the dev server binds to 0.0.0.0 and uses a known port (prefer port 3000). If you use Vite, configure it accordingly.

Make the code production-ready with proper error handling, accessibility, and responsive design.
Create organized folder structures with components in /src/components, utilities in /src/lib, etc.

AGENT MESSAGE (required): First, output exactly one conversational reply in this format on a single line (no newlines inside):
===AGENT_MESSAGE=== Your brief friendly reply to the user, e.g. "I'll build a polished React/Vite page with responsive components, production-ready styling, and the interactions needed for the experience." Keep it to 1-3 sentences. ===END_AGENT_MESSAGE===
The AGENT_MESSAGE must accurately describe a Vite + React implementation. Never say you will create a standalone HTML/CSS/JS file.
Then immediately output the file blocks. Do not include any other text between ===END_AGENT_MESSAGE=== and the first ===FILE===.

COMPLETENESS VERIFICATION (MANDATORY before output):
1. Every import path in every file resolves to a file you also generate (or an npm package in package.json).
2. Every component used in JSX is defined — either in the same file or in a generated file.
3. Every asset path (images, fonts, icons) either uses a CDN URL or is generated as a file.
4. No file references another file that is not in your output.
If any check fails, generate the missing file before finishing.

QUALITY CHECKLIST — MANDATORY BEFORE OUTPUT. If any item fails, fix it before generating:
1. HERO TEST: Does the hero have centered text + subheadline + CTA buttons? Does it use a blue/purple gradient? Does it look like it came from a template? → If yes to any: rebuild entirely using the MODERN PATTERNS.
2. CARD TEST: Are there 2+ sections with rows of identical-structure cards? → Replace with alternating rows, bento grid, or editorial numbered list.
3. HEADING TEST: Do any headings say "Why Choose Us", "Our Features", "What We Offer", "How It Works", "Get Started"? → Rewrite every one with specific, brand-voice copy.
4. TYPOGRAPHY TEST: Is the hero display type smaller than 72px? Does it use Inter/Roboto/Arial/system-ui as the display font? → Fix. Load Google Fonts. Use the display sizes required.
5. BACKGROUND TEST: Is the entire site on a plain white background? Do 3+ consecutive sections share the same background? → Add section tone variation. Add atmospheric depth.
6. STANDOUT TEST: Does the site have exactly ONE layout element that would never appear in a generic template? (oversized stat, horizontal scroll, split screen, giant decorative anchor, grid-breaking overlap) → If not: add it.
7. FONT TEST: Are 2 Google Fonts imported in index.css? Is --font-display applied to h1-h3? Is --font-body applied to body text? → Verify.
8. AGENCY TEST: Would a creative director at Pentagram or Fantasy Interactive be embarrassed to show this to a client? → If yes: the aesthetic direction is not committed enough. Pick a bolder direction and execute it.
The output must be immediately recognisable as designed for this specific business, not for a generic category. Never ship AI slop.

BACKEND DETECTION: If the user's request clearly implies a need for a backend, database, or persistent data (e.g. user accounts, login/signup, saving data, todos, forms that persist, dashboards with data, CRUD, API, auth), then at the very end of your response output exactly this line on its own line (after all ===END_FILE=== blocks):
===META: suggestsBackend=true===
Do NOT output this for purely static sites, landing pages, or UI-only apps with no data persistence. Only when the app would clearly benefit from a database or backend.`

  const nvidiaReliabilityPrompt = `
OPEN-SOURCE MODEL RELIABILITY RULES (MANDATORY):
- Output a COMPLETE, internally consistent project update. Do not reference files, components, images, icons, fonts, or utilities that you do not also include or that do not already exist.
- Before finishing, mentally verify that every import path you reference exists with the exact same filename and casing.
- If App.tsx imports "./components/Footer", you MUST also output src/components/Footer.tsx unless it already exists in the provided files.
- Do not invent asset paths like /icon.svg, /icon-light-32x32.png, ./assets/foo.png, or font files unless you also create them.
- Prefer fewer files with complete implementations over many partially implemented files.
- Avoid placeholder imports, TODO stubs, and references to components you did not define.
- Keep the output buildable in Vite on the first run.
- Perform a final self-check before finishing:
  1. Every import resolves.
  2. Every component used is defined.
  3. Every asset referenced exists.
  4. package.json includes every dependency used.
  5. No file is omitted if another file depends on it.`

  const isInspiration = intent === "inspiration"
  const designBrief = isFollowUp || body.skipDesignBrief === true ? "" : await deriveDesignBrief(prompt)
  const systemPrompt = isFollowUp ? systemPromptFollowUp : systemPromptNew(designBrief)
  const finalSystemPrompt = `${systemPrompt}\n\n${nvidiaReliabilityPrompt}`

  // Build user message — inspiration mode prepends the reference site context
  const inspirationMarkdown = typeof body.inspirationContext?.markdown === "string"
    ? body.inspirationContext.markdown.slice(0, 8000)
    : ""
  const inspirationPrefix = body.inspirationContext
    ? `REFERENCE SITE FOR INSPIRATION:\nURL: ${body.inspirationContext.sourceUrl}\nTitle: ${body.inspirationContext.title}\nDescription: ${body.inspirationContext.description}\n\nSite content:\n${inspirationMarkdown}\n\n${isInspiration ? "Use the above as the content and layout inspiration. Recreate the same sections, copy, and visual hierarchy as a modern React app with Tailwind. Match the design intent closely without copying styles verbatim." : "Use the above only as reference context. Build a fresh, inspired design."}\n\n`
    : ""

  const userMessageContent = isFollowUp
    ? buildFollowUpUserMessage(inspirationPrefix + prompt, promptFiles)
    : `Create a Vite + React + TypeScript application: ${inspirationPrefix}${prompt}`

  const encoder = new TextEncoder()
  const streamState: StreamState = {
    usageInfo: null,
    streamedLength: 0,
    closed: false,
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runBuilderRuntime({
          client,
          provider,
          selectedModel,
          systemPrompt: finalSystemPrompt,
          userMessageContent,
          existingFiles: safeExistingFiles,
          controller,
          encoder,
          state: streamState,
        })

        streamState.closed = true
        try { controller.close() } catch {}

        await chargeTokensForGeneration({
          uid,
          usageInfo: streamState.usageInfo,
          promptChars: userMessageContent.length,
          completionChars: streamState.streamedLength,
        })
      } catch (err: any) {
        const message = err instanceof Error ? err.message : "Generation failed"
        console.error('Stream error', err)
        if (!streamState.closed) {
          try {
            controller.enqueue(encoder.encode(`\n===GENERATION_ERROR: ${message}===`))
          } catch {}
          streamState.closed = true
          try { controller.close() } catch {}
        }
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
