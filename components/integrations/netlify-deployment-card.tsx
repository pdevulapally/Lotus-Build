'use client'
import { Button } from '@/components/ui/button'
import type { NetlifyDeployment } from '@/lib/backend/netlify'

const statusText: Record<NetlifyDeployment['status'], string> = { preparing: 'Preparing build review', awaiting_approval: 'Ready for review', uploading: 'Submitting to Netlify', processing: 'Netlify is preparing the site', ready: 'Published', error: 'Deployment failed', uncertain: 'Check Netlify', rejected: 'Cancelled' }
export function NetlifyDeploymentCard({ record, busy, onSubmit, now = Date.now() }: { record: NetlifyDeployment; busy: boolean; onSubmit: (action: 'approve' | 'reject') => void; now?: number }) {
  const expired = Date.parse(record.expiresAt) <= now
  return <li className="space-y-4 border-b border-border py-6">
    <div className="space-y-1"><h2 className="text-lg font-semibold">{record.title}</h2><p className="text-sm text-muted-foreground">{record.status === 'awaiting_approval' && expired ? 'Build review expired' : statusText[record.status]} · {new Date(record.createdAt).toLocaleString()}</p></div>
    <dl className="grid gap-2 text-sm"><div><dt className="inline text-muted-foreground">Netlify team: </dt><dd className="inline break-all">{record.accountSlug}</dd></div><div><dt className="inline text-muted-foreground">Destination: </dt><dd className="inline break-all">{record.siteId ? `Update this project’s site (${record.siteId})` : 'Create a new site for this project'}</dd></div><div><dt className="inline text-muted-foreground">Build output: </dt><dd className="inline break-all">{record.publishDirectory} · {record.files} files · {(record.bytes / 1024 / 1024).toFixed(2)} MB</dd></div></dl>
    {record.status === 'awaiting_approval' && !expired && <><p className="text-sm leading-relaxed text-muted-foreground">Publishing makes these files accessible on Netlify. An update replaces this site’s published version. Your Netlify plan and usage limits apply. This approval expires in one hour from preparation.</p><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => onSubmit('approve')}>Approve and publish</Button><Button variant="outline" disabled={busy} onClick={() => onSubmit('reject')}>Cancel</Button></div></>}
    {record.message && <p role="status" className="text-sm text-muted-foreground">{record.message}</p>}
    {record.status === 'uncertain' && <a href="https://app.netlify.com/" target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">Open Netlify</a>}
    {record.status === 'ready' && <div className="flex flex-wrap gap-4 text-sm">{record.deployUrl && <a href={record.deployUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open this deployment</a>}{record.url && <a href={record.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Open current site</a>}</div>}
    {record.status === 'uploading' && <p className="text-sm text-muted-foreground">If this remains unchanged, check Netlify before trying another publish. An interrupted request may already have been accepted.</p>}
    <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Build details</summary><div className="mt-3 space-y-2"><p className="break-all">Build command: {record.buildCommand || 'Already prepared static files'}</p><p className="break-all">Artifact SHA-256: {record.sha256}</p>{record.deployId && <p className="break-all">Netlify deploy: {record.deployId}</p>}</div></details>
  </li>
}
