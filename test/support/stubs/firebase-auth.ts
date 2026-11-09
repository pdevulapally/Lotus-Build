import type { auth as fakeAuth } from './firebase'
export type User = NonNullable<(typeof fakeAuth)['currentUser']>
export const onAuthStateChanged = (auth: typeof fakeAuth, listener: (user: User | null) => void) => auth.subscribe(listener)
export const signInWithPopup = async () => { throw new Error('not in tests') }
export const signInWithEmailAndPassword = signInWithPopup
export const createUserWithEmailAndPassword = signInWithPopup
export const signOut = async (auth: typeof fakeAuth) => auth.signOut()
export const sendPasswordResetEmail = signInWithPopup
export class GoogleAuthProvider {}
export class GithubAuthProvider {}
