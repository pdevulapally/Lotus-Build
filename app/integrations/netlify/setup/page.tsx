'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/ui/navbar'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/contexts/auth-context'
import { currentBackend } from '@/lib/backend/browser'
import styles from '../../integrations.module.css'

export default function NetlifySetupPage() {
  return <ProtectedRoute><div data-product-theme="dark" className={`dark ${styles.page}`}><Navbar /><main className={styles.main}><Suspense fallback={<p role="status">Connecting Netlify…</p>}><Complete /></Suspense></main></div></ProtectedRoute>
}
function Complete() {
  const { user } = useAuth(); const params = useSearchParams(); const started = useRef(false)
  const [state, setState] = useState<{ working: boolean; error: boolean; message: string }>({ working: true, error: false, message: 'Finishing the Netlify connection…' })
  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    const code = params.get('code'); const oauthState = params.get('state'); const denied = params.get('error')
    const returnTo = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState(null, '', returnTo)
    if (denied || !code || !oauthState) { setState({ working: false, error: true, message: 'Netlify was not connected. Start again from Integrations when you’re ready.' }); return }
    currentBackend().completeNetlifyConnection({ code, state: oauthState, returnTo }).then(({ connection }) => {
      setState({ working: false, error: false, message: `Connected as ${connection.account?.name ?? 'your Netlify account'}. Choose project access and enable deployment preparation in Integration access before asking the agent to publish.` })
    }).catch(reason => setState({ working: false, error: true, message: reason instanceof Error ? reason.message : 'The connection could not be confirmed. Start again from Integrations.' }))
  }, [params, user])
  return <><header className={styles.intro}><h1 className={styles.title}>Netlify</h1><p className={styles.lead} role={state.error ? 'alert' : 'status'}>{state.message}</p></header>{!state.working && <Link href="/integrations" className="underline underline-offset-4">Back to Integrations</Link>}</>
}
