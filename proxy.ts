import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_AI_PATHS = new Set(["/api/generate", "/api/computer/run"])
const MAX_PROMPT_SCAN_CHARS = 20_000

type SafetyDecision = {
  blocked: boolean
  category?: "prompt_injection" | "secrets_exfiltration" | "abuse"
  safeMessage?: string
}

const PROMPT_INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|messages|prompts)\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|rules|messages|prompts)\b/i,
  /\boverride\s+(the\s+)?(system|developer|safety|policy)\s+(prompt|message|instructions|rules)\b/i,
  /\breveal\s+(the\s+)?(system|developer|hidden|internal)\s+(prompt|message|instructions|rules)\b/i,
  /\bprint\s+(the\s+)?(system|developer|hidden|internal)\s+(prompt|message|instructions|rules)\b/i,
  /\bshow\s+me\s+(your\s+)?(system|developer|hidden|internal)\s+(prompt|message|instructions|rules)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\b.*\bmode\b/i,
  /\bact\s+as\s+(an\s+)?unrestricted\b/i,
]

const SECRET_EXFILTRATION_PATTERNS = [
  /\b(process\.env|\.env|env\s+vars?|environment\s+variables?)\b/i,
  /\b(api[_ -]?key|secret[_ -]?key|private[_ -]?key|service[_ -]?account|access[_ -]?token|refresh[_ -]?token)\b/i,
  /\b(exfiltrate|steal|dump|leak)\b.*\b(secret|token|key|credential|password)\b/i,
  /\bread\s+\/etc\/passwd\b/i,
  /\bread\s+(server|host|runtime)\s+files\b/i,
]

const ABUSE_PATTERNS = [
  /\b(phishing|credential\s+harvest|fake\s+login|steal\s+passwords?)\b/i,
  /\b(malware|ransomware|keylogger|trojan|botnet|backdoor)\b/i,
  /\b(bypass\s+auth|bypass\s+authentication|session\s+hijack|privilege\s+escalation)\b/i,
  /\b(sql\s+injection|xss|csrf|ssrf)\b.*\b(exploit|payload|attack|bypass)\b/i,
]

function getPromptLikeText(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const record = value as Record<string, unknown>
  const parts: string[] = []

  for (const key of ["prompt", "message", "input", "instructions"] as const) {
    const item = record[key]
    if (typeof item === "string") parts.push(item)
  }

  const metadata = record.metadata
  if (metadata && typeof metadata === "object") {
    for (const value of Object.values(metadata as Record<string, unknown>)) {
      if (typeof value === "string") parts.push(value)
    }
  }

  return parts.join("\n").slice(0, MAX_PROMPT_SCAN_CHARS)
}

function evaluatePromptSafety(prompt: string): SafetyDecision {
  const normalized = prompt.trim()
  if (!normalized) return { blocked: false }

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      blocked: true,
      category: "prompt_injection",
      safeMessage: "I can help build or edit your project, but I can’t follow requests to override system instructions or expose hidden prompts. Please describe the app change you want in normal product terms.",
    }
  }

  if (SECRET_EXFILTRATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      blocked: true,
      category: "secrets_exfiltration",
      safeMessage: "I can’t help access secrets, tokens, environment variables, or private server files. I can help add secure configuration handling, validation, or a safe integration flow instead.",
    }
  }

  if (ABUSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      blocked: true,
      category: "abuse",
      safeMessage: "I can’t help build harmful or deceptive functionality. I can help create defensive security tooling, abuse-resistant UX, or a safe educational demo.",
    }
  }

  return { blocked: false }
}

function safeJsonResponse(decision: SafetyDecision) {
  const safeMessage = decision.safeMessage || "I can’t help with that request, but I can help with a safe version of the task."

  return NextResponse.json(
    {
      ok: false,
      blocked: true,
      error: "unsafe_prompt",
      code: "unsafe_prompt",
      category: decision.category || "abuse",
      safeMessage,
      agentMessage: safeMessage,
      message: safeMessage,
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "X-Lotus-Safety-Block": decision.category || "unsafe_prompt",
      },
    },
  )
}

export async function proxy(req: NextRequest) {
  if (req.method !== "POST" || !PROTECTED_AI_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const contentType = req.headers.get("content-type") || ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.next()
  }

  let body: unknown
  try {
    body = await req.clone().json()
  } catch {
    return NextResponse.next()
  }

  const decision = evaluatePromptSafety(getPromptLikeText(body))
  if (decision.blocked) return safeJsonResponse(decision)

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/generate", "/api/computer/run"],
}
