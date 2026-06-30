import Link from "next/link"
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  Eye,
  FileCode2,
  Folder,
  GitBranch,
  Globe,
  History,
  KeyRound,
  Layers,
  MessageSquare,
  Monitor,
  PanelLeft,
  Play,
  Plus,
  Minus,
  Terminal,
  Zap,
} from "lucide-react"

import {
  CapabilityPills,
  Reveal,
  RevealItem,
  RevealStagger,
} from "@/components/sections/landing-reveal"
import { cn } from "@/lib/utils"

const capabilityPills = ["Prompt to repo", "Live preview", "Visual edits", "Deploy-ready"]

// ─── computer workspace demo content ──────────────────────────────────────────

const feedMessages = [
  {
    role: "user",
    text: "Add a Stripe checkout button to the pricing table and wire it to the /api/checkout route.",
  },
  {
    role: "assistant",
    text: "Reading pricing-table.tsx and lib/plans.ts. I'll add a checkout handler, loading state, and connect it to the existing API route.",
  },
]

const fileTree = [
  { name: "app", type: "folder", depth: 0, open: true },
  { name: "dashboard", type: "folder", depth: 1, open: true },
  { name: "page.tsx", type: "file", depth: 2 },
  { name: "api", type: "folder", depth: 1, open: false },
  { name: "components", type: "folder", depth: 0, open: true },
  { name: "app-shell.tsx", type: "file", depth: 1 },
  { name: "pricing-table.tsx", type: "file", depth: 1, active: true },
  { name: "lib", type: "folder", depth: 0, open: true },
  { name: "plans.ts", type: "file", depth: 1 },
]

const diffLines = [
  { type: "ctx", code: "  const [loading, setLoading] = useState(false)" },
  { type: "add", code: "  const [checkoutId, setCheckoutId] = useState<string | null>(null)" },
  { type: "ctx", code: "" },
  { type: "del", code: "  function handleSelect(planId: string) {" },
  { type: "add", code: "  async function handleSelect(planId: string) {" },
  { type: "add", code: "    setLoading(true)" },
  { type: "add", code: "    setCheckoutId(planId)" },
  { type: "add", code: '    const res = await fetch("/api/checkout", {' },
  { type: "add", code: '      method: "POST",' },
  { type: "add", code: "      body: JSON.stringify({ planId })," },
  { type: "add", code: "    })" },
  { type: "ctx", code: "  }" },
]

const timelineRows = [
  { title: "Reading pricing-table.tsx", detail: "Found 3 plan cards, no checkout handler", done: true },
  { title: "Editing handleSelect()", detail: "Added async checkout request + loading state", done: true },
  { title: "Restarting preview", detail: "localhost:3000/pricing", done: true },
  { title: "Verifying runtime", detail: "Checking for unresolved imports", active: true },
]

const generatedFiles = [
  { name: "components/pricing-table.tsx", change: "edited" },
  { name: "app/api/checkout/route.ts", change: "added" },
  { name: "lib/plans.ts", change: "edited" },
]

const workspaceTabs = ["Code", "Preview", "Terminal"]

const terminalLines = [
  { type: "cmd", text: "▲ next dev" },
  { type: "ok", text: "✓ Compiled /pricing in 412ms" },
  { type: "ok", text: "✓ Compiled /api/checkout in 88ms" },
  { type: "info", text: "GET /pricing 200 in 64ms" },
  { type: "info", text: "POST /api/checkout 200 in 121ms" },
  { type: "ok", text: "✓ No runtime errors detected" },
]

// ─── modern "Cursor-style" use case demos ─────────────────────────────────────

