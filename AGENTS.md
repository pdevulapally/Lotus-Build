# AGENTS.md

## Purpose

This repository is a production-quality AI website/app builder called **Lotus Build / Nebula Website Builder**.

Agents working in this repo must behave like **senior product engineers**, not junior code generators.

That means:

- do not hallucinate product behavior
- do not invent requirements
- do not hardcode flows that should be state-driven
- do not add static lists, repeated mapping logic, or brittle `if/else` trees when the behavior should be derived from data/state
- do not duplicate UI, business logic, copy, or derived state
- do not create internal-tool dashboards for founder-facing flows
- do not make architectural changes unless required by the task

When something is unclear, **ask concise clarifying questions first** rather than guessing.

---

## Product overview

Lotus Build Website Builder is an AI website/app builder.

High-level architecture:

- Firestore `projects` documents hold project state
- `/api/generate` performs AI code generation and iterative edits
- `/api/sandbox` handles preview runtime through E2B
- `projectId` is the Firestore document ID in `projects`
- existing project edits are full-context regenerations using:
  - original prompt
  - current user request
  - current file set
- the project builder UI lives in `app/project/[id]/page.tsx`
- the landing page assistant is separate from project code generation

Three AI systems exist:

1. **Main builder AI**
  - code generation/editing
  - driven by `/api/generate`
2. **Website assistant**
  - landing-page assistant
  - separate from the builder generation flow
3. **Computer agent** (`app/computer/[id]/page.tsx`)
  - autonomous orchestration agent powered by Anthropic
  - all calls go through `createComputerAgentMessage` in `lib/computer-agent/agent-config.ts`
  - POST endpoint: `/api/computer/run/route.ts`

These must not be conflated.

---

## Memory system (computer agent)

The computer agent supports persistent memory injected into every Anthropic call.

### Storage


| Scope   | Firestore field         | Collection             |
| ------- | ----------------------- | ---------------------- |
| Global  | `globalMemory: string`  | `users/{uid}`          |
| Project | `projectMemory: string` | `projects/{projectId}` |


### Injection flow

1. `POST /api/computer/run` reads both fields in parallel (`Promise.all`)
2. Passes them as `MemoryContext` to `createComputerAgentMessage` via the `callAgent` closure
3. `composeSystemPrompt` injects them between the base system prompt and task-specific instructions
4. Format: `buildMemoryBlock()` in `lib/computer-agent/agent-config.ts`

### User editing

Users edit global and project memories at `/settings` → Memory tab:

- Global memory: one textarea, saved to `users/{uid}.globalMemory`
- Project memory: per-project textareas, saved to `projects/{projectId}.projectMemory`
- Both load lazily (only when the Memory tab is activated) and persist immediately on Save

### Rules

- Never read memory from anywhere other than these two Firestore fields
- Do not add a third memory scope without updating `MemoryContext` in `agent-config.ts`, the run route, and the settings page
- Memory is plain text — do not impose a structured format on it

---

## Non-negotiable architectural rules

Preserve these unless the task explicitly requires otherwise:

- `projectId` is the Firestore doc ID in `projects`
- project generation remains driven by `/api/generate`
- preview/runtime remains driven by `/api/sandbox`
- post-approval build flow must reuse the existing generation pipeline where possible
- do not rewrite server routes when the task is clearly UI/UX-only
- do not create parallel systems when existing ones can be extended cleanly
- do not fork the builder into duplicate versions for different states unless unavoidable

When changing UI behavior, prefer **front-end orchestration changes** over backend rewrites.

### Sandbox (E2B) rules

- `sandbox.commands.run()` wraps commands in `bash -c '...'` — **never use single quotes inside commands**
- For shell operations that need complex regex, write a Python script to `/tmp/` via `sandbox.files.write()` and execute it with `python3 /tmp/script.py`
- Use `\\x27` (Python hex escape for `'`) inside Python strings to avoid any quoting issues
- The import scanner at `/api/sandbox/route.ts` uses this pattern (`_lotus_scan.py`)

### Firecrawl remote browser rules

- The live stream URL is `metadata.browserLiveUrl` on the timeline event — **not** the target URL
- `getLatestBrowserInspection` in `app/computer/[id]/page.tsx` reads `browserLiveUrl` for the iframe src
- Never use `targetUrl` as an iframe src — target sites block embedding via X-Frame-Options
- If `browserLiveUrl` is missing or expired, show a fallback UI with an external link, not a broken iframe

---

## Working style expected from agents

Before changing code:

