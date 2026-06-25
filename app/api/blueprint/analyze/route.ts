import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUserUid } from "@/lib/server-auth"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"

interface AnalyzeRequest {
  prompt: string
  existingBlueprint?: {
    sections: Array<{
      id: string
      items: Array<{
        key: string
        label: string
        value: string
        status: string
      }>
    }>
  }
}

const blueprintItemSchema = z.object({
  id: z.string().max(120).optional(),
  key: z.string().max(120),
  label: z.string().max(240),
  value: z.string().max(1200),
  status: z.string().max(32),
})

const analyzeRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(6000),
  existingBlueprint: z.object({
    sections: z.array(z.object({
      id: z.string().max(120),
      items: z.array(blueprintItemSchema).max(24),
    })).max(12),
  }).optional(),
})

interface DetectionResult {
  key: string
  value: string
  status: "confirmed" | "suggested" | "unknown"
  reasoning?: string
}

interface AnalyzeResponse {
  type: DetectionResult
  audience: DetectionResult
  pages: DetectionResult
  features: DetectionResult
  style: DetectionResult
  systems: DetectionResult
  content: DetectionResult
  scope: DetectionResult
}

const ANALYSIS_PROMPT = `You are an expert product strategist analyzing a project brief to extract key product insights.

Given the user's project prompt, extract and infer the following attributes with confidence:
- type: What kind of product (Marketing website, Dashboard or product workspace, Web app or SaaS product, E-commerce website, etc.)
- audience: Who the product is for
- pages: Key pages or screens needed
- features: Core features or capabilities
- style: Visual direction and brand cues
- systems: Backend, auth, payments, CMS, integrations needed
- content: Content and brand asset needs
- scope: How ambitious the first build should be (MVP, Full-featured, etc.)

For each attribute, return:
1. value: A concise, natural description
2. status: "confirmed" (directly stated), "suggested" (inferred from context), or "unknown" (not enough info)
3. reasoning: Brief explanation of why you chose this status

Be thoughtful and consider the user's intent. If something is ambiguous, mark it as "suggested" rather than "unknown".
Prefer specific, actionable insights over generic placeholders.
Avoid overthinking - if the brief doesn't mention something, mark it "unknown" unless you can reasonably infer it.

Return your analysis as a JSON object matching this exact structure:
{
  "type": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "audience": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "pages": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "features": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "style": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "systems": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "content": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" },
  "scope": { "value": "string", "status": "confirmed|suggested|unknown", "reasoning": "string" }
}

Project brief:
`

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserUid(request)
    await assertRateLimit({
      scope: "blueprint-analyze",
      key: uid,
      limit: 80,
      windowMs: 60 * 60 * 1000,
    })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI analysis is not configured" },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsedBody = analyzeRequestSchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid analysis request" }, { status: 400 })
    }

    const { prompt, existingBlueprint } = parsedBody.data as AnalyzeRequest

    const contextAddendum =
      existingBlueprint && existingBlueprint.sections.length > 0
        ? `\n\nExisting blueprint context:\n${existingBlueprint.sections
            .flatMap((s) =>
              s.items
                .filter((i) => i.status !== "unknown")
                .map((i) => `- ${i.label}: "${i.value}" (${i.status})`)
            )
            .join("\n")}`
        : ""

    const fullPrompt = ANALYSIS_PROMPT + prompt + contextAddendum

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          temperature: 0.2,
          messages: [{ role: "user", content: fullPrompt }],
          max_tokens: 1200,
        }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 503 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    const jsonStart = content.indexOf("{")
    const jsonEnd = content.lastIndexOf("}")
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json(
        { error: "Invalid AI response" },
        { status: 500 }
      )
    }

    const parsed: AnalyzeResponse = JSON.parse(
      content.slice(jsonStart, jsonEnd + 1)
    )

    return NextResponse.json(parsed)
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    const message = error instanceof Error ? error.message : "Failed to analyze blueprint"
    const status = message.includes("Authorization") ? 401 : message.includes("Forbidden") ? 403 : 500
    if (status === 500) {
      console.error("Blueprint analysis error:", error)
    }
    return NextResponse.json(
      { error: status === 500 ? "Failed to analyze blueprint" : message },
      { status }
    )
  }
}
