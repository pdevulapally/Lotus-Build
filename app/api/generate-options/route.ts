import OpenAI from "openai"
import { z } from "zod"
import { requireUserUid } from "@/lib/server-auth"
import { assertRateLimit, RateLimitError, rateLimitResponse } from "@/lib/rate-limit"
import { assertTokenBalance, InsufficientTokensError, MeteringUserNotFoundError, recordUsageAndDebit } from "@/lib/metering/ledger"
import { normalizeOpenAiSdkUsage } from "@/lib/metering/pricing"

const ITEM_GUIDANCE: Record<string, string> = {
  audience: "Suggest realistic audience segments or buyer types only if the brief implies a few plausible directions.",
  pages: "Suggest likely pages or screens only when page structure is still open and choices would help the user move faster.",
  systems: "Suggest likely backend, auth, CMS, data, or payment needs only if the planning context would benefit from a quick checklist.",
  features: "Suggest core product capabilities only when there are a few coherent directions the user could pick from.",
  style: "Suggest a few visual directions only when style can reasonably be narrowed through quick choices.",
  content: "Suggest content direction choices only when the content question can be simplified into a few clear options.",
  scope: "Suggest scope directions only when the product could clearly be narrowed by choosing between a few levels of ambition.",
}

const requestSchema = z.object({
  itemKey: z.string().trim().min(1).max(64),
  blueprint: z.unknown(),
  prompt: z.string().trim().min(1).max(6000),
})

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  return apiKey ? new OpenAI({ apiKey }) : null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { itemKey, blueprint, prompt } = parsed.data

  // Authenticate
  let uid: string
  try {
    uid = await requireUserUid(req)
  } catch {
    return new Response(JSON.stringify({ error: 'Missing or invalid auth token' }), { status: 401 })
  }

  try {
    await assertRateLimit({
      scope: "generate-options",
      key: uid,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    })
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err)
    return Response.json({ error: "Failed to check request limits" }, { status: 500 })
  }

  try {
    await assertTokenBalance(uid)
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return new Response(JSON.stringify({ error: 'Insufficient tokens' }), { status: 402 })
    }
    if (err instanceof MeteringUserNotFoundError) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
    }
    return Response.json({ error: "Failed to check token balance" }, { status: 500 })
  }

  try {
    const openai = getOpenAIClient()
    if (!openai) {
      return Response.json({ error: "AI options service is not configured" }, { status: 500 })
    }

    const systemPrompt = `You are helping generate clarification options for a website/app planning process.

The user is building: ${prompt}

Current blueprint context:
${JSON.stringify(blueprint, null, 2)}

Current item under discussion: ${itemKey}

${ITEM_GUIDANCE[itemKey] || "Offer quick choices only if they genuinely help."}

Decide whether quick choices should be shown at all.
- If the user would be better served by open chat, set "show": false.
- If quick choices would help, set "show": true and generate concise but helpful options.
- Prefer 3-5 options.
- Avoid generic filler.
- Make helper copy feel conversational, not survey-like.
- Pick "single" or "multiple" based on the planning context, not by item key alone.

Return only valid JSON matching this shape:
{
  "show": true,
  "question": "string",
  "helper": "string",
  "selectionMode": "single" | "multiple",
  "allowsCustomAnswer": true,
  "options": ["option 1", "option 2"]
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Decide whether quick choices would help for ${itemKey}, and if so generate them.` }
      ],
      max_tokens: 300,
    })

    await recordUsageAndDebit({
      uid,
      feature: "generate-options",
      provider: "openai",
      model: completion.model || "gpt-5-mini",
      usage: normalizeOpenAiSdkUsage(completion.usage),
      requestId: completion.id ?? null,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("No content generated")
    }

    const payload = JSON.parse(content)
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid response format")
    }

    return Response.json({
      show: payload.show === true,
      question: typeof payload.question === "string" ? payload.question : null,
      helper: typeof payload.helper === "string" ? payload.helper : null,
      selectionMode: payload.selectionMode === "multiple" ? "multiple" : "single",
      allowsCustomAnswer: payload.allowsCustomAnswer !== false,
      options: Array.isArray(payload.options) ? payload.options : [],
    })
  } catch (error) {
    console.error("Generate options error:", error)
    return new Response(JSON.stringify({ error: 'Failed to generate options' }), { status: 500 })
  }
}
