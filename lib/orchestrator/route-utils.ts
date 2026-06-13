import "server-only"

import { NextResponse } from "next/server"
import { OrchestratorError } from "@/lib/orchestrator/client"

export function mapRouteError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Request failed"

  if (message.includes("Authorization") || message.includes("Missing Authorization")) {
    return NextResponse.json({ error: message }, { status: 401 })
  }
  if (message === "Forbidden" || message.includes("Access denied")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (message === "Project not found") {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (message === "Project is not a mobile project") {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (err instanceof OrchestratorError) {
    const error =
      process.env.NODE_ENV === "development"
        ? err.message
        : "Preview service unavailable"
    return NextResponse.json({ error }, { status: err.status >= 500 ? 502 : err.status })
  }

  return NextResponse.json({ error: message }, { status: 500 })
}
