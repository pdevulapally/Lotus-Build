import Anthropic from "@anthropic-ai/sdk"
import { validateGeneratedProjectFiles } from "@/lib/generated-project-validation"
import { MOBILE_EXPO_DEPENDENCIES } from "@/lib/generation/prompts/mobile"
import type { ProjectPlatform } from "@/lib/projects/platform"

// Fallback client for callers that don't inject one. Routes should pass a
// metered client (lib/metering/metered-anthropic) so generation turns are billed.
const defaultClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

// Mobile sessions must never receive the web prompt: the generation agent
// builds whatever stack its system prompt mandates, so a Vite-oriented prompt
// produces a website even when the user selected a mobile project. Version
// pins come from MOBILE_EXPO_DEPENDENCIES — the same canonical source the
// project validator enforces.
const MOBILE_SYSTEM_PROMPT = `You are a senior React Native/TypeScript engineer working as an autonomous coding agent. You build and edit production Expo mobile applications by calling tools directly — reading files to understand context, writing files with complete content, validating your work, and iterating until the project is correct.

PROCESS — follow this every time:

For new projects:
1. Think through the app structure silently before writing anything.
2. Write files in dependency order: package.json → app.json → babel.config.js → tailwind.config.js → App.tsx → src/components.
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

TECHNICAL REQUIREMENTS (MOBILE — MANDATORY):
- Stack: Expo + React Native + TypeScript + NativeWind. This is a MOBILE app — never generate a website.
- NEVER output vite.config.ts, index.html, src/main.tsx, src/index.css, postcss.config.js, or any Vite/Webpack/Next bundler config.
- NEVER import react-dom, @vitejs/plugin-react, vite, or browser DOM APIs (document, window, localStorage) unless guarded and truly cross-platform.
- Required scaffold for new projects: package.json, app.json (expo.name, expo.slug, expo.version, orientation, userInterfaceStyle, assetBundlePatterns), babel.config.js (with nativewind/babel), tailwind.config.js (NativeWind content paths for App.tsx and src/**/*.{js,jsx,ts,tsx}), App.tsx.
- package.json MUST pin expo to "${MOBILE_EXPO_DEPENDENCIES.expo}", react to "${MOBILE_EXPO_DEPENDENCIES.react}", and react-native to "${MOBILE_EXPO_DEPENDENCIES["react-native"]}". Do not choose different versions. Set main to expo/AppEntry and include start, android, ios, and web scripts using Expo CLI. dependencies must include nativewind; devDependencies must include typescript and tailwindcss.
- Use React Native primitives: View, Text, ScrollView, Pressable, Image, TextInput, SafeAreaView, StatusBar, StyleSheet. Style with NativeWind className — no DOM elements, no CSS files, no media queries.
- Every package imported in code must be declared in package.json.
- Images: real Unsplash URLs (https://images.unsplash.com/photo-[ID]?w=1200&q=80&auto=format&fit=crop) rendered with the React Native Image component — never invented local asset paths unless you also generate the asset file.

DESIGN — reason from the prompt and brief, do not apply defaults:
- Build for phone-first iOS and Android screens: respect safe areas, scrollability, keyboard states, and 44px minimum touch targets.
- Use native interaction patterns: Pressable feedback, ScrollView, KeyboardAvoidingView, ActivityIndicator, and clear empty/loading states.
- No hover-only behavior, no desktop grids, no CSS media queries, no DOM event assumptions.
- Avoid generic AI-app visual clichés: purple gradients, centered web hero sections, identical feature cards, SaaS template layouts. Use mobile-native composition: stacked cards, tab-like controls, bottom actions, concise headers, lists, profile/detail surfaces.
- Copy must be specific to the user's product. No lorem ipsum, no placeholders.

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

// Prompt caching: the request prefix is ordered tools → system → messages, so a
// single breakpoint on the system prompt caches the static tools + system prefix
// across every turn and every run. Both platform prompts are static constants,
// so each platform gets its own stable cached prefix.
const SYSTEM_PROMPT_BLOCKS_BY_PLATFORM: Record<ProjectPlatform, Anthropic.TextBlockParam[]> = {
  web: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  mobile: [{ type: "text", text: MOBILE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
}

// Returns a request-scoped copy of the conversation with an ephemeral cache
// breakpoint on the final content block, so each agent turn extends and reuses
// the previous turn's cached prefix instead of reprocessing the whole
// conversation. The stored history is never mutated — Anthropic allows at most
// 4 cache_control blocks per request, so markers must not accumulate.
function withCacheBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  const cacheControl: Anthropic.CacheControlEphemeral = { type: "ephemeral" }

  if (typeof last.content === "string") {
    return [
      ...messages.slice(0, -1),
      { ...last, content: [{ type: "text", text: last.content, cache_control: cacheControl }] },
    ]
  }

  const blocks = last.content
  if (!Array.isArray(blocks) || blocks.length === 0) return messages
  const lastBlock = blocks[blocks.length - 1]
  if (!lastBlock || typeof lastBlock !== "object") return messages
  return [
    ...messages.slice(0, -1),
    {
      ...last,
      content: [
        ...blocks.slice(0, -1),
        { ...lastBlock, cache_control: cacheControl } as Anthropic.ContentBlockParam,
      ],
    },
  ]
}

// Extracts a quoted string value from a key in partial streaming JSON.
// Returns null until the full value (closing quote) has been streamed.
function extractJsonString(partial: string, key: string): string | null {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  const m = pattern.exec(partial)
  return m ? m[1] : null
}

export async function runAgenticGeneration(params: {
  /** Pass a metered client so every generation turn is billed to the user. */
  client?: Anthropic
  /** Defaults to MODEL (claude-sonnet-4-6). Pass a cheaper model for degraded/free-tier runs. */
  model?: string
  prompt: string
  existingFiles: AgenticFile[]
  platform: ProjectPlatform
  isEdit: boolean
  /** Real alternating conversation turns from the session, built by buildConversationMessagesForAgent.
   *  When provided, the agent experiences prior exchanges as genuine message history rather than
   *  a flattened text blob — giving it full context awareness across the conversation. */
  conversationMessages?: Array<{ role: "user" | "assistant"; content: string }>
  onFileStarted?: (path: string) => Promise<void>
  onFileWritten?: (file: AgenticFile) => Promise<void>
  onToolCall?: (title: string) => Promise<void>
}): Promise<{ files: AgenticFile[]; suggestsBackend: boolean }> {
  const client = params.client ?? defaultClient
  const model = params.model ?? MODEL
  const fileStore = new Map<string, string>()
  for (const f of params.existingFiles) {
    fileStore.set(f.path, f.content)
  }

  // Seed from real conversation turns when available, then append the generation task.
  // This gives the model proper multi-turn context rather than a single context-blob message.
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    ...(params.conversationMessages ?? []),
    { role: "user", content: params.prompt },
  ]

  let suggestsBackend = false
  let finished = false

  for (let turn = 0; turn < MAX_TURNS && !finished; turn++) {
    type BlockState = { id: string; name: string; json: string }
    const streamBlocks = new Map<number, BlockState>()
    const streamNotified = new Set<string>() // block ids already callback'd during streaming

    const stream = client.messages.stream({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT_BLOCKS_BY_PLATFORM[params.platform],
      tools: TOOLS,
      messages: withCacheBreakpoint(messages as Anthropic.MessageParam[]),
    })

    // Stream events so we can fire UI callbacks as the model generates
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        const { id, name } = event.content_block
        streamBlocks.set(event.index, { id, name, json: "" })

        // Zero-argument tools — we know everything immediately
        if (name === "list_files") {
          streamNotified.add(id)
          await params.onToolCall?.("Scanning project files")
        } else if (name === "validate_project") {
          streamNotified.add(id)
          await params.onToolCall?.("Validating project")
        }
        continue
      }

      if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        const block = streamBlocks.get(event.index)
        if (!block || streamNotified.has(block.id)) continue
        block.json += event.delta.partial_json

        // Extract path/pattern as soon as enough JSON has streamed in
        switch (block.name) {
          case "write_file": {
            const path = extractJsonString(block.json, "path")
            if (path) {
              streamNotified.add(block.id)
              await params.onFileStarted?.(path)
            }
            break
          }
          case "read_file": {
            const path = extractJsonString(block.json, "path")
            if (path) {
              streamNotified.add(block.id)
              await params.onToolCall?.(`Reading ${path}`)
            }
            break
          }
          case "search_files": {
            const pattern = extractJsonString(block.json, "pattern")
            if (pattern) {
              streamNotified.add(block.id)
              await params.onToolCall?.(`Searching "${pattern}"`)
            }
            break
          }
        }
      }
    }

    // Stream is exhausted — finalMessage() resolves immediately from the accumulated result
    const response = await stream.finalMessage()
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
      const alreadyNotified = streamNotified.has(block.id)
      let result: string

      switch (block.name) {
        case "read_file": {
          const path = String(input.path ?? "")
          if (!alreadyNotified) await params.onToolCall?.(`Reading ${path}`)
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
          await params.onFileWritten?.({ path, content })
          result = `Written: ${path}`
          break
        }
        case "list_files": {
          if (!alreadyNotified) await params.onToolCall?.("Scanning project files")
          const keys = [...fileStore.keys()]
          result = keys.length ? keys.join("\n") : "(no files yet)"
          break
        }
        case "search_files": {
          const pattern = String(input.pattern ?? "")
          if (!alreadyNotified) await params.onToolCall?.(`Searching "${pattern}"`)
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
          if (!alreadyNotified) await params.onToolCall?.("Validating project")
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
