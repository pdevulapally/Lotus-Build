"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as firebaseSignOut, sendPasswordResetEmail, type User } from 'firebase/auth'
import { auth, googleProvider, githubProvider } from '@/lib/firebase'
type AuthState = {
  user: User | null; loading: boolean
  signInWithGoogle: () => Promise<void>; signInWithGithub: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>; signOut: () => Promise<void>
}
const AuthContext = createContext<AuthState | undefined>(undefined)
/** Identity only. No legacy account, balances, billing or workspace bootstrap calls. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(auth, identity => { setUser(identity); setLoading(false) }), [])
  return <AuthContext.Provider value={{ user, loading,
    signInWithGoogle: async () => { await signInWithPopup(auth, googleProvider) },
    signInWithGithub: async () => { await signInWithPopup(auth, githubProvider) },
    signInWithEmail: async (email, password) => { await signInWithEmailAndPassword(auth, email, password) },
    signUpWithEmail: async (email, password) => { await createUserWithEmailAndPassword(auth, email, password) },
    sendPasswordResetEmail: async email => { await sendPasswordResetEmail(auth, email) },
    signOut: async () => { await firebaseSignOut(auth) },
  }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
