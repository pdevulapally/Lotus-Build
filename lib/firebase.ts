import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth"
import { FIREBASE_PUBLIC_CONFIG } from "@/lib/public-env"

const app = getApps().length === 0 ? initializeApp(FIREBASE_PUBLIC_CONFIG) : getApps()[0]
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
const githubProvider = new GithubAuthProvider()

// User plan type. Values (token limits, price, features) live in
// lib/plans.ts's PLAN_CONFIG — the canonical plan config.
export type UserPlan = "free" | "pro" | "team"

export { app, auth, googleProvider, githubProvider }