const demoUseCases = [
  {
    title: "Fix a failing test",
    prompt: "The checkout test is failing on the price assertion — find and fix it.",
    file: "checkout.test.ts",
    diff: [
      { type: "del", code: 'expect(total).toBe("$29")' },
      { type: "add", code: 'expect(total).toBe("$29.00")' },
    ],
    result: "1 test fixed · 0 regressions",
  },
  {
    title: "Add Stripe checkout",
    prompt: "Wire the Pro plan button to Stripe checkout with a redirect on success.",
    file: "api/checkout/route.ts",
    diff: [
      { type: "add", code: "const session = await stripe.checkout.sessions.create({" },
      { type: "add", code: "  mode: 'subscription'," },
      { type: "add", code: "  line_items: [{ price: planId, quantity: 1 }]," },
      { type: "add", code: "})" },
    ],
    result: "New route + redirect URL returned",
  },
  {
    title: "Refactor to server actions",
    prompt: "Move the onboarding form submit logic from a client fetch to a server action.",
    file: "onboarding-form.tsx",
    diff: [
      { type: "del", code: 'await fetch("/api/onboarding", { method: "POST" })' },
      { type: "add", code: "await submitOnboarding(formData)" },
    ],
    result: "Client bundle reduced, 1 route removed",
  },
  {
    title: "Generate API route from schema",
    prompt: "Create a typed /api/leads route from the Lead schema in lib/schema.ts.",
    file: "api/leads/route.ts",
    diff: [
      { type: "add", code: "export async function POST(req: Request) {" },
      { type: "add", code: "  const body = leadSchema.parse(await req.json())" },
      { type: "add", code: "  return Response.json(await db.leads.create(body))" },
      { type: "add", code: "}" },
    ],
    result: "Route validated against schema, 0 type errors",
  },
]

function Section({
  id,
  children,
  className = "",
  bleed = false,
}: {
  id?: string
  children: React.ReactNode
  className?: string
  bleed?: boolean
}) {
  return (
    <section id={id} className={cn("px-4 sm:px-6 lg:px-8", className)}>
      <div className={cn(!bleed && "mx-auto max-w-6xl")}>{children}</div>
    </section>
  )
}

function DiffLine({ type, code }: { type: "add" | "del" | "ctx"; code: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 whitespace-pre rounded px-2 py-[3px] font-mono text-[11.5px] leading-5",
        type === "add" && "bg-emerald-500/10 text-emerald-300",
        type === "del" && "bg-rose-500/10 text-rose-300/90",
        type === "ctx" && "text-foreground/55"
      )}
    >
      <span className="mt-[1px] w-3 shrink-0 select-none opacity-60">
        {type === "add" ? "+" : type === "del" ? "−" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate">{code || " "}</span>
    </div>
  )
}

