"use client"

import { useEffect, useId, useRef, useState } from "react"
import * as ContextMenu from "@radix-ui/react-context-menu"
import { ExternalLink, FolderOpen, Loader2, Pencil, Trash2 } from "lucide-react"
import type { ProjectListItem, ProjectStatus } from "@/hooks/use-project-list"
import { currentBackend } from "@/lib/backend/browser"
import { MissingProjectSessionError, projectSessionPath } from "@/lib/backend/project-session-path"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ProjectAction = "rename" | "delete"
const menuItemClass = "flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13px] text-foreground outline-none focus:bg-muted focus:text-foreground"
const statusLabels: Record<ProjectStatus, string> = {
  pending: "Draft", draft: "Draft", generating: "Building", complete: "Ready", error: "Needs attention", deleting: "Deleting",
}

export function ProjectNavigationRow({ project, active = false, portalClassName, onNavigate, onChanged }: {
  project: ProjectListItem
  active?: boolean
  portalClassName?: string
  onNavigate: () => void
  onChanged: (action: ProjectAction) => void
}) {
  const [action, setAction] = useState<ProjectAction | null>(null)
  const [newTabPath, setNewTabPath] = useState<string | null>(null)
  const [newTabError, setNewTabError] = useState<Error | null>(null)
  const missingWorkspace = newTabError instanceof MissingProjectSessionError
  const rowRef = useRef<HTMLButtonElement>(null)
  const resolutionRef = useRef<AbortController | null>(null)
  const title = project.prompt.trim() || "Untitled build"

  useEffect(() => () => resolutionRef.current?.abort(), [])

  const resolveNewTab = (open: boolean) => {
    resolutionRef.current?.abort()
    resolutionRef.current = null
    if (!open) return
    setNewTabPath(null)
    setNewTabError(null)
    const controller = new AbortController()
    resolutionRef.current = controller
    void projectSessionPath(currentBackend(), project, controller.signal)
      .then((path) => { if (!controller.signal.aborted) setNewTabPath(path) })
      .catch((error) => {
        if (!controller.signal.aborted) setNewTabError(error instanceof Error ? error : new Error("Could not find this project's saved workspace. Try again."))
      })
  }

  return <div className="px-1" role="listitem">
    <ContextMenu.Root onOpenChange={resolveNewTab}>
      <ContextMenu.Trigger asChild>
        <button
          ref={rowRef}
          type="button"
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          aria-label={`Open ${title}. ${project.kind === "computer" ? "Computer agent" : "Software project"}. ${statusLabels[project.status]}.`}
          className={cn(
            "flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left lg:min-h-10",
            "transition-colors hover:bg-accent data-[state=open]:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-card font-medium",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground" title={`${title} · ${statusLabels[project.status]}`}>{title}</span>
        </button>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          collisionPadding={8}
          aria-label="Project actions"
          onCloseAutoFocus={(event) => { if (action) event.preventDefault() }}
          className={cn("z-[60] w-56 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-md", portalClassName)}
        >
          <ContextMenu.Item asChild disabled={!newTabPath} className={menuItemClass}>
            <a href={newTabPath ?? undefined} target="_blank" rel="noopener noreferrer">
              {newTabPath ? <ExternalLink className="size-4" aria-hidden /> : newTabError ? <FolderOpen className="size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {newTabPath ? "Open in new tab" : missingWorkspace ? "No saved workspace" : newTabError ? "Workspace unavailable" : "Finding workspace…"}
            </a>
          </ContextMenu.Item>
          {newTabError && <p role="alert" className={cn("px-3 py-1.5 text-xs leading-relaxed", missingWorkspace ? "text-muted-foreground" : "text-destructive")}>
            {newTabError.message}{missingWorkspace && " You can still rename or delete it."}
          </p>}
          <ContextMenu.Item onSelect={() => setAction("rename")} className={menuItemClass}><Pencil className="size-4" aria-hidden /> Rename</ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-border" />
          <ContextMenu.Item onSelect={() => setAction("delete")} className={cn(menuItemClass, "text-destructive focus:bg-destructive/10 focus:text-destructive")}><Trash2 className="size-4" aria-hidden /> Delete</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
    {action && <ProjectActionDialog project={project} action={action} portalClassName={portalClassName} onClose={() => setAction(null)} onChanged={() => onChanged(action)} onReturnFocus={() => rowRef.current?.focus()} />}
  </div>
}

function ProjectActionDialog({ project, action, portalClassName, onClose, onChanged, onReturnFocus }: {
  project: ProjectListItem
  action: ProjectAction
  portalClassName?: string
  onClose: () => void
  onChanged: () => void
  onReturnFocus: () => void
}) {
  const inputId = useId()
  const [name, setName] = useState(project.prompt)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRename = action === "rename"
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || (isRename && !name.trim())) return
    setPending(true)
    setError(null)
    try {
      if (isRename) await currentBackend().renameProject(project.id, name.trim())
      else await currentBackend().deleteProject(project.id)
      onClose()
      onChanged()
    } catch {
      setError(isRename ? "Couldn’t rename this project. Please try again." : "Couldn’t delete this project. Please try again.")
      setPending(false)
    }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
    <DialogContent className={cn("rounded-2xl border-border bg-card sm:max-w-sm", portalClassName)} showCloseButton={!pending} onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus() }}>
      <form onSubmit={submit} className="space-y-5">
        <DialogHeader className="text-left">
          <DialogTitle>{isRename ? "Rename project" : "Delete this project?"}</DialogTitle>
          <DialogDescription>{isRename ? "Give your project a name that’s easy to find." : `“${project.prompt}” will be deleted. This cannot be undone.`}</DialogDescription>
        </DialogHeader>
        {isRename && <label htmlFor={inputId} className="block space-y-2 text-sm font-medium">
          <span>Project name</span><Input id={inputId} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required disabled={pending} className="h-11" autoFocus />
        </label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <footer className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="h-11" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" variant={isRename ? "default" : "destructive"} className="h-11" disabled={pending || (isRename && !name.trim())}>
            {pending ? (isRename ? "Saving…" : "Deleting…") : (isRename ? "Save" : "Delete project")}
          </Button>
        </footer>
      </form>
    </DialogContent>
  </Dialog>
}
