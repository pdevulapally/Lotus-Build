"use client"
import Link from 'next/link'
import { useState } from 'react'
import { Stack } from '@astryxdesign/core'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
export default function SettingsPage() {
  const { user, loading, signOut, sendPasswordResetEmail } = useAuth()
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const act = async (reset: boolean) => { setBusy(true); setNotice(''); setError(''); try { if (reset && user?.email) { await sendPasswordResetEmail(user.email); setNotice('Password reset email requested. Check your inbox.'); } else await signOut() } catch { setError('Could not complete that request. Try again.') } finally { setBusy(false) } }
  if (loading) return <p role="status">Checking your sign-in…</p>
  return <Stack as="main" gap={5} className="mx-auto max-w-xl px-6 py-24"><Link href="/tasks" className="text-sm underline">Back to workspace</Link><h1 className="text-3xl font-semibold">Your account</h1>{user ? <><p className="text-sm">{user.email}</p><p className="text-sm text-muted-foreground">{user.emailVerified ? 'Email verified' : 'Email verification needed'}</p><Button variant="outline" disabled={busy || !user.email} onClick={() => void act(true)}>Send password reset email</Button><Button variant="ghost" disabled={busy} onClick={() => void act(false)}>Sign out</Button></> : <Link href="/login?redirect=%2Fsettings" className="underline">Sign in</Link>}<p className="text-sm leading-7 text-muted-foreground">Usage, billing, team workspaces and repository connections are not available in the new workspace yet.</p>{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}</Stack>
}
