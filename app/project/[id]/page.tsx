"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LotusLogo } from "@/components/ui/lotus-logo"
import { useAuth } from "@/contexts/auth-context"
import { currentBackend } from "@/lib/backend/browser"

type BridgeState = "checking" | "unlinked" | "error"

export default function ProjectRouteBridgePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projectId = params.id
  const { user, loading, getOptionalAuthHeader } = useAuth()
  const [state, setState] = useState<BridgeState>("checking")

  const returnPath = useMemo(
    () => `/project/${encodeURIComponent(projectId)}`,
    [projectId],
  )

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(returnPath)}`)
      return
    }

    let cancelled = false
    ;(async () => {
      setState("checking")
      try {
        const data = await currentBackend().sessions(projectId)
        if (cancelled) return
        if (data.sessions[0]) {
          router.replace(`/computer/${data.sessions[0].id}`)
          return
        }
        setState("unlinked")
      } catch {
        if (!cancelled) setState("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getOptionalAuthHeader, loading, projectId, returnPath, router, user])

  const title = state === "unlinked" ? "Project editor unavailable" : "Opening project"
  const detail = state === "unlinked"
    ? "This project is not attached to the current computer editor. Your project record is still available from Projects."
    : state === "error"
      ? "We could not resolve this project route. Return to Projects and try opening it again."
      : "Finding the current editor for this project."

  return (
    <main data-product-theme="dark" className="dark flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <LotusLogo size={28} />
          <span className="text-sm font-semibold">Lotus.build</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-accent-soft p-2 text-accent-soft-foreground">
            {state === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        </div>

        {state !== "checking" ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/">Open projects</Link>
            </Button>
            <Button asChild variant="outline" className="border-border-strong">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
