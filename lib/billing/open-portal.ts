/** Portal URLs grant access to an account. Recheck identity after the network round trip. */
export async function openBillingPortal(options: {
  uid: string
  currentUid: () => string | undefined
  isCurrent: () => boolean
  create: () => Promise<{ url: string }>
  navigate: (url: string) => void
}) {
  const ensureIdentity = () => {
    if (options.currentUid() !== options.uid) throw new Error('Your signed-in account changed. Reopen billing before trying again.')
  }
  ensureIdentity()
  const result = await options.create()
  if (!options.isCurrent()) return
  ensureIdentity()
  options.navigate(result.url)
}
