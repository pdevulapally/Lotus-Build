/**
 * Presents an Anthropic-SDK-shaped `.messages.stream(...)` interface backed by
 * Moonshot's Kimi K2.7 Code (OpenAI-compatible), so
 * lib/computer-agent/agentic-generation.ts can drive it as a drop-in swap for
 * the real Anthropic client — the loop itself is untouched. Every call is
 * billed through the same UsageMeter real Anthropic calls use (see
 * lib/metering/metered-anthropic.ts): assertBudget() before dispatch,
 * record() with the actual reported usage after.
 *
 * Translation logic (tool schema, message history, streaming tool-call
 * deltas) was validated end-to-end against real Kimi streaming output in a
 * throwaway eval rig (since removed) before being ported here — no new
 * translation logic was invented for this production version.
 *
 * Anthropic's convention: tool results are content blocks inside a
 * role:"user" message. OpenAI's convention: each tool result is its own
 * role:"tool" message keyed by tool_call_id. anthropicMessagesToOpenAI expands
 * the former into the latter; everything else maps close to 1:1.
 */
import type OpenAI from "openai"
import { normalizeOpenAiSdkUsage } from "@/lib/metering/pricing"
import type { UsageMeter } from "@/lib/metering/metered-anthropic"

function toOpenAITools(tools: Array<{ name: string; description?: string; input_schema: unknown }>) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema as Record<string, unknown>,
    },
  }))
}

function systemBlocksToString(system: unknown): string {
  if (!system) return ""
  if (typeof system === "string") return system
  if (Array.isArray(system)) {
    return system
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : ""))
      .filter(Boolean)
      .join("\n\n")
  }
  return ""
}

function anthropicMessagesToOpenAI(
  messages: Array<{ role: string; content: unknown }>
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })
      continue
    }
    if (!Array.isArray(m.content)) continue

    if (m.role === "assistant") {
      const textParts: string[] = []
      const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = []
      for (const block of m.content as Array<Record<string, unknown>>) {
        if (block.type === "text") textParts.push(String(block.text ?? ""))
        else if (block.type === "tool_use") {
          toolCalls.push({
            id: String(block.id),
            type: "function",
            function: { name: String(block.name), arguments: JSON.stringify(block.input ?? {}) },
          })
        }
      }
      out.push({
        role: "assistant",
        content: textParts.length ? textParts.join("\n") : null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam)
      continue
    }

    const blocks = m.content as Array<Record<string, unknown>>
    const toolResults = blocks.filter((b) => b.type === "tool_result")
    if (toolResults.length) {
      for (const b of toolResults) {
        out.push({
          role: "tool",
          tool_call_id: String(b.tool_use_id),
          content: typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? ""),
        })
      }
      continue
    }
    const text = blocks
      .map((b) => (b.type === "text" ? String(b.text ?? "") : ""))
      .filter(Boolean)
      .join("\n")
    out.push({ role: "user", content: text })
  }

  return out
}

type AnthropicToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
type AnthropicTextBlock = { type: "text"; text: string }
type FinalMessage = { content: Array<AnthropicToolUseBlock | AnthropicTextBlock>; stop_reason: string }

