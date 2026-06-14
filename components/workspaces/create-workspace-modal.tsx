"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Loader2, Users, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

interface CreateWorkspaceModalProps {
  open: boolean
  onClose: () => void
}

type Step = "form" | "creating" | "success"

export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const router = useRouter()
  const { user, switchWorkspace } = useAuth()

  const [step, setStep] = useState<Step>("form")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [newWorkspaceId, setNewWorkspaceId] = useState<string | null>(null)

  const reset = () => {
    setStep("form")
    setName("")
    setError("")
    setNewWorkspaceId(null)
  }

  const handleClose = () => {
    onClose()
    // reset after animation completes
    setTimeout(reset, 200)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !user) return
    setError("")
    setStep("creating")

    try {
      const idToken = await user.getIdToken()
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          workspaceType: "team",
        }),
      })

      const data = await res.json().catch(() => ({})) as {
        workspaceId?: string
        error?: string
      }

      if (!res.ok || !data.workspaceId) {
        throw new Error(data.error || "Failed to create workspace")
      }

      setNewWorkspaceId(data.workspaceId)
      await switchWorkspace(data.workspaceId)
      setStep("success")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep("form")
    }
  }

  const handleGoToWorkspace = () => {
    handleClose()
    router.push(`/projects?onboarding=true${newWorkspaceId ? `&workspace=${newWorkspaceId}` : ""}`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-t-2xl border border-border/60 bg-sidebar shadow-2xl sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10">
                <Users className="h-4 w-4 text-accent" />
              </div>
              <h2 className="text-[14px] font-semibold text-foreground">
                {step === "success" ? "Workspace created" : "New workspace"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {step === "success" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-[16px] font-bold text-accent">
                    {name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{name.trim()}</p>
                    <p className="text-[12px] text-muted-foreground">Team workspace · Ready</p>
                  </div>
                  <div className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                    <Check className="h-3.5 w-3.5 text-accent-foreground" />
                  </div>
                </div>

                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Your workspace is set up and ready. Head over to projects to start building.
                </p>

                <button
                  type="button"
                  onClick={handleGoToWorkspace}
                  className="h-11 w-full rounded-xl bg-accent text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  Go to workspace
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="ws-name" className="text-[12.5px] font-medium text-foreground">
                    Workspace name
                  </label>
                  <input
                    id="ws-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Inc, Design team…"
                    disabled={step === "creating"}
                    autoFocus
                    className={cn(
                      "h-11 w-full rounded-xl border border-border/60 bg-background px-3.5",
                      "text-[14px] text-foreground placeholder:text-muted-foreground/50",
                      "outline-none transition-colors focus:border-ring",
                      "disabled:opacity-50"
                    )}
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-[12.5px] text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={step === "creating"}
                    className="h-11 flex-1 rounded-xl border border-border/60 bg-background text-[13.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || step === "creating"}
                    className="h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
                  >
                    {step === "creating" ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </span>
                    ) : (
                      "Create workspace"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