function StaticComputerShell({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-[760px] flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-background text-foreground shadow-[0_42px_140px_-96px_var(--foreground)]",
        className
      )}
    >
      <header className="lotus-glass relative z-30 shrink-0">
        <div className="relative flex h-[52px] w-full items-center">
          <div className="flex h-full min-w-0 shrink-0 items-center gap-1 px-3 sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px]">
            <button
              type="button"
              aria-label="Open sidebar"
              className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/55 transition-all duration-150 hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              className="group -mx-1 hidden w-full min-w-0 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/60 sm:flex"
              aria-label="Session menu"
            >
              <span className="min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-foreground">
                Stripe checkout on pricing table
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/35" />
            </button>
          </div>

          <div className="hidden h-full min-w-0 flex-1 items-center justify-center px-3 sm:flex">
            <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 text-[11px] text-muted-foreground">
              {workspaceTabs.map((tab, index) => (
                <span
                  key={tab}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    index === 0 ? "bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>

          <div className="ml-auto hidden h-full items-center gap-2 px-3 text-[13px] sm:flex">
            <button className="hidden h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-flex">
              <KeyRound className="h-3.5 w-3.5" />
              Integrations
            </button>
            <button className="hidden h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-flex">
              <History className="h-3.5 w-3.5" />
              History
            </button>
            <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 font-semibold text-background transition hover:bg-foreground/85">
              <Globe className="h-3.5 w-3.5" />
              Deploy
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        {/* chat / agent feed */}
        <div className="flex w-full shrink-0 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_76%,transparent)] backdrop-blur-2xl sm:w-[32%] md:w-[31%] lg:w-[340px] xl:w-[370px]">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="chat-scrollbar flex h-full flex-col overflow-y-auto px-4 lg:px-5">
              <div className="flex-1 pt-4" />
              <div className="space-y-4 pb-4">
                {feedMessages.map((message) => (
                  <div key={message.text} className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {message.role === "user" ? "You" : "Lotus"}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/82">{message.text}</p>
                  </div>
                ))}

                {/* inline diff card, like an agent edit summary */}
                <div className="overflow-hidden rounded-xl border border-border/55 bg-[#0c0c0b] shadow-sm">
                  <div className="flex items-center justify-between border-b border-background/10 px-3.5 py-2.5">
                    <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-background/80">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-background/45" />
                      <span className="truncate">pricing-table.tsx</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-[10.5px] text-background/40">
                      <span className="flex items-center gap-0.5 text-emerald-300/80">
                        <Plus className="h-2.5 w-2.5" />8
                      </span>
                      <span className="flex items-center gap-0.5 text-rose-300/75">
                        <Minus className="h-2.5 w-2.5" />1
                      </span>
                    </span>
                  </div>
                  <div className="space-y-[1px] px-2 py-2">
                    {diffLines.map((line, i) => (
                      <DiffLine key={i} type={line.type as "add" | "del" | "ctx"} code={line.code} />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                  <p className="text-[12px] font-semibold text-foreground">Run timeline</p>
                  <div className="mt-3 space-y-3">
                    {timelineRows.map((row) => (
                      <div key={row.title} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[12px]">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 rounded-full",
                            row.active ? "animate-pulse bg-foreground" : row.done ? "bg-success" : "bg-border"
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{row.title}</span>
                          <span className="block truncate text-muted-foreground">{row.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/55 bg-card/78 px-3.5 py-3 shadow-sm">
                  <p className="text-[12px] font-semibold text-foreground">Generated files</p>
                  <div className="mt-2 space-y-1.5">
                    {generatedFiles.map((file, index) => (
                      <div
                        key={file.name}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-2 text-[12px]",
                          index === 0 ? "bg-muted text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">{file.name}</span>
                        <span
                          className={cn(
                            "ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em]",
                            file.change === "added"
                              ? "bg-emerald-500/12 text-emerald-500"
                              : "bg-amber-500/12 text-amber-500"
                          )}
                        >
                          {file.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-3 pb-3 pt-2 lg:px-4">
            <div className="lotus-glass-control rounded-2xl border border-border/60 p-2 shadow-sm">
              <div className="min-h-[58px] rounded-xl px-3 py-2 text-[13px] text-muted-foreground">
                Message the agent...
              </div>
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] text-muted-foreground">Ask for a change or fix</span>
                <span className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background">Send</span>
              </div>
            </div>
          </div>
        </div>

        {/* code editor / preview panel */}
        <div className="lotus-glass-strong m-2 hidden min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 shadow-[0_28px_90px_-64px_rgba(0,0,0,0.9)] sm:flex">
          <div className="relative flex min-h-0 flex-1">
            {/* file tree */}
            <div className="hidden w-[176px] shrink-0 border-r border-border/40 bg-[color-mix(in_oklch,var(--background)_92%,transparent)] py-3 lg:block">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                Explorer
              </p>
              <div className="space-y-[1px] px-2">
                {fileTree.map((item) => (
                  <div
                    key={item.name + item.depth}
                    style={{ paddingLeft: `${item.depth * 12 + 6}px` }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md py-[5px] pr-2 text-[12px]",
                      item.active ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.type === "folder" ? (
                      <Folder className="h-3 w-3 shrink-0 opacity-60" />
                    ) : (
                      <FileCode2 className="h-3 w-3 shrink-0 opacity-50" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[color-mix(in_oklch,var(--background)_88%,transparent)]">
              {/* editor tab bar */}
              <div className="flex h-9 shrink-0 items-center border-b border-border/40 px-1">
                <div className="flex h-full items-center gap-1.5 border-b-2 border-foreground px-3 text-[11.5px] font-medium text-foreground">
                  <FileCode2 className="h-3 w-3 opacity-60" />
                  pricing-table.tsx
                </div>
                <div className="flex h-full items-center gap-1.5 px-3 text-[11.5px] text-muted-foreground/70">
                  <FileCode2 className="h-3 w-3 opacity-40" />
                  route.ts
                </div>
              </div>

              {/* code lines, syntax-ish coloring */}
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 font-mono text-[11.5px] leading-[1.65]">
                <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 text-foreground/85">
                  <span className="select-none text-right text-foreground/25">14</span>
                  <span><span className="text-sky-400/80">function</span> PricingTable() {"{"}</span>

                  <span className="select-none text-right text-foreground/25">15</span>
                  <span className="pl-3"><span className="text-sky-400/80">const</span> [loading, setLoading] = useState(<span className="text-amber-400/80">false</span>)</span>

                  <span className="select-none text-right text-emerald-400/40">16</span>
                  <span className="rounded bg-emerald-500/10 pl-3 text-emerald-300">
                    <span className="text-sky-400/80">const</span> [checkoutId, setCheckoutId] = useState(<span className="text-amber-400/80">null</span>)
                  </span>

                  <span className="select-none text-right text-foreground/25">17</span>
                  <span className="pl-3 text-foreground/40">{"// triggered from the Pro plan CTA"}</span>

                  <span className="select-none text-right text-emerald-400/40">18</span>
                  <span className="rounded bg-emerald-500/10 pl-3 text-emerald-300">
                    <span className="text-sky-400/80">async function</span> handleSelect(planId: string) {"{"}
                  </span>

                  <span className="select-none text-right text-emerald-400/40">19</span>
                  <span className="rounded bg-emerald-500/10 pl-6 text-emerald-300">setLoading(<span className="text-amber-400/80">true</span>)</span>

                  <span className="select-none text-right text-emerald-400/40">20</span>
                  <span className="rounded bg-emerald-500/10 pl-6 text-emerald-300">
                    <span className="text-sky-400/80">const</span> res = <span className="text-sky-400/80">await</span> fetch(<span className="text-orange-300/80">&quot;/api/checkout&quot;</span>, {"{"}
                  </span>

                  <span className="select-none text-right text-emerald-400/40">21</span>
                  <span className="rounded bg-emerald-500/10 pl-9 text-emerald-300">method: <span className="text-orange-300/80">&quot;POST&quot;</span>,</span>

                  <span className="select-none text-right text-emerald-400/40">22</span>
                  <span className="rounded bg-emerald-500/10 pl-9 text-emerald-300">body: JSON.stringify({"{ planId }"}),</span>

                  <span className="select-none text-right text-emerald-400/40">23</span>
                  <span className="rounded bg-emerald-500/10 pl-6 text-emerald-300">{"})"}</span>

                  <span className="select-none text-right text-foreground/25">24</span>
                  <span className="pl-3">{"}"}</span>
                </div>
              </div>

              {/* mini terminal strip */}
              <div className="shrink-0 border-t border-border/40 bg-[#0c0c0b] px-4 py-2.5">
                <div className="flex items-center gap-2 text-[10.5px] text-background/45">
                  <Terminal className="h-3 w-3" />
                  <span>terminal</span>
                  <span className="ml-auto flex items-center gap-1 text-emerald-300/80">
                    <CheckCircle2 className="h-3 w-3" />
                    compiled
                  </span>
                </div>
                <p className="mt-1.5 truncate font-mono text-[11px] text-background/70">
                  ✓ Compiled /api/checkout in 88ms · GET /pricing 200 in 64ms
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="Switch between chat and preview"
        className="lotus-glass-strong absolute inset-x-3 bottom-3 z-20 mx-auto max-w-xs rounded-xl border border-border/50 px-1 py-1 shadow-[0_22px_70px_-42px_rgba(0,0,0,0.9)] sm:hidden"
      >
        <div className="grid grid-cols-2 gap-1">
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground text-[12.5px] font-medium text-background">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Chat
          </span>
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium text-muted-foreground">
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </span>
        </div>
      </nav>
    </div>
  )
}

function UseCaseDemoCard({ useCase }: { useCase: (typeof demoUseCases)[number] }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Agent run
          </span>
          <h3 className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {useCase.title}
          </h3>
        </div>
      </div>

      <p className="mt-2 px-4 text-[12.5px] leading-relaxed text-muted-foreground">&ldquo;{useCase.prompt}&rdquo;</p>

      <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-border/60 bg-[#0c0c0b]">
        <div className="flex items-center gap-1.5 border-b border-background/10 px-3 py-2 text-[10.5px] text-background/45">
          <FileCode2 className="h-3 w-3" />
          <span className="truncate">{useCase.file}</span>
        </div>
        <div className="space-y-[1px] px-2 py-2">
          {useCase.diff.map((line, i) => (
            <DiffLine key={i} type={line.type as "add" | "del"} code={line.code} />
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1.5 px-4 py-4 text-[11.5px] text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        {useCase.result}
      </div>
    </article>
  )
}

export function LandingProductSection() {
  return (
    <>
      <Section className="relative overflow-hidden border-t border-border bg-[#f7f5ef] pt-20 sm:pt-28">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">The computer workspace</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
                The landing demo should look like the product.
              </h2>
            </div>
            <div className="lg:justify-self-end">
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                This section mirrors the actual computer page: file explorer, editor with live diffs, terminal output, and an agent feed that edits real files instead of narrating fake progress.
              </p>
              <div className="mt-7">
                <CapabilityPills items={capabilityPills} />
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section bleed className="bg-[#f7f5ef] pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Reveal delay={0.08}>
          <div className="mx-auto max-w-[82rem] px-4 sm:px-6 lg:px-8">
            <StaticComputerShell />
          </div>
        </Reveal>

        <div className="mx-auto mt-16 max-w-6xl">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Try it on a real task</p>
                <h3 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-foreground sm:text-3xl">
                  Same prompt → diff → result loop, every run.
                </h3>
              </div>
            </div>
          </Reveal>

          <RevealStagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {demoUseCases.map((useCase) => (
              <RevealItem key={useCase.title}>
                <UseCaseDemoCard useCase={useCase} />
              </RevealItem>
            ))}
          </RevealStagger>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <RevealStagger className="grid border-y border-border/70 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Prompt the computer",
                description: "Describe the app, routes, integrations, and style. Lotus turns it into a visible build plan before editing files.",
              },
              {
                step: "02",
                title: "Watch the run",
                description: "The feed shows planning, file edits, questions, preview state, and repair actions in the same place as the real workspace.",
              },
              {
                step: "03",
                title: "Inspect the preview",
                description: "Review the generated product in the workspace panel, switch tabs, reload the preview, and catch runtime issues quickly.",
              },
              {
                step: "04",
                title: "Continue from context",
                description: "Follow-up edits apply to the same project instead of starting over, so iteration feels closer to an IDE session.",
              },
            ].map((item) => (
              <RevealItem key={item.step}>
                <article className="group h-full border-border/70 py-7 transition duration-300 sm:px-5 sm:odd:border-r lg:border-r lg:last:border-r-0">
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">{item.step}</p>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </Section>
    </>
  )
}

// ─── everything below is unchanged ────────────────────────────────────────────

const featureRows = [
  {
    icon: Terminal,
    label: "Agent runtime",
    title: "Generation stays close to the working tree.",
    description: "The builder plans, writes, verifies, and repairs inside one project context so follow-up requests land on the existing code instead of starting from scratch.",
    detail: "Files, preview, logs, and fixes stay in the same run.",
  },
  {
    icon: Eye,
    label: "Preview first",
    title: "Every change is judged as a live product surface.",
    description: "The preview is not a decoration. It is the main review loop, with responsive viewing, reloads, runtime errors, and repair actions close at hand.",
    detail: "See the app as users will see it, then refine directly.",
  },
  {
    icon: GitBranch,
    label: "Production path",
    title: "Move from exploration to a real branch.",
    description: "Lotus is built for real projects: generated files, integrations, GitHub sync, environment variables, and deployment handoff all sit behind the workspace.",
    detail: "Prototype speed without throwing away the code path.",
  },
]

const terminalEvents = [
  "dependency allowlist passed",
  "generated files normalized",
  "preview booted on port 3000",
  "runtime errors cleared",
  "ready for next edit",
]

function TerminalLog() {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-background/10 bg-black/35 font-mono text-[12px] text-background/65">
      <div className="flex items-center justify-between border-b border-background/10 px-4 py-3 text-[11px] text-background/42">
        <span>runtime.log</span>
        <span>clean</span>
      </div>
      <div className="space-y-2 p-4">
        {terminalEvents.map((event) => (
          <div key={event} className="flex items-center gap-3">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>{event}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingFeaturesSection() {
  return (
    <Section id="features" className="border-t border-border bg-[#10100f] py-20 text-background sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            Less magic show. More working system.
          </h2>
          <p className="max-w-md text-sm leading-7 text-background/62 lg:justify-self-end">
            The middle of the product is built around feedback loops: write, preview, inspect, repair, and keep moving.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 divide-y divide-background/10 border-y border-background/10">
        {featureRows.map((item, index) => {
          const Icon = item.icon
          return (
            <Reveal key={item.title} delay={index * 0.05}>
              <article className="grid gap-6 py-9 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:items-center">
                <div className="flex items-center gap-3 text-sm text-background/52">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-background/12 bg-background/6 text-background">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{item.label}</span>
                </div>
                <div>
                  <h3 className="max-w-2xl text-2xl font-medium leading-tight tracking-[-0.035em] text-background sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-background/58">{item.description}</p>
                </div>
                <p className="rounded-2xl border border-background/10 bg-background/[0.045] p-4 text-sm leading-6 text-background/64">
                  {item.detail}
                </p>
              </article>
            </Reveal>
          )
        })}
      </div>

      <Reveal delay={0.16} className="mt-12">
        <TerminalLog />
      </Reveal>
    </Section>
  )
}

export function LandingUseCasesSection() {
  const sectionUseCases = [
    {
      title: "SaaS launch workspace",
      prompt: "Build a launch page, pricing, onboarding checklist, and authenticated dashboard shell.",
      output: "Routes, app shell, pricing table, onboarding states, preview URL.",
    },
    {
      title: "Internal operations tool",
      prompt: "Create a CRM workspace with lead filters, account details, notes, import status, and empty states.",
      output: "Table layout, filter controls, detail pane, sample data, export action.",
    },
    {
      title: "AI document review app",
      prompt: "Make a document review flow with upload, analysis queue, results, and export panel.",
      output: "Upload route, queue UI, review cards, status handling, preview checks.",
    },
    {
      title: "Preview repair run",
      prompt: "Fix the unresolved import and restart the preview without adding unsupported dependencies.",
      output: "Import repair, dependency validation, clean runtime log, refreshed preview.",
    },
  ]

  return (
    <Section id="use-cases" className="border-t border-border bg-background py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Demo use cases</p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl lg:text-5xl">
              Real prompts, real workspace outcomes.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            These are the kinds of runs that should feel natural inside the computer page, without dressing them up as fake product claims.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="mt-12 divide-y divide-border/70 border-y border-border/70">
        {sectionUseCases.map((useCase, index) => (
          <RevealItem key={useCase.title}>
            <article className="grid gap-5 py-8 lg:grid-cols-[120px_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">0{index + 1}</span>
              <h3 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-3xl">
                {useCase.title}
              </h3>
              <p className="text-sm leading-7 text-foreground/78">{useCase.prompt}</p>
              <p className="text-sm leading-7 text-muted-foreground">{useCase.output}</p>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </Section>
  )
}

export function LandingTestimonialsSection() {
  return (
    <Section id="testimonials" className="border-t border-border bg-[#efebe1] py-20 sm:py-28">
      <Reveal>
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <h2 className="max-w-md text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-4xl">
            Proof should look like the product working.
          </h2>
          <p className="max-w-md text-sm leading-7 text-muted-foreground lg:justify-self-end">
            No fake quote wall. The useful signal is whether the builder can keep context, recover from errors, and hand you code you can continue with.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal delay={0.05}>
          <div className="h-full rounded-[1.5rem] bg-[#10100f] p-6 text-background sm:p-8">
            <div className="flex items-center justify-between border-b border-background/10 pb-4 text-[12px] text-background/50">
              <span>session health</span>
              <span>last run</span>
            </div>
            <div className="mt-7 grid gap-6 sm:grid-cols-3">
              {[
                ["1", "workspace"],
                ["4", "validation gates"],
                ["0", "fake dependencies allowed"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-5xl font-medium tracking-[-0.06em] text-background">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-background/52">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-background/10 bg-background/[0.045] p-4">
              {[
                "Generate files",
                "Validate imports",
                "Start preview",
                "Repair from logs",
              ].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-background/8 py-3 last:border-b-0">
                  <span className="text-sm text-background/72">{item}</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: Code2, title: "Code remains inspectable", text: "Generated files stay visible as project artifacts, not hidden behind a one-off prompt result." },
              { icon: Layers, title: "Preview drives quality", text: "The live surface is where layout, responsiveness, runtime errors, and polish are judged." },
              { icon: Zap, title: "Follow-ups stay grounded", text: "Edits are applied against the current project state, so iteration feels like an IDE session." },
            ].map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="rounded-[1.25rem] border border-border/70 bg-background/75 p-5">
                  <Icon className="h-4 w-4 text-foreground" />
                  <h3 className="mt-4 text-lg font-medium tracking-[-0.02em] text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </article>
              )
            })}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

export function LandingClosingSection() {
  return (
    <Section className="border-t border-border bg-background pb-24 pt-16 sm:pb-32 sm:pt-20">
      <Reveal>
        <div className="grid gap-8 border-y border-border/70 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ready when the idea is</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.04em] text-foreground sm:text-5xl">
              Open the workspace. Keep the preview honest.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Start from the prompt in the hero, then use Lotus like a focused AI IDE for the first working version.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/projects"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90"
            >
              Open workspace
              <Play className="h-4 w-4 fill-current" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  )
}
