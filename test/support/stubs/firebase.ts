/** A Firebase Auth double the lifecycle tests drive: `signIn(user)` / `signOut()` notify every subscriber, as the SDK does. */
type Listener = (user: FakeUser | null) => void
export interface FakeUser { uid: string; email: string; emailVerified: boolean; getIdToken: () => Promise<string> }
const listeners = new Set<Listener>()
export const auth = {
  currentUser: null as FakeUser | null,
  subscribe(listener: Listener) { listeners.add(listener); listener(auth.currentUser); return () => { listeners.delete(listener) } },
  signIn(uid: string) { auth.currentUser = { uid, email: `${uid}@example.test`, emailVerified: true, getIdToken: async () => `token-${uid}` }; for (const listener of [...listeners]) listener(auth.currentUser) },
  signOut() { auth.currentUser = null; for (const listener of [...listeners]) listener(null) },
}
export const googleProvider = {}
export const githubProvider = {}
