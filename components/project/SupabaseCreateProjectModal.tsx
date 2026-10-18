"use client"

import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Props = {
  open: boolean
  loading?: boolean
  error?: string
  regions?: Array<{ value: string; label: string }>
  onClose: () => void
  onCreate: (name: string, region: string, password: string) => Promise<void>
}

export function SupabaseCreateProjectModal({ open, loading, error, regions = [], onClose, onCreate }: Props) {
  const [projectName, setProjectName] = useState("")
  const [region, setRegion] = useState(regions[0]?.value || "us-east-1")
  const [dbPassword, setDbPassword] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!projectName.trim() || !region || !dbPassword.trim()) return
    
    setIsCreating(true)
    try {
      await onCreate(projectName, region, dbPassword)
      setProjectName("")
      setDbPassword("")
      setRegion(regions[0]?.value || "us-east-1")
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setProjectName("")
    setDbPassword("")
    setRegion(regions[0]?.value || "us-east-1")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : null)}>
      <DialogContent className="rounded-2xl border-border bg-popover text-popover-foreground shadow-lg shadow-foreground/5 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center">
            <div className="rounded-xl bg-muted p-3">
              <Plus className="h-6 w-6 text-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-semibold tracking-[-0.03em]">Create Supabase Project</DialogTitle>
          <DialogDescription className="text-center">
            Create a Supabase project here, then we will link it and continue setup for this website automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-xs font-medium text-foreground">
              Project Name
            </Label>
            <Input
              id="project-name"
              type="text"
              placeholder="My Website Backend"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isCreating}
              className="border-input text-sm"
            />
          </div>

          <div className="border-y border-border px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">What happens next</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-foreground">
              <li>1. We create the Supabase project in your account.</li>
              <li>2. We link it to this website.</li>
              <li>3. If the app needs backend setup, we continue automatically.</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="region" className="text-xs font-medium text-foreground">
              Region
            </Label>
            <Select value={region} onValueChange={setRegion} disabled={isCreating}>
              <SelectTrigger id="region" className="rounded-xl border-input text-sm focus:ring-ring/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="db-password" className="text-xs font-medium text-foreground">
              Database Password
            </Label>
            <Input
              id="db-password"
              type="password"
              placeholder="••••••••"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              disabled={isCreating}
              className="border-input text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              This will be used to access your database. Store it securely.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-border-strong"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isCreating || !projectName.trim() || !dbPassword.trim()}
            >
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
