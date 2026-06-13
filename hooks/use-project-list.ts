"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type ProjectStatus = "pending" | "generating" | "complete" | "error"
export type ProjectScope = "user" | "team"

export type ProjectListItem = {
  id: string
  prompt: string
  model?: string
  status: ProjectStatus
  visibility?: "public" | "private" | "link-only"
  createdAt?: any
  updatedAt?: any
  sandboxUrl?: string
  workspaceId?: string
  workspaceName?: string
  kind?: "project" | "computer"
}

type UseProjectListOptions = {
  scope: ProjectScope
  uid?: string | null
  workspaceId?: string | null
  getAuthHeader?: () => Promise<Record<string, string>>
}

export function useProjectList({
  scope,
  uid,
  workspaceId,
  getAuthHeader,
}: UseProjectListOptions) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined
    setLoading(true)
    setError(null)

    if (!uid) {
      setProjects([])
      setLoading(false)
      return
    }

    if (scope === "user") {
      const byIdOwner = new Map<string, ProjectListItem>()
      const byIdUser = new Map<string, ProjectListItem>()
      const byIdEditor = new Map<string, ProjectListItem>()
      const byIdComputer = new Map<string, ProjectListItem>()
      // Project docs that are backing stubs for a computer session (every build
      // links one via `projectId`). These must not surface as their own rows —
      // the computer session row owns the build and routes to /computer/[id].
      const linkedProjectIds = new Set<string>()
      let ownerLoaded = false
      let userLoaded = false
      let editorLoaded = false
      let computerLoaded = false
      let ownerErr: string | null = null
      let userErr: string | null = null
      let editorErr: string | null = null
      let computerErr: string | null = null

      const maybeCommit = () => {
        if (!ownerLoaded || !userLoaded || !editorLoaded || !computerLoaded || cancelled) return
        const mergedMap = new Map<string, ProjectListItem>()
        const addProjectRows = (items: Iterable<ProjectListItem>) => {
          for (const p of items) {
            if (linkedProjectIds.has(p.id)) continue
            mergedMap.set(p.id, p)
          }
        }
        addProjectRows(byIdOwner.values())
        addProjectRows(byIdUser.values())
        addProjectRows(byIdEditor.values())
        for (const p of byIdComputer.values()) mergedMap.set(p.id, p)
        
        const merged = Array.from(mergedMap.values()).sort((a, b) => {
          const aTs =
            (typeof a.updatedAt?.toDate === "function" ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || a.createdAt || 0).getTime()) || 0
          const bTs =
            (typeof b.updatedAt?.toDate === "function" ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || b.createdAt || 0).getTime()) || 0
          return bTs - aTs
        })
        setProjects(merged)
        setError(ownerErr || userErr || editorErr || computerErr)
        setLoading(false)
      }

      const qOwner = query(collection(db, "projects"), where("ownerId", "==", uid))
      const qUser = query(collection(db, "projects"), where("userId", "==", uid))
      const qEditor = query(collection(db, "projects"), where("editorIds", "array-contains", uid))
      const qComputer = query(collection(db, "computerSessions"), where("ownerId", "==", uid))

      const unsubOwner = onSnapshot(
        qOwner,
        (snap) => {
          if (cancelled) return
          ownerLoaded = true
          byIdOwner.clear()
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any
            byIdOwner.set(docSnap.id, {
              id: docSnap.id,
              prompt: data.prompt || "",
              model: data.model,
              status: (data.status as ProjectStatus) || "pending",
              visibility: (data.visibility as "public" | "private" | "link-only") || "private",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              sandboxUrl: data.sandboxUrl,
              workspaceId: data.workspaceId,
              kind: "project",
            })
          })
          maybeCommit()
        },
        (err) => {
          if (cancelled) return
          ownerLoaded = true
          ownerErr = err?.message || "Failed to load projects"
          maybeCommit()
        }
      )

      const unsubUser = onSnapshot(
        qUser,
        (snap) => {
          if (cancelled) return
          userLoaded = true
          byIdUser.clear()
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any
            byIdUser.set(docSnap.id, {
              id: docSnap.id,
              prompt: data.prompt || "",
              model: data.model,
              status: (data.status as ProjectStatus) || "pending",
              visibility: (data.visibility as "public" | "private" | "link-only") || "private",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              sandboxUrl: data.sandboxUrl,
              workspaceId: data.workspaceId,
              kind: "project",
            })
          })
          maybeCommit()
        },
        (err) => {
          if (cancelled) return
          userLoaded = true
          userErr = err?.message || "Failed to load projects"
          maybeCommit()
        }
      )

      const unsubEditor = onSnapshot(
        qEditor,
        (snap) => {
          if (cancelled) return
          editorLoaded = true
          byIdEditor.clear()
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any
            byIdEditor.set(docSnap.id, {
              id: docSnap.id,
              prompt: data.prompt || "",
              model: data.model,
              status: (data.status as ProjectStatus) || "pending",
              visibility: (data.visibility as "public" | "private" | "link-only") || "private",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              sandboxUrl: data.sandboxUrl,
              workspaceId: data.workspaceId,
              kind: "project",
            })
          })
          maybeCommit()
        },
        (err) => {
          if (cancelled) return
          editorLoaded = true
          editorErr = err?.message || "Failed to load projects"
          maybeCommit()
        }
      )

      const unsubComputer = onSnapshot(
        qComputer,
        (snap) => {
          if (cancelled) return
          computerLoaded = true
          byIdComputer.clear()
          linkedProjectIds.clear()
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any
            if (typeof data.projectId === "string" && data.projectId) {
              linkedProjectIds.add(data.projectId)
            }
            byIdComputer.set(docSnap.id, {
              id: docSnap.id,
              prompt: data.prompt || "",
              model: data.model,
              status: (data.status as ProjectStatus) || "pending",
              visibility: "private",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              kind: "computer",
            })
          })
          maybeCommit()
        },
        (err) => {
          if (cancelled) return
          computerLoaded = true
          computerErr = err?.message || "Failed to load computer sessions"
          maybeCommit()
        }
      )

      unsub = () => {
        unsubOwner()
        unsubUser()
        unsubEditor()
        unsubComputer()
      }
      return () => {
        cancelled = true
        unsub?.()
      }
    }

    ;(async () => {
      try {
        const authHeader = getAuthHeader ? await getAuthHeader() : {}
        const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""
        const res = await fetch(`/api/team/projects${qs}`, { headers: authHeader })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || "Failed to load team projects")
        if (cancelled) return
        const items = Array.isArray(json?.projects) ? (json.projects as ProjectListItem[]) : []
        setProjects(items)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || "Failed to load team projects")
        setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [scope, uid, workspaceId, getAuthHeader])

  return { projects, loading, error }
}
