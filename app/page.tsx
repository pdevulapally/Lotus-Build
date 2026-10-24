"use client"
import { useAuth } from '@/contexts/auth-context'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LandingPage } from '@/components/landing/landing-page'
export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => { if (user && !loading) router.replace("/tasks") }, [user, loading, router])
  if (loading) return <main className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground"><p role="status">Loading your workspace…</p></main>
  return user ? <p role="status">Opening your workspace…</p> : <LandingPage />
}
