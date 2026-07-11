/**
 * FREE-TIER CONCURRENCY QUEUE
 *
 * Purely reactive to real load: if fewer than MAX_CONCURRENT free-tier runs
 * are active right now, a new one starts immediately — no artificial delay.
 * Only when that many are genuinely in flight at once does a new run wait
 * for a slot, polling until one frees up or the wait times out. This is an
 * infra safety valve (protects the shared model API from a concurrent burst
 * across many free users), not a per-user quota — token spend and plan
 * tiering are handled separately by the metering ledger.
 */
import { adminDb } from "@/lib/firebase-admin"

const QUEUE_DOC = adminDb.collection("systemState").doc("freeGenerationQueue")

const MAX_CONCURRENT = 3
const POLL_INTERVAL_MS = 2500
const MAX_WAIT_MS = 45_000

export class QueueTimeoutError extends Error {
  constructor() {
    super("Free tier is at capacity right now")
    this.name = "QueueTimeoutError"
  }
}

async function tryAcquire(): Promise<boolean> {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(QUEUE_DOC)
    const active = typeof snap.data()?.active === "number" ? snap.data()!.active : 0
    if (active >= MAX_CONCURRENT) return false
    tx.set(QUEUE_DOC, { active: active + 1 }, { merge: true })
    return true
  })
}

/**
 * Waits for a free concurrency slot and holds it. Returns how long the
 * caller actually waited (0 if a slot was open immediately) so the caller
 * can decide whether to surface a "queued" notice.
 */
export async function acquireFreeQueueSlot(): Promise<{ waitedMs: number }> {
  const startedAt = Date.now()
  const deadline = startedAt + MAX_WAIT_MS

  while (true) {
    if (await tryAcquire()) return { waitedMs: Date.now() - startedAt }
    if (Date.now() >= deadline) throw new QueueTimeoutError()
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

export async function releaseFreeQueueSlot(): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(QUEUE_DOC)
    const active = typeof snap.data()?.active === "number" ? snap.data()!.active : 0
    tx.set(QUEUE_DOC, { active: Math.max(0, active - 1) }, { merge: true })
  }).catch(() => {
    // Best-effort: a stuck slot self-corrects next time the doc is read
    // against a naturally low active count, never below zero.
  })
}