1. inspect the current implementation
2. summarize the existing structure that matters
3. identify what should be preserved
4. identify the minimal safe refactor strategy
5. only then implement

Do not jump straight into code without first understanding the current structure.

For non-trivial tasks:

- explain the intended hierarchy/state flow first
- keep implementation scoped
- do not mix refactor + redesign + behavior change unless requested

---

## Clarification rule

If a request has ambiguity around:

- user flow
- approval semantics
- button meaning
- state transitions
- whether something should be shown or hidden
- whether logic should be UI-only vs backend-backed

ask a **small number of high-value clarifying questions** first.

Do not assume the missing behavior.

Examples of good clarification:

- “Should this button mean approve-and-generate-plan, or approve-and-build?”
- “Should this summary appear before requirements are complete, or only after approval?”
- “Should this remain local UI state, or be persisted to the project document?”

Examples of bad behavior:

- inventing a flow
- hardcoding one interpretation
- implementing both paths without reason
- adding speculative state fields

---

## UI / UX philosophy

This product is aimed at users including **non-technical founders**, not only developers.

Founder-facing UI must feel:

- calm
- clear
- premium
- focused
- modern
- restrained
- intelligent

It must **not** feel like:

- an internal tool
- an agent control room
- a dashboard full of metrics/chips/cards
- a Jira-style planning interface
- a cluttered SaaS template
- a raw IDE too early in the flow

### Design rules

- prefer one primary surface and one supporting surface
- reduce container count
- avoid deeply nested cards
- avoid repeated bordered panels inside bordered panels
- rely more on spacing, typography, and hierarchy than decorative boxes
- keep the number of simultaneously visible concepts low
- do not surface technical jargon to non-technical users

### Copy rules

Do not use internal/product-designer copy in the UI.

Avoid copy like:

- “source of truth”
- “agent conversation”
- “highest-impact unknowns”
- “readiness 78%”
- “planning artifact”
- “control panel”
- “state machine”

Prefer simple, natural copy like:

- “What we’re building”
- “What still needs your input”
- “Before I build”
- “Pages included”
- “Style direction”
- “One thing to confirm”

---

## Pre-build planning flow rules

For new/pending projects, the default behavior is **requirements-first**.

The assistant must not rush into generation from a vague prompt.

### Intended default flow

1. AI asks clarifying questions
2. user answers
3. no blueprint/plan is shown yet unless explicitly required by the product spec
4. once enough context exists, the user approves the answers
5. then the system generates the plan/blueprint
6. after that, the user can refine the plan
7. only then should the user build from the plan

### Important

Do not silently collapse:

- answering questions
- generating the plan
- approving the plan
- building the project

These are distinct states unless explicitly designed otherwise.

### Skip behavior

If the product includes a `Skip plan` path:

- it must be explicit
- it must not be the default
- it may move faster, but should not silently replace the default careful flow

---

## Maintainability rules

Agents must write maintainable code.

### Never do this

- add brittle one-off `if/else` chains for content generation when the same logic should be derived from configuration, schema, or state
- hardcode UI options that should come from structured data
- duplicate type definitions
- duplicate transformation logic in multiple components
- store derived state that can be computed cheaply from canonical state
- repeat the same strings/copy in many places
- add ad hoc helper logic inside large components if it belongs in a shared utility
- patch by copy-pasting near-identical code blocks
- add “temporary” logic that becomes permanent clutter

### Prefer this instead

- config-driven structures
- data-first rendering
- pure utility functions for transformations
- canonical source of truth
- derived selectors/helpers
- reusable components with clear responsibilities
- discriminated unions / typed state where appropriate
- single-purpose utilities in `lib/`* when logic is shared
- minimal public API surfaces between components

### Strong rule

If you find yourself writing long chains like:

- `if key === "pages" ...`
- `if key === "systems" ...`
- `if type === "x" ... else if type === "y" ...`
- static options with many manual branches

stop and ask:
**should this be represented as data/config instead?**

In most cases here, the answer is yes.

---

## State management rules

Before adding state, ask:

1. Is this canonical state or derived state?
2. Should this live locally in the component?
3. Should this be lifted?
4. Should this be computed from existing `project`/`blueprint`/messages instead of stored?
5. Is this UI state or business state?

Do not store duplicated state if it can be derived.

Examples:

- visibility flags that can be derived from planning status should not also become independent truth unless needed for animation/transition control
- labels like “plan ready” should be computed, not manually synchronized in many places
- duplicate copies of blueprint/summary/open questions should not exist in component state if the source object already owns them

