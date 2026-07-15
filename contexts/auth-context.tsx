"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, Timestamp, collection } from "firebase/firestore"
import { auth, db, googleProvider, githubProvider, type UserPlan } from "@/lib/firebase"
import { PLAN_CONFIG } from "@/lib/plans"

interface TokenUsage {
  used: number
  remaining: number
  periodStart: Date
  periodEnd: Date
}

interface UserData {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  planId: string
  planName?: string
  tokenUsage: TokenUsage
  tokensLimit: number
  createdAt: Date
  currentWorkspaceId?: string
  referralCount: number
  referralCreditsEarned: number
}

interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  loading: boolean
  switchWorkspace: (workspaceId: string) => Promise<void>
  /** Returns Bearer header when auth.currentUser exists (avoids 403 on project fetch when React state lags). */
  getOptionalAuthHeader: () => Promise<Record<string, string>>
  signInWithGoogle: () => Promise<void>
  signInWithGithub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateTokensUsed: (tokens: number) => Promise<void>
  hasTokens: (required: number) => boolean
  remainingTokens: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  // Ensure user doc exists and set up onSnapshot listener
  const ensureUserDoc = async (firebaseUser: User) => {
    const userRef = doc(db, "users", firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      const now = new Date()
      const planId = 'free'
      const plan = PLAN_CONFIG[planId as UserPlan]
      const initial = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        planId,
        tokenUsage: {
          used: 0,
          remaining: plan.tokensPerMonth,
          periodStart: serverTimestamp(),
          periodEnd: serverTimestamp(),
        },
        createdAt: serverTimestamp(),
        currentWorkspaceId: null,
      }
      await setDoc(userRef, initial)
      // Auto-create personal workspace
      try {
        const idToken = await firebaseUser.getIdToken()
        const wsRes = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ name: `${firebaseUser.displayName || firebaseUser.email}'s Workspace`, slug: `personal-${firebaseUser.uid.slice(0, 8)}` })
        })
        if (wsRes.ok) {
          const ws = await wsRes.json()
          if (ws.id !== undefined) {
            await updateDoc(userRef, { currentWorkspaceId: ws.id })
          }
        }
      } catch (e) {
        console.error('Failed to auto-create personal workspace', e)
      }

      // Record referral attribution (if the user arrived via a referral link).
      // The 500-credit reward is granted by the Stripe webhook once this user
      // subscribes to a paid plan. Server validates & is idempotent. Non-blocking.
      try {
        const referrerUid = typeof window !== "undefined"
          ? window.localStorage.getItem("lotus_ref")?.trim()
          : null
        if (referrerUid && referrerUid !== firebaseUser.uid) {
          const idToken = await firebaseUser.getIdToken()
          await fetch("/api/referral/attribute", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ referrerUid }),
          })
        }
      } catch (e) {
        console.error("Failed to attribute referral", e)
      } finally {
        if (typeof window !== "undefined") window.localStorage.removeItem("lotus_ref")
      }
    }
  }

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined
    let authChangeVersion = 0

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const version = ++authChangeVersion
      unsubscribeUser?.()
      unsubscribeUser = undefined

      setUser(firebaseUser)
      
      if (firebaseUser) {
        try {
          await ensureUserDoc(firebaseUser)
          if (version !== authChangeVersion) return

          try {
            const idToken = await firebaseUser.getIdToken()
            await fetch("/api/user/refresh-token-period", {
              method: "POST",
              headers: { Authorization: `Bearer ${idToken}` },
            })
          } catch {
            // non-blocking: snapshot will still get latest data
          }

          const userRef = doc(db, "users", firebaseUser.uid)
          unsubscribeUser = onSnapshot(userRef, async (snap) => {
            if (version !== authChangeVersion) return
            if (!snap.exists()) return
            const data = snap.data()

            const planId = data.planId || 'free'
            // Prefer Firestore values (set by Stripe webhook / API) over defaults
            const planName = data.planName || PLAN_CONFIG[planId as UserPlan]?.name || planId
            const tokensLimit = data.tokensLimit != null ? Number(data.tokensLimit) : (PLAN_CONFIG[planId as UserPlan]?.tokensPerMonth ?? PLAN_CONFIG.free.tokensPerMonth)

            const tokenUsage = data.tokenUsage || { used: data.tokensUsed || 0, remaining: tokensLimit - (data.tokensUsed || 0), periodStart: new Date(), periodEnd: new Date() }
            const tokenPeriodStart = tokenUsage.periodStart?.toDate ? tokenUsage.periodStart.toDate() : new Date(tokenUsage.periodStart)
            const tokenPeriodEnd = tokenUsage.periodEnd?.toDate ? tokenUsage.periodEnd.toDate() : new Date(tokenUsage.periodEnd)

            setUserData({
              uid: firebaseUser.uid,
              email: data.email || firebaseUser.email,
              // Firestore's copy is only written once at signup (ensureUserDoc)
              // and never re-synced, so it goes stale the moment the auth
              // provider's profile changes. Prefer the live value.
              displayName: firebaseUser.displayName || data.displayName,
              photoURL: firebaseUser.photoURL || data.photoURL,
              planId,
              planName,
              tokenUsage: {
                used: tokenUsage.used || 0,
                remaining: Math.max(0, tokenUsage.remaining ?? (tokensLimit - (tokenUsage.used || 0))),
                periodStart: tokenPeriodStart,
                periodEnd: tokenPeriodEnd,
              },
              tokensLimit,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              currentWorkspaceId: data.currentWorkspaceId || null,
              referralCount: Math.max(0, Number(data.referralCount ?? 0)),
              referralCreditsEarned: Math.max(0, Number(data.referralCreditsEarned ?? 0)),
            })

            // Fetch workspaces list
            try {
              const idToken = await firebaseUser.getIdToken()
              if (version !== authChangeVersion) return
              const wsRes = await fetch('/api/workspaces', {
                headers: { Authorization: `Bearer ${idToken}` }
              })
              if (wsRes.ok) {
                const wsData = await wsRes.json()
                if (version !== authChangeVersion) return
                setWorkspaces(Array.isArray(wsData) ? wsData : (wsData?.workspaces ?? []))
              }
            } catch (e) {
              console.error('Failed to fetch workspaces', e)
            }
          })
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      } else {
        setUserData(null)
        setWorkspaces([])
      }

      if (version === authChangeVersion) setLoading(false)
    })

    return () => {
      authChangeVersion += 1
      unsubscribeUser?.()
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error("Google sign in error:", error)
      throw error
    }
  }

  const signInWithGithub = async () => {
    try {
      await signInWithPopup(auth, githubProvider)
    } catch (error) {
      console.error("GitHub sign in error:", error)
      throw error
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error("Email sign in error:", error)
      throw error
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error("Email sign up error:", error)
      throw error
    }
  }

  const sendPasswordResetEmailToUser = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      console.error("Password reset email error:", error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error("Sign out error:", error)
      throw error
    }
  }

  const updateTokensUsed = async (tokens: number) => {
    if (!user || !userData) return

    const currentRemaining = Math.max(0, userData.tokenUsage.remaining ?? 0)
    const actualDeduct = Math.min(tokens, currentRemaining)
    const newRemaining = Math.max(0, currentRemaining - actualDeduct)
    const newUsed = (userData.tokenUsage.used || 0) + actualDeduct

    const userRef = doc(db, "users", user.uid)
    // Optimistic UI only. tokenUsage is server-write-only under Firestore rules
    // (the charge-tokens transaction is authoritative), so a permission-denied
    // rejection here is expected and must not break generation — the user-doc
    // onSnapshot will reconcile the real balance.
    try {
      await updateDoc(userRef, {
        'tokenUsage.used': newUsed,
        'tokenUsage.remaining': newRemaining,
      } as any)
    } catch {
      // ignore — server transaction owns tokenUsage
    }

    setUserData(prev => prev ? { ...prev, tokenUsage: { ...prev.tokenUsage, used: newUsed, remaining: newRemaining } } : null)
  }

  const hasTokens = (required: number): boolean => {
    if (!userData) return false
    return (userData.tokenUsage.remaining || 0) >= required
  }

  const remainingTokens = userData ? Math.max(0, userData.tokenUsage.remaining ?? 0) : 0

  const getOptionalAuthHeader = async (): Promise<Record<string, string>> => {
    const currentUser = auth.currentUser
    if (!currentUser) return {}
    try {
      const token = await currentUser.getIdToken()
      return { Authorization: `Bearer ${token}` }
    } catch {
      return {}
    }
  }

  const switchWorkspace = async (workspaceId: string) => {
    if (!user) return
    const userRef = doc(db, 'users', user.uid)
    if (workspaceId !== undefined) {
      await updateDoc(userRef, { currentWorkspaceId: workspaceId })
    }
  }

  const currentWorkspace = Array.isArray(workspaces) ? workspaces.find(w => w.id === userData?.currentWorkspaceId) || null : null

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        workspaces,
        currentWorkspace,
        loading,
        switchWorkspace,
        getOptionalAuthHeader,
        signInWithGoogle,
        signInWithGithub,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordResetEmail: sendPasswordResetEmailToUser,
        signOut,
        updateTokensUsed,
        hasTokens,
        remainingTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
