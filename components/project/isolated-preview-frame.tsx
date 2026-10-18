"use client"

import { useEffect, useState, type ComponentProps } from 'react'
import { previewUrl } from '@/lib/preview'

type Props = Omit<ComponentProps<'iframe'>, 'src' | 'srcDoc' | 'sandbox' | 'referrerPolicy'> & { src: string }

export function IsolatedPreviewFrame({ src, ...props }: Props) {
  const [validated, setValidated] = useState<{ input: string; url: string | null; error: string | null } | null>(null)
  useEffect(() => {
    try { setValidated({ input: src, url: previewUrl(src, window.location.origin), error: null }) }
    catch (reason) { setValidated({ input: src, url: null, error: reason instanceof Error ? reason.message : 'Invalid preview URL.' }) }
  }, [src])
  if (validated?.input !== src) return null
  if (!validated.url) return <p role="alert" className="p-4 text-sm text-destructive">{validated.error}</p>
  return <iframe {...props} src={validated.url} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" />
}
