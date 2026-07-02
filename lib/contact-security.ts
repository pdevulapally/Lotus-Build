// Server-only. Bot protection and input hardening for the contact form.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"

// Proof-of-interaction token: issued when the form mounts, required on submit.
// Signed with a key derived from the Firebase service-account secret already in
// the environment, so it verifies across serverless instances with no storage.
const TOKEN_MIN_AGE_MS = 3500 // submitting faster than this means a script, not a human
const TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000

function signingKey(): Buffer {
  const secret = process.env.FIREBASE_PRIVATE_KEY
  if (!secret) throw new Error("Missing required env var: FIREBASE_PRIVATE_KEY")
  return createHash("sha256").update(`contact-token:${secret}`).digest()
}

export function issueContactToken(): string {
  const payload = `${Date.now()}.${randomBytes(8).toString("hex")}`
  const signature = createHmac("sha256", signingKey()).update(payload).digest("hex")
  return `${payload}.${signature}`
}

export type ContactTokenVerdict = "valid" | "too_fast" | "expired" | "invalid"

export function verifyContactToken(token: string): ContactTokenVerdict {
  const parts = token.split(".")
  if (parts.length !== 3) return "invalid"

  const [issuedAtRaw, nonce, signature] = parts
  const expected = createHmac("sha256", signingKey()).update(`${issuedAtRaw}.${nonce}`).digest()
  const provided = Buffer.from(signature, "hex")
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return "invalid"
  }

  const issuedAt = Number(issuedAtRaw)
  if (!Number.isFinite(issuedAt)) return "invalid"

  const age = Date.now() - issuedAt
  if (age < 0) return "invalid"
  if (age < TOKEN_MIN_AGE_MS) return "too_fast"
  if (age > TOKEN_MAX_AGE_MS) return "expired"
  return "valid"
}

// Control characters, zero-width characters, and bidi override characters —
// none of these belong in text a person typed into a support form.
const STRIP_RANGES: Array<[number, number]> = [
  [0x0000, 0x0008], // C0 controls before tab and newline
  [0x000b, 0x000c], // vertical tab, form feed
  [0x000e, 0x001f], // remaining C0 controls
  [0x007f, 0x009f], // DEL and C1 controls
  [0x200b, 0x200f], // zero-width and directional marks
  [0x202a, 0x202e], // bidi embedding and override
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // zero-width no-break space / BOM
]

const STRIP_PATTERN = new RegExp(
  `[${STRIP_RANGES.map(([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`).join("")}]`,
  "gu",
)

export function sanitizeText(value: string, maxLength: number, multiline = false): string {
  const stripped = value.normalize("NFKC").replace(STRIP_PATTERN, "")
  const collapsed = multiline
    ? stripped.replace(/\r\n?/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n")
    : stripped.replace(/\s+/g, " ")
  return collapsed.trim().slice(0, maxLength)
}

const THREAT_PATTERNS = [
  { flag: "html-injection", pattern: /<\s*\/?\s*(script|iframe|object|embed|svg|img|link|meta|style|form|base)\b/i },
  { flag: "javascript-uri", pattern: /javascript\s*:/i },
  { flag: "data-uri", pattern: /data\s*:[^,\s]*(text\/html|base64)/i },
  {
    flag: "event-handler",
    pattern: /\bon(abort|blur|click|dblclick|error|focus\w*|input|key(down|press|up)|load\w*|mouse\w+|pointer\w+|reset|scroll|submit|touch\w+|wheel)\s*=/i,
  },
  { flag: "header-injection", pattern: /[\r\n](to|from|cc|bcc|subject|reply-to|content-type)\s*:/i },
] as const

export function scanForThreats(fields: Record<string, string>): string[] {
  const flags = new Set<string>()
  for (const value of Object.values(fields)) {
    for (const { flag, pattern } of THREAT_PATTERNS) {
      if (pattern.test(value)) flags.add(flag)
    }
  }
  return [...flags]
}

export function countLinks(value: string): number {
  return value.match(/(https?:\/\/|www\.)/gi)?.length ?? 0
}