---

## Component design rules

Components must be:

- single-purpose
- composable
- easy to reason about
- low-noise
- appropriately typed

### Prefer

- smaller presentational components
- extracted render helpers only when they improve clarity
- moving business logic out of UI components into utilities/hooks where appropriate

### Avoid

- giant components that contain UI, domain logic, copy rules, parsing, transformation, and orchestration all mixed together
- helper functions embedded in components when they are reused or domain-specific
- local utility logic duplicated across similar files

---

## Domain modeling rules

When product structure exists, represent it explicitly.

If the system has concepts like:

- planning stages
- blueprint sections
- question states
- approval states
- action availability

prefer:

- typed models
- config objects
- explicit maps
- reusable selectors

Avoid informal scattered logic spread across the component tree.

---

## Hardcoding and static data rules

Do not hardcode static option lists inside UI components unless they are:

- truly fixed product copy
- tiny and local
- not domain data
- not likely to be reused
- clearly not part of application behavior

If options, labels, section definitions, or behavior mappings are part of the product model, move them into:

- `lib/`*
- typed config files
- shared constants near the domain model

### Example anti-pattern

A component containing a large static list of options plus custom `if/else` formatting branches.

### Preferred pattern

A structured config map with typed metadata:

- key
- label
- selection mode
- helper copy
- formatter
- parser
- option derivation strategy

---

## Duplication rules

Agents must actively look for duplication before finalizing code.

Check for duplication in:

- copy
- derived state
- formatting logic
- data normalization
- section definitions
- status labeling
- button logic
- mobile/desktop rendering branches

If the same rule appears in two places, consider centralizing it.

Do not solve a problem once in the component and again in `lib/*` with slightly different logic.

---

## Senior engineering bar

Changes in this repo should feel like they were written by a senior engineer.

That means:

- clear separation of concerns
- explicit tradeoffs
- minimal moving parts
- no accidental complexity
- no “just make it work” patches
- no speculative abstractions
- no junior-style hardcoded decision trees when the domain can be modeled cleanly

A solution is **not acceptable** just because it works.
It must also be:

- understandable
- maintainable
- extensible
- consistent with the architecture

---

## AI website generation quality rules

The generate pipeline (`/api/generate/route.ts`) must produce modern, editorial, non-generic websites.

### How the generation pipeline works (new sites)

1. `deriveDesignBrief(prompt)` is called first — it produces a structured design brief
2. The brief is injected into `systemPromptNew(designBrief)` as the authoritative visual spec
3. `extractCriticalChecklist(brief)` extracts HERO_FORMAT, HERO_HEADLINE, STANDOUT, LAYOUT_VOCABULARY, ANTI_PATTERN and appends them as a final hard-constraint block at the end of the system prompt (models attend more to instructions near the end)
4. The full prompt is sent to the model for streaming code generation

### How the generation pipeline works (follow-ups)

When `isFollowUp === true`:
- `deriveDesignBrief` is **skipped**
- `systemPromptFollowUp` is used instead
- This prompt enforces a BANNED PATTERNS list and a DESIGN QUALITY CHECKLIST specific to follow-up edits
- Never weaken the follow-up prompt's design enforcement — follow-ups are where design regresses most

### Design brief (`deriveDesignBrief`) — current state

- **Temperature: `0.75`** — allows creative exploration, prevents deterministic convergence
- **`max_completion_tokens: 1400`** — enough tokens for a section-by-section specific brief
- **Aesthetic vector injection**: Before every call, one of 10 distinct aesthetic directions is randomly sampled from `AESTHETIC_VECTORS` and injected into the creative director system prompt as `MANDATORY AESTHETIC VECTOR`. This forces different visual directions for similar prompts. Do not remove or reduce this list.
- **Prompt length: `3000` chars** (up from 2000)

Produces a structured brief with 11 fields:
`PALETTE`, `FONTS`, `PERSONALITY`, `VISUAL_REFERENCE`, `HERO_FORMAT`, `HERO_HEADLINE`, `SECTIONS`, `TYPOGRAPHY_APPROACH`, `STANDOUT`, `LAYOUT_VOCABULARY` (domain-specific layout patterns), `ANTI_PATTERN`

### `LAYOUT_VOCABULARY` field (important)

This field asks the creative director to describe 2-3 domain-specific layout or content patterns that the business actually uses in the real world — patterns that a generic AI template would never know to include. The generator is required to implement these patterns in the site sections. Do not remove this field from the brief prompt.

