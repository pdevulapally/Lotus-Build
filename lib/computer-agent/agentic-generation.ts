import Anthropic from "@anthropic-ai/sdk"
import { validateGeneratedProjectFiles } from "@/lib/generated-project-validation"
import type { ProjectPlatform } from "@/lib/projects/platform"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type AgenticFile = { path: string; content: string }

const MODEL = "claude-sonnet-4-6"
const MAX_TURNS = 25

const SYSTEM_PROMPT = `You are a senior React/TypeScript engineer working as an autonomous coding agent. You build and edit production web applications by calling tools directly — reading files to understand context, writing files with complete content, validating your work, and iterating until the project is correct.

PROCESS — follow this every time:

For new projects:
1. Think through the project structure silently before writing anything.
2. Write files in dependency order: package.json → scaffold (vite.config.ts, tailwind.config.ts, postcss.config.js, index.html, src/main.tsx, src/index.css) → src/App.tsx → components.
3. After all files are written, call validate_project.
4. Fix every issue validate_project returns — do not call finish with open validation errors.
5. Call finish.

For edits to existing projects:
1. Call list_files to see the current project structure.
2. Use search_files to find every file containing the values that need to change — never guess or assume which files are affected. If changing a location, currency, name, color, or any value that could appear in multiple files, search for it first.
3. Call read_file on each matched file before writing it — never write from memory of what you think the file contains.
4. Write only files that change, with complete updated content.
5. Fix the full scope: if the user reports one symptom, search_files reveals all instances — fix every one in a single pass, not just the file most obviously related to the request.
6. Call validate_project, fix any issues, then call finish.

CONTENT — non-negotiable:
- Read the full prompt carefully. It contains the user's request and may include conversation history with names, credentials, specialties, pricing, locations, and other specific details. Extract every concrete fact and use it verbatim.
- Never write bracket placeholders anywhere in generated files: not [Your Name], not [Company], not [Email], not any [bracket] token. These cause an immediate fix cycle and degrade user trust. If specific information is absent from all context, commit to the most domain-appropriate plausible value — the output must read as if a real client provided their real data.
- For edits involving wrong or generic content: read the conversation context in the prompt to identify the real values that should replace placeholder or incorrect content, then apply them consistently across every file.

TECHNICAL REQUIREMENTS:
- Stack: Vite + React 18 + TypeScript + Tailwind CSS.
- Required scaffold for new projects: package.json (react, react-dom, vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom, tailwindcss, postcss, autoprefixer), vite.config.ts (server.port 3000, server.host "0.0.0.0"), tailwind.config.ts, postcss.config.js, index.html (viewport meta tag, inline SVG data-URI favicon — no external file), src/main.tsx (must import "./index.css"), src/App.tsx, src/index.css (@tailwind base/components/utilities directives, CSS custom properties in :root).
- Every package imported in code must be declared in package.json.
- Icons: prefer lucide-react. Never import social brand icons (Facebook, Twitter, Instagram, TikTok, etc.) from lucide-react — they were removed and cause runtime crashes. Use ExternalLink, Share2, or an inline SVG path instead.
- Images: real Unsplash URLs (https://images.unsplash.com/photo-[ID]?w=1200&q=80&auto=format&fit=crop) matched to the actual content domain.
- Framer Motion: whileInView pattern for scroll-triggered reveals, stagger for lists. Do not fade-in every element — reserve motion for 3–5 key moments.

DESIGN — reason from the prompt and brief, do not apply defaults:
- Derive the aesthetic direction from the user's prompt and any design brief provided. Commit to it fully — half-measures produce forgettable results.
- Load 2 Google Fonts via @import in src/index.css: one display/heading font applied to h1–h3, one body font for p/nav/labels. Never use Inter, Roboto, or Arial as the display font.
- Define the full palette and type scale as CSS custom properties in :root. Every component reads from these variables — no hardcoded hex values in components.
- Section backgrounds must alternate — never the same background for 3+ consecutive sections.
- Every interactive element must have an explicit hover state, focus state, and CSS transition.
- Patterns that signal low-quality AI output (avoid all of these): centered headline + centered subheadline + two CTA buttons as hero; rows of 3–5 structurally identical cards; generic headings like "Why Choose Us", "Our Features", "How It Works"; gradient blue-to-purple backgrounds; identical testimonial card grids with avatar+stars+quote+name.

BACKEND: If the project clearly needs persistent data, user auth, or server-side logic, set suggests_backend: true in your finish call.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read the complete content of a file in the project. Always call this before editing an existing file — never assume its content.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to read, e.g. src/components/Hero.tsx" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write or overwrite a file with complete content. Always pass the full file — never a partial snippet or diff.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path, e.g. src/components/Hero.tsx" },
        content: { type: "string", description: "The complete file content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List all files currently in the project. Call this at the start of every edit to understand what exists.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_files",
    description: "Search all project files for a text string. Returns every file path and the matching lines. Use this before any edit to find every file that contains a value you plan to change — do not skip this step and guess.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text to search for across all files (case-insensitive)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "validate_project",
    description: "Check the project for broken imports, missing dependencies, missing scaffold files, and structural issues. Always call this after writing all files and before calling finish. Fix every reported issue.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "finish",
    description: "Signal that the project is complete and correct. Only call this after validate_project returns no issues (or after a final fix pass for any remaining trivial issues).",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "A brief, accurate description of what was built or changed",
        },
        suggests_backend: {
          type: "boolean",
          description: "Set to true if the app clearly needs a backend, database, or persistent storage",
        },
      },
      required: ["message"],
    },
  },
]

export async function runAgenticGeneration(params: {
  prompt: string
  existingFiles: AgenticFile[]
  platform: ProjectPlatform
  isEdit: boolean
  onFileWritten?: (file: AgenticFile) => Promise<void>
  onToolCall?: (title: string) => Promise<void>
}): Promise<{ files: AgenticFile[]; suggestsBackend: boolean }> {
  const fileStore = new Map<string, string>()
  for (const f of params.existingFiles) {
    fileStore.set(f.path, f.content)
  }

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: params.prompt },
  ]

  let suggestsBackend = false
  let finished = false

  for (let turn = 0; turn < MAX_TURNS && !finished; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: messages as Anthropic.MessageParam[],
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") break
    if (response.stop_reason !== "tool_use") break

    const toolResults: Array<{
      type: "tool_result"
      tool_use_id: string
      content: string
    }> = []

    for (const block of response.content) {
      if (block.type !== "tool_use") continue

      const input = block.input as Record<string, unknown>
      let result: string

      switch (block.name) {
        case "read_file": {
          const path = String(input.path ?? "")
          await params.onToolCall?.(`Reading ${path}`)
          result = fileStore.has(path)
            ? fileStore.get(path)!
            : `File not found: ${path}\nAvailable files:\n${[...fileStore.keys()].join("\n")}`
          break
        }
        case "write_file": {
          const path = String(input.path ?? "")
          const content = String(input.content ?? "")
          if (!path) {
            result = "Error: path is required"
            break
          }
          fileStore.set(path, content)
          if (params.onFileWritten) {
            await params.onFileWritten({ path, content })
          }
          result = `Written: ${path}`
          break
        }
        case "list_files": {
          await params.onToolCall?.("Scanning project files")
          const keys = [...fileStore.keys()]
          result = keys.length ? keys.join("\n") : "(no files yet)"
          break
        }
        case "search_files": {
          const pattern = String(input.pattern ?? "")
          await params.onToolCall?.(`Searching "${pattern}"`)
          if (!pattern) {
            result = "Error: pattern is required"
            break
          }
          const lowerPattern = pattern.toLowerCase()
          const matches: string[] = []
          for (const [filePath, content] of fileStore.entries()) {
            const hits = content
              .split("\n")
              .map((line, idx) => ({ line, idx }))
              .filter(({ line }) => line.toLowerCase().includes(lowerPattern))
            if (hits.length > 0) {
              matches.push(
                `${filePath}:\n${hits.map(({ line, idx }) => `  ${idx + 1}: ${line.trimStart()}`).join("\n")}`
              )
            }
          }
          result = matches.length
            ? `Found in ${matches.length} file(s):\n\n${matches.join("\n\n")}`
            : `No matches found for "${pattern}"`
          break
        }
        case "validate_project": {
          await params.onToolCall?.("Validating project")
          const files = [...fileStore.entries()].map(([path, content]) => ({ path, content }))
          const { issueMessages } = validateGeneratedProjectFiles(files, {
            requireNewAppScaffold: params.existingFiles.length === 0,
            platform: params.platform,
          })
          result = issueMessages.length ? issueMessages.join("\n") : "No issues found."
          break
        }
        case "finish": {
          suggestsBackend = Boolean(input.suggests_backend)
          finished = true
          result = "Generation complete."
          break
        }
        default:
          result = `Unknown tool: ${block.name}`
      }

      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result })
    }

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults })
    }
  }

  const files = [...fileStore.entries()].map(([path, content]) => ({ path, content }))
  return { files, suggestsBackend }
}
