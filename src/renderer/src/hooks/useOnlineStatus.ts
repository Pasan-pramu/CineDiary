import { useSyncExternalStore } from 'react'

// One shared online flag for the whole UI, kept up to date by the main process's
// connectivity service (it pushes a change event; we never poll from here).

let online = navigator.onLine
let listening = false
const listeners = new Set<() => void>()

function set(next: boolean): void {
  if (next === online) return
  online = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (!listening) {
    listening = true
    void window.api.connectivity.get().then((status) => set(status.online))
    window.api.connectivity.onChange((status) => set(status.online))
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True when TMDB is reachable. Everything local works either way. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => online)
}
