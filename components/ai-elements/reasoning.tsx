"use client"

import * as React from "react"
import { Markdown } from "@/components/ui/markdown"

/**
 * The agent's streamed reasoning, as text. Model-authored and possibly
 * mid-stream: payloads and echoed tool output are stripped, complete code
 * fences become code blocks, an unclosed fence stays literal, and prose is
 * rendered through the sanitising Markdown component — never as raw HTML.
 */
/** Keep model-facing JSON payloads out of the thought-process prose. */
function stripAgentPayloads(text: string): string {
  return text
    // Standalone JSON payloads with a "type" key (multiline or compact)
    .replace(/^[ \t]*\{\s*\n?[ \t]*"type"\s*:\s*"[^"]*"[\s\S]*?^[ \t]*\}[ \t]*$/gm, "")
    .replace(/^[ \t]*\{\s*"type"\s*:\s*"[^"]*"[^}]*\}[ \t]*$/gm, "")
    // Truncated standalone JSON payload still streaming (no closing brace yet)
    .replace(/^[ \t]*\{\s*\n?[ \t]*"type"\s*:\s*"[^"]*"[\s\S]*$/gm, "")
}

export function sanitizeReasoningText(text: string): string {
  return stripAgentPayloads(text)
    .replace(/\*{0,2}Tool:\*{0,2}\s*\S+[^\n]*\n[ \t]*\*{0,2}Query:\*{0,2}[^\n]+/g, "")
    .replace(/^[ \t]*\*{0,2}Tool:\*{0,2}[^\n]*$/gm, "")
    // Strip tool result blocks echoed into reasoning (e.g. "Assistant (research_results): ...")
    .replace(/^Assistant\s*\([^)]*\):[^\n]*(?:\n(?!\n)[^\n]*)*/gm, "")
    // Normalise to at most one blank line between paragraphs
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}


type TextBlock = { type: "text"; content: string }
type CodeBlock = { type: "code"; lang: string; content: string }
type ContentBlock = TextBlock | CodeBlock

export function parseContentBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    blocks.push({ type: "code", lang: match[1] ?? "", content: match[2] ?? "" })
    lastIndex = match.index + match[0].length
  }

  const remaining = text.slice(lastIndex)
  if (remaining) {
    blocks.push({ type: "text", content: remaining })
  }

  return blocks
}

function renderContentBlocks(blocks: ContentBlock[]): React.ReactNode {
  return blocks.map((block, i) => {
    if (block.type === "code") {
      return (
        <pre
          key={i}
          className="my-3 overflow-x-auto rounded-xl bg-muted/55 p-3 font-mono text-xs leading-6 [overflow-wrap:normal]"
        >
          {block.lang ? (
            <span className="mb-2 block font-sans text-xs font-medium text-muted-foreground">{block.lang}</span>
          ) : null}
          <code className="whitespace-pre text-foreground/75">{block.content}</code>
        </pre>
      )
    }
    // An incomplete fence stays literal until parseContentBlocks receives its closing fence.
    if (block.content.includes('```')) return <span key={i} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{block.content}</span>
    return <Markdown key={i} className="text-sm leading-7 text-muted-foreground [&_p]:my-3 [&_h3]:text-sm [&_h4]:text-sm [&_blockquote]:border-0 [&_blockquote]:pl-0 [&_hr]:hidden">{block.content}</Markdown>
  })
}

export function ReasoningBlocks({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{renderContentBlocks(parseContentBlocks(sanitizeReasoningText(text)))}</div>
}
