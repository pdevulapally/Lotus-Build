/**
 * Runs one Settings action on behalf of the account signed in when it started. If the signed-in
 * account changes before the action completes, nothing it learns is shown under the new account:
 * no message, no error, no busy reset — the new account starts from a clean dialog.
 */
export interface FencedActions {
  busy(value: boolean): void
  error(message: string | null): void
  message(text: string | null): void
}

export const principalFence = (principal: () => string) =>
  async (work: (live: () => boolean) => Promise<void>, actions: FencedActions): Promise<void> => {
    const started = principal()
    const live = () => principal() === started
    actions.busy(true); actions.error(null); actions.message(null)
    try {
      await work(live)
    } catch (reason) {
      if (live()) actions.error(reason instanceof Error ? reason.message : 'The operation failed.')
    } finally {
      if (live()) actions.busy(false)
    }
  }
