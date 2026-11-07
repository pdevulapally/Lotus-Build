import { z } from 'zod'
import { computerSessionModeSchema } from './session-modes'
const draftSchema = z.object({ prompt: z.string().trim().min(1).max(8000), mode: computerSessionModeSchema.optional() }).strict()
export const draftKey = 'lotusbuild-session-draft'
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function saveSessionDraft(storage: DraftStorage, input: z.infer<typeof draftSchema>) { storage.setItem(draftKey, JSON.stringify(draftSchema.parse(input))) }
export function readSessionDraft(storage: DraftStorage) { const raw = storage.getItem(draftKey); return raw === null ? null : draftSchema.parse(JSON.parse(raw)) }
