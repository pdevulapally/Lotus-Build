/**
 * Renders the real `AgentFeed` to static markup outside Next: the component is transpiled on the fly and its
 * two Next-only presentational imports (shimmer, markdown) are replaced by plain elements. Shared by the feed
 * render tests and the event-pipeline fixtures so both look at the same component.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { AgentFeed, splitStableBlocks } from '../../components/computer/agent-feed'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../../components/computer/agent-feed.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { AgentFeed: typeof AgentFeed; splitStableBlocks: typeof splitStableBlocks } }
const isolatedRequire = (id: string) => {
  // The thought row has its own render test; here it reports what the feed hands it.
  if (id === '@/components/ai-elements/thinking-reasoning') return { ThinkingReasoning: ({ text, streaming, startedAt, completedAt }: { text: string; streaming: boolean; startedAt: string; completedAt?: string }) =>
    createElement('div', { 'data-thinking': streaming ? 'streaming' : 'done', 'data-started': startedAt, 'data-completed': completedAt }, text) }
  if (id === '@/components/ai-elements/shimmer') return { Shimmer: ({ children }: { children: ReactNode }) => createElement('span', null, children) }
  if (id === '@/components/ui/markdown') return { Markdown: ({ children }: { children: ReactNode }) => createElement('p', null, children) }
  return require(id.startsWith('@/') ? `../../${id.slice(2)}` : id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)

export const agentFeedModule = module.exports
export type AgentFeedProps = ComponentProps<typeof AgentFeed>
export const renderAgentFeed = (props: Partial<AgentFeedProps>): string => renderToStaticMarkup(createElement(module.exports.AgentFeed, {
  canonicalMessages: [], events: [], localMessages: [], status: 'running', editingIndex: null, editText: '', ...props,
}))
