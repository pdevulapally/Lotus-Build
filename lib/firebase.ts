import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth"
import { FIREBASE_PUBLIC_CONFIG } from "@/lib/public-env"

const app = getApps().length === 0 ? initializeApp(FIREBASE_PUBLIC_CONFIG) : getApps()[0]
const db = getFirestore(app)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

// User plan types and token limits
export type UserPlan = "free" | "pro" | "team" | "enterprise"

export const PLAN_TOKEN_LIMITS: Record<UserPlan, number> = {
  free: 10000,
  pro: 120000,
  team: 500000,
  enterprise: 500000,
}

export const PLAN_FEATURES: Record<UserPlan, { name: string; tokensPerMonth: number; features: string[] }> = {
  free: {
    name: "Free",
    tokensPerMonth: 10000,
    features: ["10,000 tokens/month", "Single personal workspace", "Basic code generation", "Community support"],
  },
  pro: {
    name: "Pro",
    tokensPerMonth: 120000,
    features: ["120,000 credits/month", "Create and switch workspaces", "Premium templates + visual edit", "Priority support"],
  },
  team: {
    name: "Agency",
    tokensPerMonth: 500000,
    features: ["500,000 credits/month", "Create and switch workspaces", "Client handoff + white-label", "Priority support"],
  },
  enterprise: {
    name: "Agency",
    tokensPerMonth: 500000,
    features: ["500,000 credits/month", "Create and switch workspaces", "Client handoff + white-label", "Priority support"],
  },
}

// Convenience: default plan docs to seed in Firestore (optional)
export const DEFAULT_PLANS: Record<UserPlan, { id: string; name: string; tokensPerMonth: number; features: string[] }> = {
  free: { id: 'free', name: 'Hobby', tokensPerMonth: 10000, features: ['10,000 credits/month', 'Single personal workspace', 'Public projects', 'Community support'] },
  pro: { id: 'pro', name: 'Pro', tokensPerMonth: 120000, features: ['120,000 credits/month', 'Create and switch workspaces', 'Premium templates + visual edit', 'Priority support'] },
  team: { id: 'team', name: 'Agency', tokensPerMonth: 500000, features: ['500,000 credits/month', 'Create and switch workspaces', 'Client handoff + white-label', 'Priority support'] },
  enterprise: { id: 'enterprise', name: 'Agency', tokensPerMonth: 500000, features: ['500,000 credits/month', 'Create and switch workspaces', 'Client handoff + white-label', 'Priority support'] },
}

export { app, db, auth, googleProvider, githubProvider }
