"use client"
import { useAuth } from '@/contexts/auth-context'
import { ProjectsWorkspace } from '@/components/projects/projects-workspace'
import { LandingPage } from '@/components/landing/landing-page'
export default function Home() {
  const { user, loading } = useAuth()
  if (loading) return <main data-product-theme="dark" className="dark grid min-h-svh place-items-center bg-background text-sm text-muted-foreground"><p role="status">Loading your workspace…</p></main>
  return user ? <ProjectsWorkspace /> : <LandingPage />
}
