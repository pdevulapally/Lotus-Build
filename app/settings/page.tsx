"use client"

/** Legacy settings URL opens the shared settings modal. */

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
