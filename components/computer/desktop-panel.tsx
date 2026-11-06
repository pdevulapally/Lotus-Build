"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { Button } from "@/components/ui/button"
import { BackendError } from "@/lib/backend/client"
import { currentBackend } from "@/lib/backend/browser"
import { desktopCloseAction, desktopSocketUrl, type DesktopState } from "@/lib/backend/desktop"

export type DesktopViewState =
  | "connecting" | "live" | "ended" | "unavailable" | "capacity" | "slow" | "failed"
  | "idle" | "starting" | "waiting"

const stateCopy: Record<Exclude<DesktopViewState, "live">, string> = {
  connecting: "Connecting to the desktop…",
  starting: "Starting the desktop…",
  idle: "No desktop yet. The agent opens one when it needs to see the screen, or you can start it now.",
  waiting: "Start desktop is available while the agent is working.",
  ended: "The desktop has ended. It will appear again on the next build.",
  unavailable: "No desktop for this session.",
  capacity: "Close another desktop view to watch here.",
  slow: "Paused — connection too slow",
  failed: "Couldn't connect",
}

export function DesktopPanelView({
  state,
  onRetry,
  onStart,
  children,
}: {
  state: DesktopViewState
  onRetry?: () => void
  onStart?: () => void
  children?: ReactNode
}) {
  return (
    <div className="relative h-full min-h-[240px] overflow-hidden bg-muted/20">
      <div
        aria-hidden={state !== "live"}
        className={`absolute inset-0 transition-opacity duration-150 ${state === "live" ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {children}
      </div>
      {state !== "live" && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {state === "connecting" || state === "starting"
            ? <Shimmer className="text-sm font-medium">{stateCopy[state]}</Shimmer>
            : <p className="max-w-sm text-sm font-medium text-muted-foreground">{stateCopy[state]}</p>}
          {onRetry && (state === "failed" || state === "capacity" || state === "slow") && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>
          )}
          {onStart && state === "idle" && (
            <Button type="button" variant="outline" size="sm" onClick={onStart}>Start desktop</Button>
          )}
        </div>
      )}
    </div>
  )
}

export function DesktopPanel({ sessionId, desktop, active, canStart }: { sessionId: string; desktop: DesktopState; active: boolean; canStart: boolean }) {
  // Local only until the server's own `desktop.requested` / `desktop.ready` events take over.
  const [startRequest, setStartRequest] = useState<"none" | "sent" | "no-run">("none")
  const requestStart = () => {
    setStartRequest("sent")
    void currentBackend().requestDesktop(sessionId).catch((error: unknown) => {
      setStartRequest(error instanceof BackendError && error.code === "desktop/no-active-run" ? "no-run" : "none")
    })
  }
  const targetRef = useRef<HTMLDivElement | null>(null)
  const [connectionState, setConnectionState] = useState<DesktopViewState>("connecting")
  const [retryAllowed, setRetryAllowed] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    if (!active || desktop.status !== "ready") return
    let disposed = false
    let waitingForReady = false
    let retries = 0
    let ticketRetryUsed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let disconnectTimer: ReturnType<typeof setTimeout> | undefined
    let client: import("@novnc/novnc").default | null = null

    const retry = (quiet = false) => {
      setRetryAllowed(false)
      if (retries >= 5) {
        setConnectionState("failed")
        setRetryAllowed(true)
        return
      }
      const delay = Math.min(1_000 * 2 ** retries, 15_000)
      retries += 1
      reconnectTimer = setTimeout(() => { void connect(quiet) }, delay)
    }

    const handleClose = (code: number, closeHandled: { value: boolean }, quiet = false) => {
      if (disposed || closeHandled.value) return
      closeHandled.value = true
      client = null
      const action = desktopCloseAction(code)

      if (action === "stop") {
        setConnectionState(code === 1000 ? "ended" : "failed")
        setRetryAllowed(false)
      } else if (action === "retry-once" && !ticketRetryUsed) {
        ticketRetryUsed = true
        setConnectionState("connecting")
        void connect()
      } else if (action === "retry-once") {
        setConnectionState("failed")
        setRetryAllowed(true)
      } else if (action === "wait-ready") {
        waitingForReady = true
        setConnectionState("connecting")
        setRetryAllowed(false)
      } else if (action === "capacity") {
        setConnectionState("capacity")
        setRetryAllowed(true)
      } else if (action === "slow") {
        setConnectionState("slow")
        setRetryAllowed(false)
        retry()
      } else if (action === "quiet-reconnect") {
        retry(true)
      } else {
        if (!quiet) setConnectionState("connecting")
        retry()
      }
    }

    const connect = async (quiet = false) => {
      if (disposed || waitingForReady) return
      if (!quiet) {
        setConnectionState("connecting")
        setRetryAllowed(false)
      }
      try {
        const ticket = await currentBackend().desktopTicket(sessionId)
        if (disposed) return
        const RFB = (await import("@novnc/novnc")).default
        if (disposed || !targetRef.current) return
        const origin = process.env.NEXT_PUBLIC_BACKEND_URL
        if (!origin) throw new Error("Desktop service is unavailable.")
        const socketUrl = desktopSocketUrl(origin, sessionId, ticket.ticket)
        const nextClient = new RFB(targetRef.current, socketUrl, { wsProtocols: ["binary"] })
        client = nextClient
        nextClient.viewOnly = true
        nextClient.scaleViewport = true

        const closeHandled = { value: false }
        let socketCloseCode: number | null = null
        const socket = nextClient._sock?._websocket
        socket?.addEventListener("close", (event) => {
          socketCloseCode = event.code
          if (disconnectTimer !== undefined) clearTimeout(disconnectTimer)
          handleClose(event.code, closeHandled)
        }, { once: true })
        nextClient.addEventListener("connect", () => {
          if (disposed) return
          retries = 0
          ticketRetryUsed = false
          setConnectionState("live")
          setRetryAllowed(false)
        })
        nextClient.addEventListener("disconnect", () => {
          if (disposed || socketCloseCode !== null) return
          disconnectTimer = setTimeout(() => handleClose(1006, closeHandled), 0)
        })
      } catch (error) {
        if (disposed) return
        if (error instanceof BackendError && error.code === "session/no-desktop") {
          waitingForReady = true
          setConnectionState("connecting")
          return
        }
        if (error instanceof BackendError && error.code === "desktop/capacity-reached") {
          setConnectionState("capacity")
          setRetryAllowed(true)
          return
        }
        if (error instanceof BackendError && error.status === 404) {
          setConnectionState("failed")
          setRetryAllowed(false)
          return
        }
        retry()
      }
    }

    setConnectionState("connecting")
    void connect()
    return () => {
      disposed = true
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
      if (disconnectTimer !== undefined) clearTimeout(disconnectTimer)
      client?.disconnect()
      client = null
    }
  }, [active, desktop, retryVersion, sessionId])

  const retry = () => setRetryVersion((version) => version + 1)

  if (desktop.status === "ended") {
    return <DesktopPanelView state={desktop.reason === "error" ? "unavailable" : "ended"} />
  }
  if (desktop.status === "starting" || (desktop.status === "none" && startRequest === "sent")) return <DesktopPanelView state="starting" />
  if (desktop.status === "none") {
    return canStart && startRequest !== "no-run"
      ? <DesktopPanelView state="idle" onStart={requestStart} />
      : <DesktopPanelView state="waiting" />
  }

  return (
    <DesktopPanelView state={connectionState} onRetry={retryAllowed ? retry : undefined}>
      <div ref={targetRef} className="h-full w-full" />
    </DesktopPanelView>
  )
}
