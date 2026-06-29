const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v2"
const TAVILY_API_BASE = "https://api.tavily.com"
const FIRECRAWL_COMPAT_ID_PREFIX = "tavily-compat-"

function getTavilyApiKey() {
  return process.env.TAVILY_API_KEY || process.env.TAVILY_KEY || ""
}

async function readJsonBody(init?: RequestInit) {
  if (!init?.body) return {}
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
}

function getRequestUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isFirecrawlUrl(url: string) {
  return url.startsWith(FIRECRAWL_API_BASE)
}

async function callTavily(path: "/search" | "/extract" | "/crawl" | "/research", body: Record<string, unknown>, signal?: AbortSignal | null) {
  const apiKey = getTavilyApiKey()
  if (!apiKey) {
    return jsonResponse({ error: "Tavily is not configured" }, { status: 503 })
  }

  return fetch(`${TAVILY_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: signal || undefined,
  })
}

function normalizeTavilySearchResult(result: unknown) {
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {}
  const title = typeof record.title === "string" && record.title.trim() ? record.title.trim() : "Untitled result"
  const url = typeof record.url === "string" ? record.url.trim() : ""
  const description = typeof record.content === "string" && record.content.trim()
    ? record.content.trim().slice(0, 500)
    : typeof record.raw_content === "string" && record.raw_content.trim()
      ? record.raw_content.trim().slice(0, 500)
      : undefined

  return url.startsWith("http") ? { title, url, ...(description ? { description } : {}) } : null
}

async function firecrawlSearchCompat(init?: RequestInit) {
  const body = await readJsonBody(init)
  const query = typeof body.query === "string" ? body.query : ""
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 10) : 5
  const tavilyRes = await callTavily("/search", {
    query,
    max_results: limit,
    search_depth: "advanced",
    include_answer: false,
    include_raw_content: false,
  }, init?.signal)

  if (!tavilyRes.ok) return tavilyRes
  const data = await tavilyRes.json().catch(() => ({})) as Record<string, unknown>
  const results = Array.isArray(data.results)
    ? data.results.map(normalizeTavilySearchResult).filter(Boolean)
    : []

  return jsonResponse({ data: results })
}

function extractTargetUrlFromFirecrawlExecute(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code : ""
  const match = code.match(/page\.goto\((".*?"|'.*?')/)
  if (!match?.[1]) return ""
  try {
    return JSON.parse(match[1].replace(/^'/, '"').replace(/'$/, '"')) as string
  } catch {
    return match[1].slice(1, -1)
  }
}

async function extractWithTavily(url: string, signal?: AbortSignal | null) {
  const tavilyRes = await callTavily("/extract", {
    urls: [url],
    extract_depth: "advanced",
    format: "markdown",
    include_images: true,
    include_favicon: true,
  }, signal)

  if (!tavilyRes.ok) return tavilyRes
  const data = await tavilyRes.json().catch(() => ({})) as Record<string, unknown>
  const results = Array.isArray(data.results) ? data.results : []
  const first = results[0] && typeof results[0] === "object" ? results[0] as Record<string, unknown> : {}
  const rawContent = typeof first.raw_content === "string" ? first.raw_content : ""
  const images = Array.isArray(first.images)
    ? first.images.filter((image): image is string => typeof image === "string" && image.startsWith("http")).slice(0, 24)
    : []

  return jsonResponse({
    data: {
      metadata: {
        title: url,
        description: rawContent.slice(0, 240),
      },
      markdown: rawContent,
      images,
    },
  })
}

async function firecrawlScrapeCompat(init?: RequestInit) {
  const body = await readJsonBody(init)
  const url = typeof body.url === "string" ? body.url : ""
  if (!url.startsWith("http")) {
    return jsonResponse({ error: "Invalid URL" }, { status: 400 })
  }
  return extractWithTavily(url, init?.signal)
}

function firecrawlBrowserCreateCompat() {
  const id = `${FIRECRAWL_COMPAT_ID_PREFIX}${crypto.randomUUID()}`
  return jsonResponse({
    id,
    interactiveLiveViewUrl: "https://app.tavily.com",
    liveViewUrl: "https://app.tavily.com",
  })
}

async function firecrawlBrowserExecuteCompat(init?: RequestInit) {
  const body = await readJsonBody(init)
  const targetUrl = extractTargetUrlFromFirecrawlExecute(body)
  if (!targetUrl.startsWith("http")) {
    return jsonResponse({ error: "Could not resolve target URL for Tavily extraction" }, { status: 400 })
  }

  const extractRes = await extractWithTavily(targetUrl, init?.signal)
  if (!extractRes.ok) return extractRes
  const wrapped = await extractRes.json().catch(() => ({})) as { data?: { markdown?: string; images?: string[]; metadata?: { title?: string; description?: string } } }
  const markdown = wrapped.data?.markdown || ""
  const imageUrls = wrapped.data?.images || []
  const result = {
    title: wrapped.data?.metadata?.title || targetUrl,
    description: wrapped.data?.metadata?.description || markdown.slice(0, 240),
    domOutline: markdown
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^#{1,3}\s+/.test(line))
      .slice(0, 40),
    sections: markdown
      .split(/\n(?=#{1,3}\s+)/)
      .map((section) => {
        const heading = section.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() || ""
        return { tag: "section", heading, text: section.replace(/\s+/g, " ").trim().slice(0, 700) }
      })
      .filter((section) => section.text)
      .slice(0, 24),
    textContent: markdown.replace(/\s+/g, " ").trim().slice(0, 6000),
    links: [],
    images: imageUrls.map((src) => ({ alt: "", src })),
    visualBrief: [
      "Provider: Tavily Extract",
      `Source URL: ${targetUrl}`,
      "Use extracted headings, copy, and images as web evidence for the build brief.",
    ],
  }

  return jsonResponse({ result: JSON.stringify(result) })
}

async function firecrawlCrawlCompat(init?: RequestInit) {
  const body = await readJsonBody(init)
  const url = typeof body.url === "string" ? body.url : typeof body.startUrl === "string" ? body.startUrl : ""
  if (!url.startsWith("http")) {
    return jsonResponse({ error: "Invalid URL" }, { status: 400 })
  }
  const tavilyRes = await callTavily("/crawl", {
    url,
    instructions: typeof body.instructions === "string" ? body.instructions : "Extract useful website content for AI research.",
    max_depth: typeof body.maxDepth === "number" ? body.maxDepth : 2,
    limit: typeof body.limit === "number" ? body.limit : 10,
  }, init?.signal)
  return tavilyRes
}

async function firecrawlResearchCompat(init?: RequestInit) {
  const body = await readJsonBody(init)
  const input = typeof body.input === "string"
    ? body.input
    : typeof body.query === "string"
      ? body.query
      : ""
  if (!input.trim()) {
    return jsonResponse({ error: "Invalid research input" }, { status: 400 })
  }
  return callTavily("/research", { input, model: "auto" }, init?.signal)
}

async function firecrawlCompatFetch(input: Parameters<typeof fetch>[0], init?: RequestInit) {
  const url = getRequestUrl(input)
  const pathname = new URL(url).pathname

  if (pathname === "/v2/search") return firecrawlSearchCompat(init)
  if (pathname === "/v2/scrape") return firecrawlScrapeCompat(init)
  if (pathname === "/v2/browser") return firecrawlBrowserCreateCompat()
  if (/^\/v2\/browser\/[^/]+\/execute$/.test(pathname)) return firecrawlBrowserExecuteCompat(init)
  if (pathname === "/v2/crawl") return firecrawlCrawlCompat(init)
  if (pathname === "/v2/research") return firecrawlResearchCompat(init)

  return fetch(input, init)
}

export async function register() {
  const originalFetch = globalThis.fetch
  if ((globalThis as unknown as { __lotusTavilyFetchPatched?: boolean }).__lotusTavilyFetchPatched) return

  ;(globalThis as unknown as { __lotusTavilyFetchPatched?: boolean }).__lotusTavilyFetchPatched = true
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = getRequestUrl(input)
    if (!isFirecrawlUrl(url)) return originalFetch(input, init)
    return firecrawlCompatFetch(input, init)
  }) as typeof fetch
}
