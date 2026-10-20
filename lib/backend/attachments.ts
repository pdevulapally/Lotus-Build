import { z } from 'zod'

/** Mirrors the server's `imageMediaTypes`; anything else is refused before an upload starts. */
export const attachmentMediaTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type AttachmentMediaType = (typeof attachmentMediaTypes)[number]
export const MAX_ATTACHMENTS = 4
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const attachmentRefSchema = z.object({ id: z.string().uuid(), mediaType: z.enum(attachmentMediaTypes) }).strict()
export const attachmentRefsSchema = z.array(attachmentRefSchema).max(MAX_ATTACHMENTS)
export type AttachmentRef = z.infer<typeof attachmentRefSchema>
export const storedAttachmentSchema = attachmentRefSchema.extend({ bytes: z.number().int().nonnegative() })

export const ATTACHMENT_ERRORS = {
  type: 'Attach a PNG, JPEG, WebP or GIF image.',
  size: 'Images must be 5 MB or smaller.',
  count: `You can attach up to ${MAX_ATTACHMENTS} images per message.`,
} as const

export function isAttachmentMediaType(value: string): value is AttachmentMediaType {
  return (attachmentMediaTypes as readonly string[]).includes(value)
}

/** Why a file cannot be attached, or null when it can. */
export function attachmentProblem(file: { type: string; size: number }, currentCount: number): string | null {
  if (currentCount >= MAX_ATTACHMENTS) return ATTACHMENT_ERRORS.count
  if (!isAttachmentMediaType(file.type)) return ATTACHMENT_ERRORS.type
  if (file.size > MAX_ATTACHMENT_BYTES || file.size === 0) return ATTACHMENT_ERRORS.size
  return null
}

export function sameAttachments(a: readonly AttachmentRef[], b: readonly AttachmentRef[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref.id === b[index]?.id && ref.mediaType === b[index]?.mediaType)
}
