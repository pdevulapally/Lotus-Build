'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { SettingsPageContent } from '@/components/settings/settings-dialog'

/** A persistent, directly accessible destination, including billing returns. */
export default function AccountSettingsPage() {
  return (
    <ProtectedRoute requiredTokens={0}>
      <SettingsPageContent />
    </ProtectedRoute>
  )
}