### Banned AI slop patterns (enforced in system prompt)

The following must NEVER appear in generated output. Their presence is a build failure:

1. Centered headline + centered subheadline + two CTA buttons as hero
2. Any quantity of identical-structure cards in a row (3, 4, 5 cards — all banned)
3. Gradient hero backgrounds (blue-to-purple, teal-to-blue, or any obvious gradient)
4. Stock photo with dark overlay + centered white text as the hero
5. Generic section headings: "Why Choose Us", "Our Features", "How It Works", "Get Started Today"
6. Three identical testimonial cards with avatar + stars + quote + name + title
7. Numbered 1-2-3 steps in identical icon cards for "How It Works"
8. Footer with 4 identical link column grid
9. Uniform vertical padding across all sections
10. Purple gradients on white backgrounds
11. Shadows on every card
12. Plain white or plain off-white background for the entire site

### Modern pattern requirements (enforced in system prompt)

Generated sites must implement at least 4 of:

- Typographically dominant hero (left-aligned or asymmetric, no filler subheadline)
- Alternating image-left/text-right rows OR bento grid with varied cell sizes OR editorial numbered list (01, 02, 03)
- Single oversized pull-quote OR inline client logo marquee strip (not a card grid)
- Large numerals as visual anchors in a stats section
- Section decorative numbers or letters as background elements
- Split screen (two exact halves, different backgrounds)
- Navigation: wordmark left, 3-5 links right, no big CTA button
- Horizontal scroll strip for logos/tags/social proof
- One grid-breaking element per page
- Generous section vertical padding and max-width with proper horizontal padding

### Rules for agents touching `/api/generate/route.ts`

- Do not remove the BANNED PATTERNS or MODERN PATTERNS sections from `systemPromptNew`
- Do not remove the DESIGN QUALITY CHECKLIST from `systemPromptFollowUp`
- Do not revert `deriveDesignBrief` to a shorter, less specific, or lower-temperature version
- Do not reduce `max_completion_tokens` for the design brief below 1400
- Do not reduce `temperature` for the design brief below 0.7
- Do not remove or shrink `AESTHETIC_VECTORS` — the random sampling is what prevents design convergence
- Do not remove `extractCriticalChecklist` or its injection at the end of `systemPromptNew`
- Do not remove `LAYOUT_VOCABULARY` from the brief prompt or the critical checklist extraction
- `skipDesignBrief: true` in the request body bypasses the brief — only use this for inspiration mode or cases where a brief is genuinely not needed

---

## Mobile sandbox / preview system

The mobile preview sandbox is an Expo/React Native VPS-based environment orchestrated by a separate service.

### Infrastructure

- Hosted on FastHost VPS: 2 vCPU, 4 GB RAM, 120 GB NVMe
- Orchestrator service runs on this VPS, exposes an API consumed by the Next.js app via `ORCHESTRATOR_URL` env var
- The Next.js app never starts sandboxes directly — it calls the orchestrator, which manages Expo Metro instances

### Key files

| File | Role |
|---|---|
| `lib/orchestrator/client.ts` | All HTTP calls to the orchestrator (ensureSandbox, getSandbox, writeSandboxFiles, sandboxHeartbeat, destroySandbox) |
| `lib/mobile-preview/ensure.ts` | Business logic: reuse existing sandbox or create new one, sync files, persist sandbox ID to Firestore |
| `app/api/projects/[id]/ensure-mobile-preview/route.ts` | Route called by the frontend to ensure/reuse a sandbox |
| `app/api/mobile-preview/[sandboxId]/heartbeat/route.ts` | Keep-alive heartbeat (every 60s when preview is running) |
| `components/computer/mobile-preview.tsx` | Frontend React component — polls sandbox status, renders phone frame, handles error states |

### "Metro did not become ready in time" — what it means

Metro is React Native's JavaScript bundler. On a 2 vCPU / 4 GB VPS, if multiple sandboxes start simultaneously or the machine is under CPU/RAM pressure, Metro times out during the bundling phase. The orchestrator returns `{ status: "failed", error: "Metro did not become ready in time" }`.

### How the frontend handles this (current implementation)

- `isRetryableError(error)` detects Metro timeout, connection refused, and timed-out errors via regex
- `normalizePreviewError(error)` maps technical orchestrator errors to user-friendly English
- Auto-retry: when a "failed" sandbox has a retryable error, the frontend automatically retries up to `MAX_AUTO_RETRIES = 2` times with a `AUTO_RETRY_DELAY_MS = 4000` ms delay between attempts
- After 2 auto-retries, a manual "Try again" button is shown
- `handleRetry()` resets the auto-retry counter so manual retry can trigger fresh auto-retries
- The "failed" view shows "Preview timed out — retrying…" during auto-retry and the friendly error message at all times

