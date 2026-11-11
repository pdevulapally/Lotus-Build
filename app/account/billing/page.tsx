'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { LogoLoader } from '@/components/ui/logo-loader'
import { useSettingsDialog } from '@/components/settings/settings-dialog'
import { creditPurchaseSchema } from '@/lib/billing/credits'
import { billingSectionFromLocation, billingSettingsPages } from '@/lib/billing/navigation'

/** Keep existing billing links and provider checkout returns working in Settings. */
function BillingSettingsRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openSettings } = useSettingsDialog()
  const reference = creditPurchaseSchema.shape.purchaseId.safeParse(searchParams.get('credit_purchase_id'))
  const purchaseId = reference.success ? reference.data : null

  useEffect(() => {
    const section = billingSectionFromLocation(window.location.hash, purchaseId !== null)
    openSettings(billingSettingsPages[section], { purchaseId })
    router.replace('/')
  }, [openSettings, purchaseId, router])

  return <LogoLoader label="Opening billing settings..." />
}

export default function BillingPage() {
  return <ProtectedRoute requiredTokens={0}><BillingSettingsRedirect /></ProtectedRoute>
}
