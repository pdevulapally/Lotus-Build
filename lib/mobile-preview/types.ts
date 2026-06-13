export type MobileSandboxStatus = "queued" | "starting" | "running" | "stopping" | "failed"

export interface MobileSandboxUrls {
  expoGo: string
  web: string
}

export interface MobileSandbox {
  id: string
  projectId: string
  status: MobileSandboxStatus
  queuePosition: number | null
  subdomain: string
  urls: MobileSandboxUrls | null
  error: string | null
  createdAt: number
  lastActivityAt: number
}

export type MobilePreviewCreateResponse =
  | { sandbox: MobileSandbox }
  | { queueFull: true; message: string }
  | { error: string }

export type MobilePreviewGetResponse =
  | { sandbox: MobileSandbox }
  | { expired: true }
  | { error: string }
