"use client"
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import styles from '../../integrations.module.css'

/**
 * Where GitHub sends the browser after the LotusBuild app is installed and
 * the user has authorised it. The signed-in user posts the installation, the
 * state and the authorisation code back; the server binds them to the connect
 * attempt they started and confirms with GitHub that the installation is
 * theirs before anything is written.
 */
export default function GitHubSetupPage() {
  return (
    <ProtectedRoute>
      <div data-product-theme="dark" className={`dark ${styles.page}`}>
        <Navbar />
        <main className={styles.main}>
          <Suspense fallback={<p className={styles.message} role="status">Connecting GitHub…</p>}>
            <GitHubSetup />
          </Suspense>
        </main>
      </div>
    </ProtectedRoute>
  )
}

type State =
  | { kind: 'working' }
  | { kind: 'done'; account: string }
  | { kind: 'error'; message: string }

function GitHubSetup() {
  const { user } = useAuth()
  const params = useSearchParams()
  const [state, setState] = useState<State>({ kind: 'working' })
  const started = useRef(false)
  const installationId = Number(params.get('installation_id'))
  const state_ = params.get('state')
  const code = params.get('code')
  const setupAction = params.get('setup_action')

  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    if (!state_ || !code || !Number.isInteger(installationId) || installationId <= 0) {
      // Permissions updated or the app reinstalled from GitHub's side: nothing to complete here.
      setState(setupAction === 'update'
        ? { kind: 'error', message: 'GitHub updated the LotusBuild app. Your connection is unchanged.' }
        : { kind: 'error', message: 'This page completes a GitHub install started from Integrations. Start again there.' })
      return
    }
    const returnTo = `${window.location.origin}${window.location.pathname}`
    currentBackend().completeGitHubConnection({ state: state_, code, installationId, returnTo })
      .then(({ connection }) => setState({ kind: 'done', account: connection.account?.name ?? 'GitHub' }))
      .catch((reason: unknown) => setState({ kind: 'error', message: reason instanceof Error ? reason.message : 'GitHub could not be connected.' }))
  }, [user, state_, code, installationId, setupAction])

  return (
    <>
      <header className={styles.intro}>
        <h1 className={styles.title}>GitHub</h1>
        <p className={styles.lead}>
          {state.kind === 'working' && 'Finishing the connection…'}
          {state.kind === 'done' && `Connected as ${state.account}. Open a project and choose Repository to work in one of its repositories.`}
          {state.kind === 'error' && state.message}
        </p>
      </header>
      {state.kind !== 'working' && (
        <p>
          <Link href="/integrations" className="text-[15px] font-medium underline-offset-4 hover:underline">Back to Integrations</Link>
        </p>
      )}
    </>
  )
}
