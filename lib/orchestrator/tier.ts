import "server-only"

import { adminDb } from "@/lib/firebase-admin"
import { planIdForDisplay, type PlanId } from "@/lib/plans"
import type { OrchestratorTier } from "@/lib/projects/platform"

const PLAN_TO_ORCHESTRATOR_TIER: Record<PlanId, OrchestratorTier> = {
  free: "starter",
  pro: "pro",
  team: "team",
}

export async function resolveTier(userId: string): Promise<OrchestratorTier> {
  const snap = await adminDb.collection("users").doc(userId).get()
  const rawPlanId = snap.exists ? snap.data()?.planId : "free"
  const planId = planIdForDisplay(typeof rawPlanId === "string" ? rawPlanId : "free")
  return PLAN_TO_ORCHESTRATOR_TIER[planId]
}
