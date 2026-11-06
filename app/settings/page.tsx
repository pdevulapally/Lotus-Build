"use client"

/**
 * Settings now lives in the global SettingsDialog (Claude-style modal) mounted
 * by SettingsDialogProvider in the root layout. This route remains only as a
 * landing target for external return URLs — the Stripe billing portal
 * (the current backend billing portal return URL)
 * both redirect here. It opens the dialog and moves the user onto the workspace at /.
 * underneath it.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogoLoader } from "@/components/ui/logo-loader"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { useSettingsDialog } from "@/components/settings/settings-dialog"

function SettingsRedirect() {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()

  useEffect(() => {
    openSettings()
    router.replace("/")
  }, [openSettings, router])

  return (
    <LogoLoader label="Opening your settings…" />
  )
}

export default function AccountSettingsPage() {
  return (
    <ProtectedRoute requiredTokens={0}>
      <SettingsRedirect />
    </ProtectedRoute>
  )
}
