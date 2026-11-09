"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as firebaseSignOut, sendPasswordResetEmail, type User } from 'firebase/auth'
import { auth, googleProvider, githubProvider } from '@/lib/firebase'
import { currentBackend } from '@/lib/backend/browser'
import type { BackendAccount, BackendUsage, BackendWorkspace } from '@/lib/backend/client'

type UserData = {
  uid: string; email: string | null; displayName: string | null; photoURL: string | null; planId: string; planName: string
  // Legacy UI fields are unavailable in the current contract, not invented balances.
  tokenUsage?: { used: number; remaining: number; periodStart: Date; periodEnd: Date }
  tokensLimit?: number; currentWorkspaceId?: string; referralCount?: number; referralCreditsEarned?: number; createdAt?: Date
}
/** A workspace the account can work in: the personal one (id = uid) or an organisation, as the server lists them in /me. */
export type Workspace = BackendWorkspace
const workspaceStorageKey = (uid: string) => `lotusbuild.workspace.${uid}`
type AuthState = {
  user: User | null; userData: UserData | null; account: BackendAccount | null; usage: BackendUsage | null
  loading: boolean; accountError: string | null; refreshAccount: () => Promise<void>
  /** Counts sign-in/sign-out transitions: work started under one signed-in session must not land in the next, even for the same account. */
  authEpoch: number
  workspaces: readonly Workspace[]; currentWorkspace: Workspace | null; switchWorkspace: (id: string) => Promise<void>
  getOptionalAuthHeader: () => Promise<Record<string, string>>
  signInWithGoogle: () => Promise<void>; signInWithGithub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>; signOut: () => Promise<void>
  updateTokensUsed: (tokens: number) => Promise<void>; hasTokens: (required: number) => boolean; remainingTokens: number | null
}
const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<BackendAccount | null>(null)
  const [usage, setUsage] = useState<BackendUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [authEpoch, setAuthEpoch] = useState(0)
  const [accountError, setAccountError] = useState<string | null>(null)
  const accountRequest = useRef(0)
  const refreshAccount = useCallback(async () => {
    const request = ++accountRequest.current
    const identity = auth.currentUser
    if (!identity) throw new Error('Sign in to load your account.')
    try {
      const client = currentBackend()
      const nextAccount = await client.me()
      const nextUsage = await client.usage()
      if (auth.currentUser !== identity || request !== accountRequest.current) return
      if (nextAccount.uid !== identity.uid || nextUsage.uid !== identity.uid) throw new Error('The server returned data for a different account.')
      setAccount(nextAccount); setUsage(nextUsage); setAccountError(null)
    } catch (error) {
      if (auth.currentUser === identity && request === accountRequest.current) {
        setAccount(null); setUsage(null)
        setAccountError(error instanceof Error ? error.message : 'Could not load account.')
      }
      throw error
    }
  }, [])
  useEffect(() => {
    let version = 0
    const unsubscribe = onAuthStateChanged(auth, async (identity) => {
      const current = ++version
      accountRequest.current++
      setUser(identity); setAccount(null); setUsage(null); setAccountError(null); setLoading(true); setAuthEpoch((value) => value + 1)
      try { if (identity) await refreshAccount() } catch { /* The explicit account error is rendered by consumers. */ }
      finally { if (current === version) setLoading(false) }
    })
    return () => { version++; accountRequest.current++; unsubscribe() }
  }, [refreshAccount])
  const userData = useMemo<UserData | null>(() => account ? {
    uid: account.uid, email: account.email, displayName: account.displayName ?? null, photoURL: account.photoUrl ?? null,
    planId: account.plan.key, planName: account.plan.name,
  } : null, [account])
  // The server lists the workspaces; which one is current is a client choice remembered per account.
  const workspaces = useMemo<readonly Workspace[]>(() => account?.workspaces ?? [], [account])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  useEffect(() => {
    if (!account) { setSelectedWorkspaceId(null); return }
    try { setSelectedWorkspaceId(window.localStorage.getItem(workspaceStorageKey(account.uid))) } catch { setSelectedWorkspaceId(null) }
  }, [account])
  const currentWorkspace = useMemo<Workspace | null>(() => {
    if (workspaces.length === 0) return null
    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces.find((workspace) => workspace.kind === 'personal') ?? workspaces[0] ?? null
  }, [workspaces, selectedWorkspaceId])
  // Read through refs: a caller that refreshed the account a moment ago (an organisation just created or joined)
  // must see the refreshed memberships, not the ones its closure captured.
  const current = useRef({ account, workspaces }); current.current = { account, workspaces }
  const switchWorkspace = useCallback(async (id: string) => {
    const { account: signedIn, workspaces: available } = current.current
    if (!signedIn) throw new Error('Sign in to switch workspaces.')
    if (!available.some((workspace) => workspace.id === id)) throw new Error('That workspace is not available to this account.')
    setSelectedWorkspaceId(id)
    try { window.localStorage.setItem(workspaceStorageKey(signedIn.uid), id) } catch { /* selection is per tab when storage is unavailable */ }
  }, [])
  const getOptionalAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const identity = auth.currentUser
    return identity ? { Authorization: `Bearer ${await identity.getIdToken()}` } : {}
  }, [])
  return <AuthContext.Provider value={{ user, userData, account, usage, loading, accountError, refreshAccount, authEpoch,
    workspaces, currentWorkspace, switchWorkspace,
    getOptionalAuthHeader,
    signInWithGoogle: async () => { await signInWithPopup(auth, googleProvider) },
    signInWithGithub: async () => { await signInWithPopup(auth, githubProvider) },
    signInWithEmail: async (email, password) => { await signInWithEmailAndPassword(auth, email, password) },
    signUpWithEmail: async (email, password) => { await createUserWithEmailAndPassword(auth, email, password) },
    sendPasswordResetEmail: async (email) => { await sendPasswordResetEmail(auth, email) },
    signOut: async () => { await firebaseSignOut(auth) },
    updateTokensUsed: refreshAccount,
    hasTokens: (required) => required === 0 && account !== null,
    remainingTokens: null,
  }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
