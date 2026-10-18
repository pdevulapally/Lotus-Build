import { z } from 'zod'

export function previewUrl(value: unknown, appOrigin: string): string {
  try {
    if (typeof value !== 'string') throw new Error()
    const url = new URL(value)
    const app = new URL(appOrigin)
    const localHttp = app.protocol === 'http:' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.origin === app.origin) throw new Error()
    return url.href
  } catch { throw new Error('Preview must use a separate HTTPS origin. Local HTTP previews are allowed only during local development.') }
}

const coordinate = z.number().min(-1_000_000).max(1_000_000)
const size = z.number().nonnegative().max(1_000_000)
const rect = z.object({ x: coordinate, y: coordinate, width: size, height: size })
const viewport = z.object({ w: size.positive(), h: size.positive() })
const elementId = z.string().min(1).max(256)
const snapshot = z.object({
  content: z.string().max(20_000).optional(),
  styles: z.record(z.string().regex(/^[a-zA-Z-]{1,64}$/), z.string().max(1000)).refine((value) => Object.keys(value).length <= 128).optional(),
})
const message = z.discriminatedUnion('type', [
  z.object({ type: z.literal('preview-navigate'), path: z.string().max(4096).regex(/^\/(?![\/\\])[^\\\u0000-\u0020]*$/) }),
  z.object({ type: z.literal('preview-hover'), rect: rect.nullish(), viewport: viewport.nullish() }),
  z.object({ type: z.literal('preview-select'), id: elementId.nullish(), rect: rect.nullish(), viewport: viewport.nullish(),
    description: z.string().max(4096).nullish(), sectionId: elementId.nullish(), snapshot: snapshot.nullish(), multi: z.boolean().optional() }),
  z.object({ type: z.literal('preview-structure'), sections: z.array(z.object({ id: elementId, label: z.string().max(256),
    kind: z.enum(['header', 'hero', 'content', 'cta', 'footer', 'generic']) })).max(200) }),
])

export function parsePreviewMessage(value: unknown) {
  const result = message.safeParse(value)
  return result.success ? result.data : null
}
