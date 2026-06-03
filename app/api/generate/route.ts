import OpenAI from "openai"
import { adminAuth, adminDb } from "@/lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"
import { DEFAULT_PLANS } from "@/lib/firebase"
import { normalizeGeneratedCodeFiles } from "@/lib/generated-code-normalization"
import { chargeTokensForGeneration } from "@/lib/charge-tokens"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || process.env.NGC_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
})

const DEFAULT_MODEL = "GPT-5.5"
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
  "GPT-4-1 Mini": "gpt-4.1-mini",
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
    if (!path || seen.has(path)) return false
    seen.add(path)
    return true
  })
}

function isCoreContextFile(path: string) {
  const normalizedPath = path.replace(/\\/g, "/").toLowerCase()
  return (
    normalizedPath === "app.tsx" ||
    normalizedPath === "main.tsx" ||
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
  const fileRegex = /===FILE:\s*(.*?)===([\s\S]*?)===END_FILE===/g
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

function serializeFileBlocks(files: ParsedFileBlock[]) {
  return files.map((file) => `===FILE: ${file.path}===\n${file.content}\n===END_FILE===`).join("\n")
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

function validateGeneratedFiles(generatedContent: string, existingFiles?: { path: string; content: string }[]) {
  const fileBlocks = parseFileBlocks(generatedContent)
  const availablePaths = new Set([
    ...fileBlocks.map((file) => file.path),
    ...(existingFiles || []).map((file) => file.path),
    "src/main.tsx",
    "src/index.css",
    "src/App.tsx",
    "vite.config.ts",
    "package.json",
    "index.html",
  ])
  const issues = new Set<string>()

  // Check for mandatory CSS files
  const hasIndexCss = fileBlocks.some(f => f.path === "src/index.css")
  const hasTailwindConfig = fileBlocks.some(f => f.path === "tailwind.config.ts")
  const hasPostcssConfig = fileBlocks.some(f => f.path === "postcss.config.js")
  
  if (!hasIndexCss) {
    issues.add("Missing mandatory file: src/index.css (required for CSS styling)")
  }
  if (!hasTailwindConfig) {
    issues.add("Missing mandatory file: tailwind.config.ts (required for Tailwind compilation)")
  }
  if (!hasPostcssConfig) {
    issues.add("Missing mandatory file: postcss.config.js (required for PostCSS processing)")
  }

  for (const file of fileBlocks) {
    const isCodeFile = /\.(tsx|ts|jsx|js)$/.test(file.path)
    if (!isCodeFile) continue

    const importRegex = /from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(file.content)) !== null) {
      const rawImport = match[1] || match[2]
      if (!rawImport) continue

      const importerDir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ""
      const normalizedBase = rawImport
        .replace(/^\.\//, importerDir ? `${importerDir}/` : "")
        .replace(/\.\.\//g, "")
      const candidatePaths = [
        normalizedBase,
        `${normalizedBase}.ts`,
        `${normalizedBase}.tsx`,
        `${normalizedBase}.js`,
        `${normalizedBase}.jsx`,
        `${normalizedBase}.css`,
        `${normalizedBase}/index.ts`,
        `${normalizedBase}/index.tsx`,
      ]

      const hasMatch = candidatePaths.some((candidate) => availablePaths.has(candidate))
      if (!hasMatch) {
        issues.add(`Missing import target "${rawImport}" referenced from ${file.path}`)
      }
    }

    const missingAssetMatches = file.content.match(/["'](?:\/|\.\/)[^"']+\.(svg|png|jpg|jpeg|webp|gif|ico)["']/g) || []
    for (const asset of missingAssetMatches) {
      const assetPath = asset.slice(1, -1)
      const normalizedAssetPath = assetPath.startsWith("/")
        ? `public${assetPath}`
        : `${file.path.slice(0, Math.max(file.path.lastIndexOf("/"), 0))}/${assetPath.replace(/^\.\//, "")}`
      if (!availablePaths.has(normalizedAssetPath) && !availablePaths.has(assetPath)) {
        issues.add(`Missing asset "${assetPath}" referenced from ${file.path}`)
      }
    }
  }

  return {
    fileBlocks,
    issues: Array.from(issues),
  }
}

function injectMissingCssFiles(fileBlocks: ParsedFileBlock[]): ParsedFileBlock[] {
  const paths = new Set(fileBlocks.map(f => f.path))
  const injected = [...fileBlocks]

  // Inject missing tailwind.config.ts
  if (!paths.has("tailwind.config.ts")) {
    injected.push({
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config`
    })
  }

  // Inject missing postcss.config.js
  if (!paths.has("postcss.config.js")) {
    injected.push({
      path: "postcss.config.js",
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    })
  }

  const TAILWIND_DIRECTIVES = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
  const DEFAULT_INDEX_CSS = `${TAILWIND_DIRECTIVES}
:root {
  --radius: 12px;
  --radius-lg: 16px;
  --container: 72rem;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}`

  // Inject missing src/index.css, or prepend @tailwind directives if they're absent
  const indexCssIdx = injected.findIndex(f => f.path === "src/index.css")
  if (indexCssIdx === -1) {
    injected.push({ path: "src/index.css", content: DEFAULT_INDEX_CSS })
  } else if (!injected[indexCssIdx].content.includes("@tailwind")) {
    injected[indexCssIdx] = {
      ...injected[indexCssIdx],
      content: `${TAILWIND_DIRECTIVES}\n${injected[indexCssIdx].content}`,
    }
  }

  // Ensure src/main.tsx imports index.css
  const mainTsxIndex = injected.findIndex(f => f.path === "src/main.tsx")
  if (mainTsxIndex !== -1 && !injected[mainTsxIndex].content.includes("index.css")) {
    const lines = injected[mainTsxIndex].content.split('\n')
    let insertIdx = 0
    for (let i = 0; i < lines.length; i++) {
      if (/import\s+.*react/i.test(lines[i])) insertIdx = i + 1
    }
    lines.splice(insertIdx, 0, "import './index.css'")
    injected[mainTsxIndex] = { ...injected[mainTsxIndex], content: lines.join('\n') }
  }

  return injected
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
    max_tokens: 8000,
  })

  let finalContent = initial.choices[0]?.message?.content || ""
  let usageInfo: any = initial.usage || null
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
      max_tokens: 8000,
    })

    finalContent = retried.choices[0]?.message?.content || ""
    usageInfo = retried.usage || usageInfo
    assertValidFileBlockOutput(finalContent)
  }

  let validation = validateGeneratedFiles(finalContent, params.existingFiles)

  if (validation.issues.length > 0) {
    const repairPrompt = `Your previous output had build-breaking issues. Repair the project and return the complete corrected response in the exact same streaming file format.

Detected issues:
${validation.issues.map((issue) => `- ${issue}`).join("\n")}

Rules:
- Keep the same app intent and design direction.
- CRITICAL: Ensure src/index.css, tailwind.config.ts, and postcss.config.js are included and properly configured.
- Ensure src/main.tsx imports './index.css' at the top.
- Fix all missing imports, missing components, and missing assets.
- Do not explain the fixes.
- Return exactly one AGENT_MESSAGE and the corrected file blocks only.
- Do not wrap files in JSON or markdown.`

    const repaired = await params.client.chat.completions.create({
      model: params.selectedModel,
      messages: [
        { role: "system", content: `${params.systemPrompt}\n\nYou must repair invalid output when issues are reported.` },
        { role: "user", content: params.userMessageContent },
        { role: "assistant", content: finalContent },
        { role: "user", content: repairPrompt },
      ],
      max_tokens: 8000,
    })

    finalContent = repaired.choices[0]?.message?.content || finalContent
    usageInfo = repaired.usage || usageInfo
    validation = validateGeneratedFiles(finalContent, params.existingFiles)
  }

  // Inject missing CSS files as fallback
  let finalFileBlocks = validation.fileBlocks
  if (!finalFileBlocks.some(f => f.path === "tailwind.config.ts") ||
      !finalFileBlocks.some(f => f.path === "postcss.config.js") ||
      !finalFileBlocks.some(f => f.path === "src/index.css")) {
    finalFileBlocks = injectMissingCssFiles(finalFileBlocks)
    // Reconstruct content from injected blocks
    finalContent = serializeFileBlocks(finalFileBlocks)
  }

  finalFileBlocks = normalizeGeneratedCodeFiles(finalFileBlocks)
  finalContent = serializeFileBlocks(finalFileBlocks)

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
          content: `You are a senior design director at a world-class digital agency (think Pentagram, Instrument, Fantasy Interactive). Given a website build request, produce a specific, committed design brief that will produce a distinctive, editorial-grade website — not a generic AI template.

Rules:
- Draw on real-world knowledge of what excellent designers actually produce for this exact type of business.
- If the user mentioned colors, fonts, style words, or visual references — treat those as hard constraints that override everything else.
- If the user said nothing about style — reason from brand positioning: who they need to impress, what makes them credible, what aesthetic their best competitors occupy.
- Every decision must be specific: exact hex values, exact font names, exact layout descriptions. "Warm tones" is not a decision. "#f5ede0 background with #c4783c accent" is a decision. "big hero with text" is not a decision. "full-bleed near-black background, 96px left-aligned display type, no subheadline, single underlined CTA" is a decision.
- No filler. No padding. Output only the brief.

CRITICAL: The brief must produce a site that looks nothing like a generic AI template. Banned defaults: gradient hero with centered text + subheadline, three identical feature cards, "Why Choose Us" headings, cookie-cutter testimonial card grids. Think editorial. Think considered spacing. Think typographic hierarchy as the primary design tool.

Output this exact structure (plain text, no markdown):
PALETTE: [brand hex] [accent hex] [background hex] [text hex] [muted-surface hex]
FONTS: [display font] + [body font] (both must be on Google Fonts)
PERSONALITY: [3 specific adjectives describing the visual tone]
HERO_FORMAT: [exact hero layout — e.g. "full-bleed near-black bg, 104px display type left-aligned, one-line headline only, no subtext block, ghost-border CTA button bottom-left"]
HERO_HEADLINE: [actual headline written for this specific business — punchy, brand-voice, under 8 words]
SECTIONS: [ordered list — each entry must be: SectionName: specific-layout-description — e.g. "Services: alternating image-left/text-right rows with large italic service name as section anchor"]
TYPOGRAPHY_APPROACH: [specify display size range, label style, body size — e.g. "display 80-120px, section labels 10px uppercase tracked 0.18em, body 16px/1.75"]
STANDOUT: [one unexpected layout or composition decision that makes this site memorable and non-generic]
ANTI_PATTERN: [describe the clichéd AI-template version of this exact site to actively avoid]`,
        },
        {
          role: "user",
          content: prompt.slice(0, 1500),
        },
      ],
      max_tokens: 520,
      temperature: 0.4,
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
  const salvagePrompt = `Repair the broken project output below and return a fully corrected response in the exact required file streaming format.

Detected issues:
${params.issues.map((issue) => `- ${issue}`).join("\n")}

Broken output:
${params.brokenContent}

Rules:
- Keep the same product request and overall intent.
- CRITICAL: Ensure src/index.css, tailwind.config.ts, and postcss.config.js are included and properly configured.
- Ensure src/main.tsx imports './index.css' at the top.
- Return exactly one AGENT_MESSAGE and then only ===FILE=== blocks.
- Ensure every import resolves and every referenced component exists.
- Do not leave placeholders or missing files.`

  const repaired = await openai.chat.completions.create({
    model: OPENAI_MODEL_MAP[DEFAULT_MODEL],
    messages: [
      { role: "system", content: `${params.systemPrompt}\n\nYou are repairing an invalid project output into a buildable final result.` },
      { role: "user", content: params.userMessageContent },
      { role: "user", content: salvagePrompt },
    ],
    max_tokens: 8000,
  })

  let content = repaired.choices[0]?.message?.content || params.brokenContent
  
  // Inject missing CSS files if needed
  const fileBlocks = parseFileBlocks(content)
  if (!fileBlocks.some(f => f.path === "tailwind.config.ts") ||
      !fileBlocks.some(f => f.path === "postcss.config.js") ||
      !fileBlocks.some(f => f.path === "src/index.css")) {
    const injectedBlocks = injectMissingCssFiles(fileBlocks)
    content = injectedBlocks.map(f => `===FILE: ${f.path}===\n${f.content}\n===END_FILE===`).join('\n')
  }

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
    max_tokens: 8000,
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

  const createOpenAICompletion = async (userMessage: string) => {
    const controllerAbort = new AbortController()
    const timeoutId = setTimeout(() => {
      controllerAbort.abort()
    }, OPENAI_TIMEOUT_MS)

    try {
      const completion = await params.client.chat.completions.create({
        model: params.selectedModel,
        stream: true,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 8000,
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
    for await (const chunk of completion) {
      if ((chunk as any).usage) params.state.usageInfo = (chunk as any).usage
      const content = chunk.choices?.[0]?.delta?.content
      if (!content) continue
      buffered += content
      if (!params.state.closed) {
        try { params.controller.enqueue(params.encoder.encode(content)) }
        catch { params.state.closed = true }
      }
    }
    return buffered
  }

  let basePrompt = params.userMessageContent
  if (params.userMessageContent.includes("\n\nCurrent project files")) {
    basePrompt = params.userMessageContent.split("\n\nCurrent project files")[0]
  }

  let completion
  try {
    completion = await createOpenAICompletion(params.userMessageContent)
  } catch (err: any) {
    if (err?.message === "MODEL_TIMEOUT" && params.existingFiles?.length) {
      const retrySeedFiles = selectRelevantFiles(params.existingFiles, params.userMessageContent)
      const reducedFiles = trimPromptFilesToBudget(
        params.userMessageContent,
        retrySeedFiles.slice(0, Math.max(2, Math.ceil(retrySeedFiles.length / 2)))
      )
      completion = await createOpenAICompletion(buildFollowUpUserMessage(basePrompt, reducedFiles))
    } else {
      throw err
    }
  }

  const output = await streamTokens(completion)
  params.state.streamedLength += output.length

  // Append any missing CSS infrastructure as extra file blocks at the end of the stream.
  // parseGenerateResponse in the computer agent buffers the full stream, so these are included.
  const parsedBlocks = parseFileBlocks(output)
  const allKnownPaths = new Set([
    ...parsedBlocks.map(f => f.path),
    ...(params.existingFiles?.map(f => f.path) || [])
  ])
  const needsCssFix =
    !allKnownPaths.has("tailwind.config.ts") ||
    !allKnownPaths.has("postcss.config.js") ||
    !allKnownPaths.has("src/index.css") ||
    (parsedBlocks.some(f => f.path === "src/index.css") && !parsedBlocks.find(f => f.path === "src/index.css")?.content.includes("@tailwind")) ||
    (parsedBlocks.some(f => f.path === "src/main.tsx") && !parsedBlocks.find(f => f.path === "src/main.tsx")?.content.includes("index.css"))

  if (needsCssFix) {
    const fixedBlocks = injectMissingCssFiles(parsedBlocks)
    const newFiles = fixedBlocks.filter(b => !parsedBlocks.find(p => p.path === b.path))
    if (newFiles.length && !params.state.closed) {
      try { params.controller.enqueue(params.encoder.encode(serializeFileBlocks(normalizeGeneratedCodeFiles(newFiles)))) }
      catch { params.state.closed = true }
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
    inspirationContext?: { title: string; description: string; markdown: string; sourceUrl: string }
  } | null
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const {
    prompt,
    model = DEFAULT_MODEL,
    idToken,
    existingFiles,
    intent,
  } = body

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

  const { client, selectedModel, provider } = await resolveModel(model)
  const isFollowUp = Array.isArray(existingFiles) && existingFiles.length > 0
  let promptFiles = isFollowUp ? selectRelevantFiles(existingFiles || [], prompt) : []

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
- FEATURE: return only files that need new imports, state, or logic. Do not rewrite files that only need 1-2 line changes — use diffs instead.
- PAGE/REFACTOR: still do not rewrite unchanged files.

HARD RULES:
- Never rewrite a file just to "clean it up"
- Never return package.json unless a new dependency is genuinely needed
- If a file needs fewer than 5 line changes, use unified diff format not full file
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
- New sections must follow the same typographic scale and spacing rhythm already present (generous padding, large display type, deliberate hierarchy).
- Never add a section that falls into the AI slop patterns: 3 identical feature cards, centered banner CTA, gradient hero, generic testimonial card grid.
- Prefer asymmetric or editorial layout formats when adding new content — alternating rows, large anchor numerals, bento grids.
- Motion must be intentional: scroll-triggered reveals (useInView) and stagger effects, not just fade-in on everything.

RESPONSIVE: Preserve or improve responsiveness on all devices. Use Tailwind breakpoints (sm:, md:, lg:) for layout and typography; avoid fixed widths that break on small screens; ensure touch targets are at least 44px on mobile; prevent horizontal overflow (max-w-full, min-w-0, overflow-hidden where needed). Generated UI must work on phone, tablet, and desktop.

DEPENDENCIES (CRITICAL):
- Before using ANY new import/package in your code, you MUST add it to package.json dependencies or devDependencies.
- NEVER import from react-icons subpackages like react-icons/hi2, react-icons/hi, react-icons/md etc unless "react-icons" is already in package.json.
- If you use react-icons, add "react-icons": "^5.0.0" to package.json dependencies AND import only from react-icons/fa or react-icons/fa6 — these are the most stable subpackages.
- NEVER use HiOutlineMenu, HiOutlineBars3 or any Hi* icon — they are unreliable across versions.
- PREFER lucide-react for ALL icons. It is always available and has zero subpackage issues. Only use react-icons when lucide-react does not have what you need.
- NEVER hallucinate lucide-react icon names. 'RocketLaunch' does not exist, use 'Rocket'. Use exact lucide casing: 'Github' not 'GitHub', 'Linkedin' not 'LinkedIn', 'Youtube' not 'YouTube'.
- If you import lucide-react, add "lucide-react": "^0.400.0" to dependencies if not already present.
- If you use framer-motion, add "framer-motion": "^11.0.0" to dependencies.
- Check the existing package.json first. Only add packages that are truly needed and don't already exist.
- NEVER use packages that don't exist on npm (e.g., @shadcn/ui).
- For the favicon in index.html, ALWAYS use an inline SVG: <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>"> to prevent 404 errors.

CRITICAL: Do NOT regenerate the entire project. Output ONLY:
1. One AGENT_MESSAGE (see below).
2. For each file that you MODIFY: output that file in ===FILE: path=== ... ===END_FILE===. Inside the block you may use EITHER:
   - Unified diff format (so only the change is applied). You MUST include the --- and +++ file header lines first; never output only @@ hunk lines:
     --- a/path/to/file.tsx
     +++ b/path/to/file.tsx
     @@ -start,count +start,count @@
     -old line
     +new line
   - OR the COMPLETE new file content (full replacement).
3. For each NEW file (file that does not exist yet): output ===FILE: path=== complete file content ===END_FILE===.
Do NOT output any file that is unchanged. Do NOT output the full project; only changed or new files.

Use this exact streaming format for every file you output:
===FILE: path/to/file.tsx===
[unified diff OR full file content]
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
- Framer Motion: entrance animations, scroll-triggered reveals (useInView), stagger on lists. Motion must feel intentional — not just fade-in on every element.
- Images: real Unsplash URLs https://images.unsplash.com/photo-[ID]?w=1200&q=80&auto=format&fit=crop — IDs must genuinely match content.
- Copy must sound like the actual business owner wrote it. Punchy headlines. Specific CTAs. No filler.
- Components split by responsibility. Clean semantic React, named exports, no unused imports.

BANNED PATTERNS — these are "AI slop" and must never appear:
- Hero section: centered headline + centered subheadline paragraph + two side-by-side CTA buttons. This is the #1 AI cliché.
- Three identical feature cards in a row: [icon on top] [heading] [short paragraph] × 3. Use a different layout.
- "Why Choose Us", "Our Features", "What We Offer", "Get Started Today" as section headings — these are template copy.
- Gradient backgrounds on hero sections (blue-to-purple, teal-to-blue, etc.).
- Stock photo with dark overlay + centered white text on top as the entire hero.
- Testimonials as three identical cards with avatar circle + star rating + quote + name + title.
- "How It Works" as three numbered steps in identical cards or a numbered list with icons.
- A CTA section that is just a solid-color banner with centered heading + one button.
- Uniform section padding — every section the same height and density looks flat.
- Borders on every card — overuse of card borders creates visual noise.

MODERN PATTERNS — use these instead:
- Hero: full-bleed, typographically led. Large display type (min 72px, ideally 96–120px). Left-aligned or split asymmetric. One strong headline — no filler subheadline block. CTA as a simple underlined link or ghost-border button, not a filled pill.
- Feature/services: use alternating image+text rows with a large italic or light-weight service name as the visual anchor; OR an editorial grid with varied card sizes (bento); OR a two-column table-style list with numbers; NOT three identical cards.
- Social proof: a single oversized pull quote at editorial scale (64px+) + attribution; OR a horizontal logo marquee for brand logos; NOT a 3-card testimonial grid.
- Section rhythm: vary background tone between sections (e.g., white → near-black → warm off-white → white). This creates structure without decorative dividers.
- Typography: use dramatic size contrast — display headings at 80–120px alongside 12–14px labels. Mix font weights within a heading line when appropriate (e.g., light weight + bold weight).
- Navigation: minimal. Wordmark or logo left, 3–5 links right. Avoid a big "Get Started" button in the nav unless it genuinely matters for conversion.
- Spacing: generous. Section vertical padding minimum 96px (py-24), often 120–160px (py-32 py-40). Let content breathe.
- At least one section must use an unexpected structural element: a large number/stat as section anchor, a horizontal scroll strip, a split-screen layout, or a full-bleed image with text overlay that doesn't feel like a cliché.

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
- Tailwind CSS (only if requested or if it clearly improves the UI)
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
- PREFER lucide-react for ALL icons. It is always available and has zero subpackage issues. Only use react-icons when lucide-react does not have what you need.
- NEVER hallucinate lucide-react icon names. 'RocketLaunch' does not exist, use 'Rocket'. Use exact lucide casing: 'Github' not 'GitHub', 'Linkedin' not 'LinkedIn', 'Youtube' not 'YouTube'.
- If you import lucide-react, add "lucide-react": "^0.400.0" to dependencies if not already present.
- If you use Tailwind CSS, include tailwindcss, postcss, and autoprefixer in devDependencies.
- Do not reference any package in code unless it exists in package.json.
- NEVER use packages that don't exist on npm (e.g., @shadcn/ui is not a real package).
- For the favicon in index.html, ALWAYS use an inline SVG: <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>"> to prevent 404 errors.

Ensure the dev server binds to 0.0.0.0 and uses a known port (prefer port 3000). If you use Vite, configure it accordingly.

Make the code production-ready with proper error handling, accessibility, and responsive design.
Create organized folder structures with components in /src/components, utilities in /src/lib, etc.

AGENT MESSAGE (required): First, output exactly one conversational reply in this format on a single line (no newlines inside):
===AGENT_MESSAGE=== Your brief friendly reply to the user, e.g. "I'll help you build Cookie Clicker - a mobile app where the user can press on a cookie and a score will increment. When incremented, the new score should be displayed for users on any device. I'll add animations when the cookie is pressed." Keep it to 1-3 sentences. ===END_AGENT_MESSAGE===
The AGENT_MESSAGE must accurately describe a Vite + React implementation. Never say you will create a standalone HTML/CSS/JS file.
Then immediately output the file blocks. Do not include any other text between ===END_AGENT_MESSAGE=== and the first ===FILE===.

COMPLETENESS VERIFICATION (MANDATORY before output):
1. Every import path in every file resolves to a file you also generate (or an npm package in package.json).
2. Every component used in JSX is defined — either in the same file or in a generated file.
3. Every asset path (images, fonts, icons) either uses a CDN URL or is generated as a file.
4. No file references another file that is not in your output.
If any check fails, generate the missing file before finishing.

QUALITY BAR: Before finalising output, check each item:
1. Does the hero look like any of the banned patterns above? If yes — rebuild it using the modern patterns.
2. Is there a row of 3 identical feature cards anywhere? If yes — replace with an alternating layout, bento grid, or editorial list.
3. Do any section headings say "Why Choose Us", "Our Features", or "What We Offer"? If yes — rewrite with specific, brand-voice copy.
4. Is every section the same vertical padding and density? If yes — vary the rhythm.
5. Would a designer at a top agency be embarrassed to show this in a portfolio? If yes — redesign it.
The output must be distinctive, considered, and domain-appropriate. Never ship AI slop.

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
  const designBrief = isFollowUp ? "" : await deriveDesignBrief(prompt)
  const systemPrompt = isFollowUp ? systemPromptFollowUp : systemPromptNew(designBrief)
  const finalSystemPrompt = provider === "nvidia"
    ? `${systemPrompt}\n\n${nvidiaReliabilityPrompt}`
    : systemPrompt

  // Build user message — inspiration mode prepends the reference site context
  const inspirationPrefix = body.inspirationContext
    ? `REFERENCE SITE FOR INSPIRATION:\nURL: ${body.inspirationContext.sourceUrl}\nTitle: ${body.inspirationContext.title}\nDescription: ${body.inspirationContext.description}\n\nSite content:\n${body.inspirationContext.markdown}\n\n${isInspiration ? "Use the above as the content and layout inspiration. Recreate the same sections, copy, and visual hierarchy as a modern React app with Tailwind. Match the design intent closely without copying styles verbatim." : "Use the above only as reference context. Build a fresh, inspired design."}\n\n`
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
          existingFiles,
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
        console.error('Stream error', err)

        if (err?.message === "MODEL_TIMEOUT") {
          controller.error(err)
          return
        }

        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