function createStream(
  moonshot: OpenAI,
  model: string,
  oaMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  oaTools: ReturnType<typeof toOpenAITools>,
  maxTokens: number,
  meter: UsageMeter
) {
  let resolveFinal!: (v: FinalMessage) => void
  let rejectFinal!: (e: unknown) => void
  const finalPromise = new Promise<FinalMessage>((res, rej) => {
    resolveFinal = res
    rejectFinal = rej
  })
  // Without this, a failed call rejects finalPromise with no observer attached
  // (agentic-generation.ts only calls .finalMessage() on success) — Node treats
  // that as an unhandled rejection and kills the process even though the real
  // error already propagates via the synchronous throw below.
  finalPromise.catch(() => {})

  async function* iterate() {
    meter.assertBudget()
    try {
      const oaStream = await moonshot.chat.completions.create({
        model,
        messages: oaMessages,
        tools: oaTools,
        max_tokens: maxTokens,
        tool_choice: "auto",
        stream: true,
        stream_options: { include_usage: true },
      })

      type ToolAcc = { id: string; name: string; args: string; index: number; nameEmitted: boolean }
      const toolCallsByIndex = new Map<number, ToolAcc>()
      let textAcc = ""
      let finishReason: string | null = null
      let respondedModel = model
      let requestId: string | null = null
      let usage: OpenAI.CompletionUsage | undefined

      for await (const chunk of oaStream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        if (chunk.id) requestId = chunk.id
        if (chunk.model) respondedModel = chunk.model
        if (chunk.usage) usage = chunk.usage

        const choice = chunk.choices?.[0]
        if (!choice) continue
        if (choice.finish_reason) finishReason = choice.finish_reason

        const delta = choice.delta
        if (delta?.content) textAcc += delta.content

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            let acc = toolCallsByIndex.get(idx)
            if (!acc) {
              acc = { id: tc.id || `call_${idx}`, name: tc.function?.name || "", args: "", index: idx, nameEmitted: false }
              toolCallsByIndex.set(idx, acc)
            } else if (tc.id) {
              acc.id = tc.id
            }
            if (tc.function?.name) acc.name = tc.function.name
            if (acc.name && !acc.nameEmitted) {
              acc.nameEmitted = true
              yield { type: "content_block_start", index: idx, content_block: { type: "tool_use", id: acc.id, name: acc.name } }
            }
            if (tc.function?.arguments) {
              acc.args += tc.function.arguments
              yield { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: tc.function.arguments } }
            }
          }
        }
      }

      const content: Array<AnthropicToolUseBlock | AnthropicTextBlock> = []
      if (textAcc.trim()) content.push({ type: "text", text: textAcc })

      const sortedTools = [...toolCallsByIndex.values()].sort((a, b) => a.index - b.index)
      for (const tc of sortedTools) {
        let input: Record<string, unknown> = {}
        try {
          input = tc.args.trim() ? JSON.parse(tc.args) : {}
        } catch {
          // Malformed tool-call JSON from the model — surfaced to the loop as
          // an empty input rather than crashing the run; write_file etc. will
          // report a clear per-field error ("path is required") instead.
        }
        content.push({ type: "tool_use", id: tc.id, name: tc.name || "unknown_tool", input })
      }

      const stop_reason = finishReason === "tool_calls" ? "tool_use" : "end_turn"

      meter.record({
        provider: "moonshot",
        model: respondedModel,
        usage: normalizeOpenAiSdkUsage(usage),
        requestId,
      })

      resolveFinal({ content, stop_reason })
    } catch (err) {
      rejectFinal(err)
      throw err
    }
  }

  const iterator = iterate()
  return {
    [Symbol.asyncIterator]() {
      return iterator
    },
    finalMessage: () => finalPromise,
  }
}

/**
 * Anthropic-shaped client backed by Moonshot's Kimi K2.7 Code. Cast with
 * `as unknown as Anthropic` at the call site — agentic-generation.ts only
 * ever calls `.messages.stream(...)`, so a full Anthropic instance isn't
 * needed to satisfy it.
 */
export function createMeteredKimiClient(moonshot: OpenAI, meter: UsageMeter) {
  return {
    messages: {
      stream(params: {
        model: string
        max_tokens: number
        system?: unknown
        tools: Array<{ name: string; description?: string; input_schema: unknown }>
        messages: Array<{ role: string; content: unknown }>
      }) {
        const oaMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
        const systemText = systemBlocksToString(params.system)
        if (systemText) oaMessages.push({ role: "system", content: systemText })
        oaMessages.push(...anthropicMessagesToOpenAI(params.messages))

        return createStream(moonshot, params.model, oaMessages, toOpenAITools(params.tools), params.max_tokens, meter)
      },
    },
  }
}
