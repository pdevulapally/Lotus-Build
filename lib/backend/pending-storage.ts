type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Preserve old tab-scoped command identities when moving to storage that survives tab closure. */
export function durablePendingStorage(durable: Storage, legacy: Storage): Storage {
  return {
    getItem(key) {
      const saved = durable.getItem(key)
      const old = legacy.getItem(key)
      if (saved !== null && old !== null && saved !== old) throw new Error('Two pending commands need review. Do not submit a replacement request.')
      if (old !== null) { durable.setItem(key, old); legacy.removeItem(key) }
      return saved ?? old
    },
    setItem(key, value) { durable.setItem(key, value); legacy.removeItem(key) },
    removeItem(key) { durable.removeItem(key); legacy.removeItem(key) },
  }
}

export function pendingCommandStorage(): Storage { return durablePendingStorage(localStorage, sessionStorage) }
