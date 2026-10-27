import { useEffect, useSyncExternalStore } from 'react'
import type { AppSettings } from '../../../shared/types'

// One shared copy of the settings, so saving the display name in Settings
// updates the greeting, top bar and sidebar right away.

let current: AppSettings | null = null
let loading = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Store settings returned by any window.api.settings call. */
export function setSettings(next: AppSettings): void {
  current = next
  for (const listener of listeners) listener()
}

/** null until the first load finishes. */
export function useSettings(): AppSettings | null {
  const settings = useSyncExternalStore(subscribe, () => current)
  useEffect(() => {
    if (current || loading) return
    loading = true
    void window.api.settings
      .get()
      .then(setSettings)
      .finally(() => {
        loading = false
      })
  }, [])
  return settings
}
