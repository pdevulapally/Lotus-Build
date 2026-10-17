import { lotusBuildSupportEmail } from '@/lib/lotus-build-site-content'
export function ContactForm() {
  return <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">Contact support</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Email the support team with your question.</p><a className="mt-4 inline-flex text-sm font-medium text-primary underline underline-offset-4" href={`mailto:${lotusBuildSupportEmail}`}>{lotusBuildSupportEmail}</a></section>
}
