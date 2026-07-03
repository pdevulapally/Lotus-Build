/**
 * METERED MODEL CLIENT
 *
 * The only sanctioned way for a route to talk to a model provider. Wraps an
 * Anthropic client so that every `messages.create`, `messages.stream`, and
 * `beta.messages.create` call automatically:
 *
 *   1. checks the run's remaining budget before dispatch (circuit breaker),
 *   2. captures the provider-reported usage on completion — including
 *      partially-streamed usage when a stream aborts mid-generation, and
 *   3. writes an idempotent ledger event + balance debit via recordUsageAndDebit.
 *
 * Call sites cannot forget to bill: if a route holds a metered client, its
 * spend is accounted for. Do not construct raw `new Anthropic(...)` clients in
 * route handlers — create one base client and wrap it per request with
 * `createMeteredAnthropic(base, meter)`.
 *
 * Non-Anthropic providers (NVIDIA/OpenAI-compatible) report usage through
 * `UsageMeter.record(...)` directly at their call site.
 */
import type Anthropic from "@anthropic-ai/sdk"
import {
  addUsage,
  computeChargedTokens,
  emptyUsage,
  hasUsage,
  normalizeAnthropicSdkUsage,
  type NormalizedUsage,
} from "./pricing"
import {
  InsufficientTokensError,
  recordUsageAndDebit,
  type UsageProvider,
} from "./ledger"

export type MeterContext = {
  uid: string
  feature: string
  runId?: string | null
}

export type MeterRecordInput = {
  provider: UsageProvider
  model: string
  usage: NormalizedUsage | null
  requestId?: string | null
  meta?: Record<string, number | string | boolean | null>
}

export class UsageMeter {
  private spentTokens = 0
  private pending: Promise<unknown>[] = []

  constructor(
    private readonly ctx: MeterContext,
    private readonly opts: { remainingTokens?: number | null } = {}
  ) {}

  /** Charged app tokens accumulated by this meter so far (local, synchronous). */
  get spent(): number {
    return this.spentTokens
  }

  /**
   * Records one model call. Charging math runs synchronously (feeds the
   * circuit breaker); ledger persistence runs in the background and is
   * awaited by flush(). A persistence failure is logged with the full
   * payload so it can be reconciled — it never crashes the run.
   */
  record(input: MeterRecordInput): number {
    const reported = input.usage ? computeChargedTokens(input.model, input.usage) : 0
    const remaining = this.opts.remainingTokens
    const localRemaining = remaining == null ? null : Math.max(0, remaining - this.spentTokens)
    const charged = localRemaining == null ? reported : Math.min(reported, localRemaining)
    this.spentTokens += charged

    const persist = recordUsageAndDebit({
      uid: this.ctx.uid,
      feature: this.ctx.feature,
      runId: this.ctx.runId ?? null,
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      requestId: input.requestId ?? null,
      meta: input.meta,
    }).catch((err) => {
      console.error(
        "[metering] Failed to persist usage event — reconcile manually:",
        JSON.stringify({ ctx: this.ctx, input, reportedTokens: reported, localChargedTokens: charged }),
        err
      )
    })
    this.pending.push(persist)
    return charged
  }

  /**
   * Circuit breaker: throws once the run has spent past the balance it
   * started with, so an agent loop stops instead of running unbilled.
   */
  assertBudget(): void {
    const remaining = this.opts.remainingTokens
    if (remaining != null && this.spentTokens >= remaining) {
      throw new InsufficientTokensError(
        `Token balance exhausted mid-run (spent ${this.spentTokens} of ${remaining} available)`
      )
    }
  }

  /** Awaits all outstanding ledger writes. Call before the route returns. */
  async flush(): Promise<void> {
    const pending = this.pending
    this.pending = []
    await Promise.allSettled(pending)
  }
}

// ---------------------------------------------------------------------------
// Anthropic client wrapping
// ---------------------------------------------------------------------------

function recordAnthropicMessage(meter: UsageMeter, response: unknown): void {
  const res = response as { usage?: unknown; model?: string; id?: string } | null | undefined
  meter.record({
    provider: "anthropic",
    model: res?.model ?? "unknown",
    usage: normalizeAnthropicSdkUsage(res?.usage),
    requestId: res?.id ?? null,
  })
}

/**
 * Observes a MessageStream (from `messages.stream(...)`). Prefers the final
 * message's authoritative usage; when the stream errors or aborts, falls back
 * to usage accumulated from `message_start` / `message_delta` events so
 * partially-generated output is still billed at actuals.
 */