### Sandbox lifecycle

```
queued → starting → running → stopping → (expired)
                 ↘ failed
```

- `ACTIVE_STATUSES = ["queued", "starting", "running", "stopping"]`
- Failed sandboxes are cleared from Firestore (`mobileSandboxId = null`) and a new one is created
- Heartbeat fires every 60 seconds when the sandbox is running and the tab is visible
- On tab visibility change, the frontend also syncs files and sends a heartbeat

### Rules for agents touching mobile preview

- Do not increase `MAX_AUTO_RETRIES` beyond 3 — each retry creates a new VPS sandbox instance
- Do not decrease `AUTO_RETRY_DELAY_MS` below 3000 — the VPS needs time to free resources
- `normalizePreviewError` should always map technical errors to user-friendly copy; do not expose raw orchestrator error strings to users
- `orchestratorRequest` in `client.ts` has a 15-second `AbortSignal.timeout` — do not reduce this, the VPS can be slow under load
- Never expose `ORCHESTRATOR_URL` or `ORCHESTRATOR_API_KEY` to the client

---

## Reasoning component (`components/ai-elements/reasoning.tsx`)

The `ReasoningContent` component renders AI reasoning text. It supports:

- **Streaming animation**: characters are revealed progressively using `useStreamingText` when `isStreaming=true`
- **Code block rendering**: triple-backtick fenced code blocks (e.g. ` ```html\n...\` `` `) are parsed by `parseContentBlocks()` and rendered as styled `<pre><code>` elements with a language label
- **Plain text**: regular text segments are rendered with `whitespace-pre-wrap`

### `parseContentBlocks(text)`

