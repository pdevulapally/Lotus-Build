/** Keep both cancellation sources connected until the response body is consumed. */
export async function withRequestSignal<T>(
  lifetime: AbortSignal | undefined,
  caller: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  lifetime?.throwIfAborted()
  caller?.throwIfAborted()
  async function finish(signal: AbortSignal) {
    try {
      return await run(signal)
    } finally {
      // Some transports resolve or throw a decoding error despite cancellation.
      signal.throwIfAborted()
    }
  }
  if (!lifetime || !caller || lifetime === caller) {
    return finish(caller ?? lifetime ?? new AbortController().signal)
  }

  const linked = new AbortController()
  const disconnect = () => {
    lifetime.removeEventListener('abort', abort)
    caller.removeEventListener('abort', abort)
  }
  function abort(this: AbortSignal) {
    disconnect()
    linked.abort(this.reason)
  }
  lifetime.addEventListener('abort', abort)
  caller.addEventListener('abort', abort)
  try {
    return await finish(linked.signal)
  } finally {
    disconnect()
  }
}
