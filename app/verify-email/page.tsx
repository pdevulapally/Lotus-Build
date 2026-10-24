"use client"
import { Suspense, useEffect, useState } from 'react'
import { reload, sendEmailVerification } from 'firebase/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Stack } from '@astryxdesign/core'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { auth } from '@/lib/firebase'
import { getSafeRedirectPath } from '@/lib/auth/redirect'
export default function VerifyEmailPage() { return <Suspense fallback={<p role="status">Loading…</p>}><Verification /></Suspense> }
function Verification() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter(); const params = useSearchParams()
  const redirect = getSafeRedirectPath(params.get('redirect'))
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('')
  useEffect(() => { if (!loading && !user) router.replace(`/login?redirect=${encodeURIComponent(redirect)}`) }, [loading, user, redirect, router])
  const act = async (send: boolean) => {
    if (!user || busy) return
    const identity = user
    setBusy(true); setError(''); setNotice('')
    try {
      if (auth.currentUser?.uid !== identity.uid) throw new Error('Your account changed. Sign in again.')
      if (send) { await sendEmailVerification(identity); setNotice('Verification link sent. Open the link in your email, then return here.') }
      else {
        await reload(identity)
        if (auth.currentUser?.uid !== identity.uid) throw new Error('Your account changed. Sign in again.')
        if (!identity.emailVerified) { setNotice('Your email is not verified yet. Open the verification link first.'); return }
        await identity.getIdToken(true)
        if (auth.currentUser?.uid !== identity.uid) throw new Error('Your account changed. Sign in again.')
        window.location.assign(redirect)
      }
    } catch { setError('Verification could not be completed. Check your account and try again shortly.') }
    finally { setBusy(false) }
  }
  return <AuthShell label="Verify your email"><Stack gap={5}><h1 className="text-2xl font-semibold">Check your email.</h1><p className="text-sm text-muted-foreground">Send a verification link to {user?.email ?? 'your account email'}. Your password and verification are managed by Firebase.</p><Button disabled={busy || !user} onClick={() => void act(true)}>Send verification link</Button><Button variant="outline" disabled={busy || !user} onClick={() => void act(false)}>I’ve verified my email</Button>{notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button variant="ghost" disabled={busy} onClick={() => void signOut().catch(() => setError('Could not sign out. Try again.'))}>Use a different account</Button></Stack></AuthShell>
}