Splits a reasoning string into `TextBlock` and `CodeBlock` segments using a global regex. Only matches **complete** ` ``` ` pairs — partial/open code fences during streaming remain as plain text until the closing fence arrives.

### Rules for agents touching reasoning

- Do not replace `parseContentBlocks` with `dangerouslySetInnerHTML` — security risk
- Do not add a markdown library just for this component unless the scope genuinely expands to full markdown rendering
- If extending `parseContentBlocks`, ensure partial (unclosed) code fences still degrade gracefully to plain text

---

## Visual/theme rules

lotus.build uses a **Lotus Editorial** theme: warm ivory canvas, charcoal slate brand surfaces, and a muted oxblood accent used sparingly.
This is the canonical palette — do not invent alternatives.

### Design tokens (source of truth: app/globals.css :root)


| Token                    | oklch value            | Hex approx | Role                          |
| ------------------------ | ---------------------- | ---------- | ----------------------------- |
| --background             | oklch(0.978 0.006 82)  | #F6F4EF    | Page base (warm ivory)        |
| --card                   | oklch(0.995 0.004 82)  | #FDFCFA    | Card / popover surface        |
| --secondary / --muted    | oklch(0.938 0.006 82)  | #ECEAE5    | Parchment muted surface       |
| --primary (slate)        | oklch(0.265 0.018 250) | #2E3440    | Nav, strong UI, headings      |
| --slate-mid              | oklch(0.38 0.022 250)  | #4A5568    | Secondary slate text          |
| --slate-soft             | oklch(0.935 0.008 250) | #E8EAED    | Slate tint background         |
| --accent (muted oxblood) | oklch(0.50 0.155 27)   | #B84232    | Primary CTAs, key links       |
| --accent-soft            | oklch(0.955 0.018 27)  | #F5E8E5    | Badge / tag backgrounds       |
| --accent-soft-foreground | oklch(0.36 0.12 27)    | #7A2E22    | Text on accent-soft           |
| --foreground             | oklch(0.18 0.012 60)   | #1C1B18    | Body text                     |
| --muted-foreground       | oklch(0.48 0.012 60)   | #5C5A54    | Secondary text                |
| --border                 | oklch(0.868 0.008 82)  | #D8D5CE    | Default borders               |
| --border-strong          | oklch(0.74 0.01 82)    | #B8B4AB    | Emphasis borders              |
| --success                | oklch(0.42 0.13 155)   | #1A7A4A    | Success states                |
| --success-soft           | oklch(0.945 0.04 155)  | #DFF2E8    | Success badge bg              |
| --destructive            | oklch(0.52 0.17 25)    | #B83830    | Errors (distinct from accent) |


### Usage rules for agents

- `bg-background` — page root only
- `bg-card` — cards, modals, popovers
- `bg-secondary` / `bg-muted` — surfaces, input areas
- `bg-primary text-primary-foreground` — slate nav bars, code blocks, strong UI
- `bg-sidebar` — light parchment sidebar surfaces
- `bg-accent text-accent-foreground` — primary CTAs and active indicators only
- `bg-accent-soft text-accent-soft-foreground` — badges, tags, status chips
- `bg-slate-soft text-slate-soft-foreground` — draft/neutral state chips
- `text-foreground` — all primary body text
- `text-muted-foreground` — secondary/supporting text
- `border-border` — default borders
- `border-border-strong` — emphasis borders, active containers
- `bg-success-soft text-success-soft-foreground` — live/complete badges
- `bg-success text-success-foreground` — filled success elements

### Rules agents must follow

- Never hardcode hex values for brand colors in components
- Always use the Tailwind token names above
- Never use purple, blue, orange, or gradient accents
- Reserve `bg-accent` for primary actions — ghost/outline hovers use `muted`
- The one accent color is muted oxblood — do not introduce secondary accents
- Active/selected states use accent or accent-soft
- Success states use success or success-soft
- Destructive/error states use destructive

---

## File and folder expectations

When refactoring builder UI, prefer clean component extraction under:

- `components/project/`*

When extracting domain logic, prefer:

- `lib/*`
- typed helpers/selectors near the relevant domain

Do not create random utility files without clear ownership.

---

## PR / patch expectations for agents

For meaningful tasks, the agent should structure its response as:

1. **Current structure**
  - what exists now
  - what matters
2. **Problems**
  - what is wrong / risky / cluttered / duplicated
3. **Refactor plan**
  - minimal safe path
4. **Implementation**
  - code changes
5. **Why this is better**
  - maintainability / UX / clarity

Do not dump code without explaining the structure first.

---

## When asked for UI changes

Agents must be careful not to:

- redesign unrelated areas
- introduce duplicate interaction systems
- add dashboards where a simple flow is needed
- surface too much state at once
- make founder-facing flows too technical

For any first-run or pre-build experience, optimize for:

1. what we are building
2. what still needs user input
3. what the user should do next

If an element does not clearly support one of those goals, it is probably unnecessary.

---

## When asked for logic changes

Agents must:

- identify the canonical source of truth
- avoid deriving from text heuristics if a stronger model already exists
- avoid encoding product behavior in fragile string parsing if a typed state/config solution is possible
- avoid mixing parsing logic into UI components

If the logic involves:

- blueprint sections
- planning states
- guided options
- question sequencing
- plan/build transitions

prefer robust typed config/state-driven design over scattered conditional logic.

---

## Do not guess from prompt text when a product state should exist

Heuristic text parsing should be a last resort, not the default architecture.

If the app needs structured information such as:

- target audience
- pages
- features
- style
- integrations
- approval state
- question completion state

prefer an explicit structured model over repeatedly parsing freeform prompt strings.

If you must use heuristics temporarily:

- isolate them clearly
- keep them small
- do not spread them across the codebase
- mark them as transitional if appropriate
- avoid pretending they are a durable domain model

---

## Code review checklist for agents

Before finalizing, check:

### Product / UX

- Is the flow correct?
- Did I assume anything not explicitly confirmed?
- Is the UI calm and founder-friendly?
- Did I avoid clutter and duplicate information?
- Is the next action obvious?

### Architecture

- Did I preserve core route/data assumptions?
- Did I avoid unnecessary backend changes?
- Did I avoid duplicate systems?

### Maintainability

- Did I introduce hardcoded lists that should be config-driven?
- Did I write brittle `if/else` trees where structured mappings would be better?
- Did I duplicate logic or copy?
- Did I store derived state unnecessarily?
- Is the code easy to extend?

### Components

- Are responsibilities clear?
- Is domain logic separated from UI where needed?
- Did I avoid giant mixed-responsibility components?

If any answer is weak, revise before finalizing.

---

## Preferred agent behavior summary

Be:

- careful
- explicit
- minimal
- senior
- maintainable
- product-minded

Do not be:

- speculative
- assumption-heavy
- dashboard-happy
- duplicate-prone
- junior-style
- hardcode-first

When unsure, ask.
When possible, simplify.
When implementing, preserve architecture.
When designing, prioritize clarity over cleverness.