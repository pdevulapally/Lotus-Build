import { adminAuth } from "@/lib/firebase-admin"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"
import { parsePublicHttpUrl } from "@/lib/security/url"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { url?: unknown; idToken?: unknown } | null
  if (!body || typeof body.idToken !== "string") {
    return NextResponse.json({ error: "Missing url or idToken" }, { status: 400 })
  }

  const parsedUrl = parsePublicHttpUrl(body.url)
  if (!parsedUrl) {
    return NextResponse.json({ error: "Enter a public http(s) URL." }, { status: 400 })
  }

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
  if (!firecrawlApiKey) {
    return NextResponse.json({ error: "Clone service is not configured" }, { status: 500 })
  }

  const idToken = body.idToken

  // Verify Firebase ID token
  let uid = ""
  try {
    const decoded = await adminAuth.verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: "Invalid idToken" }, { status: 401 })
  }

  try {
    await assertRateLimit({
      scope: "clone",
      key: uid,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    throw error
  }

  // Scrape via Firecrawl
  let firecrawlRes: Response
  try {
    firecrawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: parsedUrl.toString(), formats: ["markdown"], onlyMainContent: true }),
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 })
  }

  if (!firecrawlRes.ok) {
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 400 })
  }

  const data = await firecrawlRes.json().catch(() => null)
  const payload = data?.data ?? data ?? {}
  const markdown: string = payload?.markdown ?? ""
  const title: string = payload?.metadata?.title ?? ""
  const description: string = payload?.metadata?.description ?? ""

  return NextResponse.json({
    title,
    description,
    markdown: markdown.slice(0, 6000),
    sourceUrl: parsedUrl.toString(),
  })
}
