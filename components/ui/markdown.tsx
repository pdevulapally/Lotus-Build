"use client"

import type { ComponentProps } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

const remarkPlugins = [remarkGfm]

/** Only web links leave the workspace; anything else renders as plain text. */
const safeHref = (href?: string) => {
  if (!href) return undefined
  try {
    const url = new URL(href, "https://lotusbuild.invalid")
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? href : undefined
  } catch {
    return undefined
  }
}

const components: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <h3 className="mt-5 mb-2 text-[17px] font-semibold tracking-[-0.025em] text-foreground first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-5 mb-2 text-[15.5px] font-semibold tracking-[-0.02em] text-foreground first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 mb-1.5 text-[14px] font-semibold text-foreground first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-3 mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:mt-0">{children}</h5>,
  h5: ({ children }) => <h6 className="mt-3 mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:mt-0">{children}</h6>,
  h6: ({ children }) => <h6 className="mt-3 mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:font-semibold marker:text-muted-foreground first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 [&>p]:my-0">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => {
    const safe = safeHref(href)
    return safe
      ? <a href={safe} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground">{children}</a>
      : <span>{children}</span>
  },
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-border pl-3.5 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-4 border-border" />,
  code: ({ className, children }) => {
    const block = typeof className === "string" && className.startsWith("language-")
    return block
      ? <code className={cn("font-mono text-[12.5px] leading-[1.6]", className)}>{children}</code>
      : <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>
  },
  pre: ({ children }) => <pre className="chat-scrollbar my-3 overflow-x-auto rounded-xl border border-border bg-muted/60 p-3.5 font-mono first:mt-0 last:mb-0">{children}</pre>,
  table: ({ children }) => <div className="chat-scrollbar my-3 overflow-x-auto rounded-xl border border-border"><table className="w-full border-collapse text-left text-[13px]">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-border bg-muted/60 px-3 py-2 font-semibold text-foreground">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-3 py-2 align-top last:border-b-0">{children}</td>,
  img: ({ alt }) => <span>{alt}</span>,
}

/** Assistant prose. Raw HTML is never rendered; links are restricted to web and mail schemes. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words text-[14px] leading-[1.75] text-foreground [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components} skipHtml>{children}</ReactMarkdown>
    </div>
  )
}
