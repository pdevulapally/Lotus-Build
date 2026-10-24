/** Tab-local composer drafts; never tokens or URL query payloads. */
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type TaskDraft = { version: 1; ownerUid: string | null; text: string; kind: 'code' | 'desktop'; updatedAt: number; readyForTransfer: boolean }
export const DRAFT_TTL_MS = 30 * 60 * 1000
export const taskDraftKey = (uid: string | null) => `lotus-task-draft:${uid === null ? 'guest' : `user:${uid}`}`
export function saveTaskDraft(storage: DraftStorage, ownerUid: string | null, text: string, kind: TaskDraft['kind'] = 'code', readyForTransfer = false, now = Date.now()): TaskDraft {
  if (!text.trim() || text.length > 32000) throw new Error('Enter a task of up to 32,000 characters.')
  const draft: TaskDraft = { version: 1, ownerUid, text, kind, updatedAt: now, readyForTransfer }
  storage.setItem(taskDraftKey(ownerUid), JSON.stringify(draft))
  return draft
}
export function readTaskDraft(storage: DraftStorage, uid: string | null, now = Date.now()): TaskDraft | null {
  const key = taskDraftKey(uid), raw = storage.getItem(key)
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (value.version !== 1 || value.ownerUid !== uid || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 32000 || !['code', 'desktop'].includes(value.kind) || typeof value.readyForTransfer !== 'boolean' || !Number.isFinite(value.updatedAt) || now < value.updatedAt || now - value.updatedAt > DRAFT_TTL_MS) throw new Error('Invalid draft')
    return value as TaskDraft
  } catch { storage.removeItem(key); return null }
}
export function clearTaskDraft(storage: DraftStorage, uid: string | null) { storage.removeItem(taskDraftKey(uid)) }
/** Guest intent becomes owned by the account the user chose; no task runs on transfer. */
export function claimTaskDraft(storage: DraftStorage, uid: string, now = Date.now()): TaskDraft | null {
  const own = readTaskDraft(storage, uid, now)
  const guest = readTaskDraft(storage, null, now)
  if (guest?.readyForTransfer) {
    // Save first so blocked storage never silently loses the submitted guest text.
    const claimed = saveTaskDraft(storage, uid, guest.text, guest.kind, true, now)
    clearTaskDraft(storage, null)
    return claimed
  }
  return own?.readyForTransfer ? own : null
}

/** Resolve only the submitted draft; a later different edit remains a draft, never auto-submitted. */
export function clearCreatedTaskDraft(storage: DraftStorage, uid: string, text: string, kind: TaskDraft['kind']) {
  const draft = readTaskDraft(storage, uid)
  if (draft?.text.trim() === text.trim() && draft.kind === kind) clearTaskDraft(storage, uid)
}