function observeMessageStream(stream: unknown, meter: UsageMeter): void {
  let partial = emptyUsage()
  let model = "unknown"
  let requestId: string | null = null
  let recorded = false

  const recordOnce = (usage: NormalizedUsage | null, m: string, id: string | null) => {
    if (recorded) return
    recorded = true
    meter.record({ provider: "anthropic", model: m, usage, requestId: id })
  }

  const s = stream as {
    on?: (event: string, cb: (arg: unknown) => void) => unknown
    finalMessage?: () => Promise<{ usage?: unknown; model?: string; id?: string }>
  }

  try {
    s.on?.("streamEvent", (event: unknown) => {
      const ev = event as {
        type?: string
        message?: { model?: string; id?: string; usage?: unknown }
        usage?: { output_tokens?: number | null }
      }
      if (ev?.type === "message_start" && ev.message) {
        model = ev.message.model ?? model
        requestId = ev.message.id ?? requestId
        partial = normalizeAnthropicSdkUsage(ev.message.usage) ?? partial
      } else if (ev?.type === "message_delta" && ev.usage?.output_tokens != null) {
        partial = { ...partial, outputTokens: Math.max(partial.outputTokens, ev.usage.output_tokens) }
      }
    })
  } catch {
    // Observation must never break the stream for the consumer.
  }

  if (typeof s.finalMessage === "function") {
    s.finalMessage()
      .then((msg) => recordOnce(normalizeAnthropicSdkUsage(msg?.usage), msg?.model ?? model, msg?.id ?? requestId))
      .catch(() => recordOnce(hasUsage(partial) ? partial : null, model, requestId))
  }
}

/**
 * Observes a raw event stream (from `messages.create({ stream: true })`).
 * Uses `tee()` so the consumer's iteration is untouched while a background
 * reader accumulates usage from the duplicate.
 */
function meterRawEventStream(streamPromise: Promise<unknown>, meter: UsageMeter): Promise<unknown> {
  return streamPromise.then((stream) => {
    const s = stream as { tee?: () => [unknown, unknown] }
    if (typeof s?.tee !== "function") return stream
    const [consumerStream, meterStream] = s.tee()

    void (async () => {
      let partial = emptyUsage()
      let model = "unknown"
      let requestId: string | null = null
      try {
        for await (const event of meterStream as AsyncIterable<unknown>) {
          const ev = event as {
            type?: string
            message?: { model?: string; id?: string; usage?: unknown }
            usage?: { output_tokens?: number | null }
          }
          if (ev?.type === "message_start" && ev.message) {
            model = ev.message.model ?? model
            requestId = ev.message.id ?? requestId
            partial = normalizeAnthropicSdkUsage(ev.message.usage) ?? partial
          } else if (ev?.type === "message_delta" && ev.usage?.output_tokens != null) {
            partial = { ...partial, outputTokens: Math.max(partial.outputTokens, ev.usage.output_tokens) }
          }
        }
      } catch {
        // Consumer-side errors surface on their copy; we bill what we saw.
      }
      meter.record({
        provider: "anthropic",
        model,
        usage: hasUsage(partial) ? partial : null,
        requestId,
      })
    })()

    return consumerStream
  })
}

function wrapMessagesNamespace<T extends object>(messages: T, meter: UsageMeter): T {
  return new Proxy(messages, {
    get(target, prop, receiver) {
      if (prop === "create") {
        return (...args: unknown[]) => {
          meter.assertBudget()
          const params = args[0] as { stream?: boolean } | undefined
          const result = (target as { create: (...a: unknown[]) => Promise<unknown> }).create.apply(target, args)
          if (params?.stream) return meterRawEventStream(result, meter)
          return result.then((response) => {
            recordAnthropicMessage(meter, response)
            return response
          })
        }
      }
      if (prop === "stream") {
        return (...args: unknown[]) => {
          meter.assertBudget()
          const stream = (target as unknown as { stream: (...a: unknown[]) => unknown }).stream.apply(target, args)
          observeMessageStream(stream, meter)
          return stream
        }
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
}

/**
 * Wraps an Anthropic client so every message call is billed through the meter.
 * The base client is safe to share; the wrapper carries the per-request meter.
 */
export function createMeteredAnthropic(client: Anthropic, meter: UsageMeter): Anthropic {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "messages") {
        return wrapMessagesNamespace(target.messages, meter)
      }
      if (prop === "beta") {
        const beta = target.beta
        return new Proxy(beta, {
          get(betaTarget, betaProp, betaReceiver) {
            if (betaProp === "messages") {
              return wrapMessagesNamespace(betaTarget.messages as object, meter)
            }
            const value = Reflect.get(betaTarget, betaProp, betaReceiver)
            return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(betaTarget) : value
          },
        })
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  }) as Anthropic
}
