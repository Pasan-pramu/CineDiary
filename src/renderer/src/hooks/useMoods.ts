import { useEffect, useSyncExternalStore } from 'react'
import { quietly } from '../errors'
import type { Mood, ReasonOption } from '../../../shared/types'

// Moods and reasons for the whole renderer: loaded once, refreshed after any change
// (a "+ New mood" in the watch dialog, or Settings → Moods & reasons). Hidden ones are included;
// pickers leave them out, everything that shows old entries keeps them.

let moods: Mood[] = []
let reasons: ReasonOption[] = []
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reloads both lists (call after creating, renaming, hiding, reordering or deleting). */
export function refreshMoods(): Promise<void> {
  loading = Promise.all([window.api.moods.list(), window.api.reasons.list()]).then(
    ([nextMoods, nextReasons]) => {
      moods = nextMoods
      reasons = nextReasons
      loaded = true
      for (const listener of listeners) listener()
    }
  )
  return loading
}

function useLoaded(): void {
  useEffect(() => {
    if (!loaded && !loading) void refreshMoods().catch(quietly('moods:list'))
  }, [])
}

/** Every mood, in your order (hidden ones included). Empty until the first load. */
export function useMoods(): Mood[] {
  useLoaded()
  return useSyncExternalStore(subscribe, () => moods)
}

/** Every reason, in your order (hidden ones included). Empty until the first load. */
export function useReasons(): ReasonOption[] {
  useLoaded()
  return useSyncExternalStore(subscribe, () => reasons)
}

/** For a picker: the visible ones, plus any hidden one that's already selected. */
export function pickable<T extends { isHidden: boolean }>(
  items: T[],
  isSelected: (item: T) => boolean
): T[] {
  return items.filter((item) => !item.isHidden || isSelected(item))
}

/** For a filter: visible ones first, then hidden ones marked "(hidden)". */
export function filterOptions<T extends { isHidden: boolean; label: string }>(
  items: T[]
): Array<T & { optionLabel: string }> {
  return [
    ...items.filter((item) => !item.isHidden).map((item) => ({ ...item, optionLabel: item.label })),
    ...items
      .filter((item) => item.isHidden)
      .map((item) => ({ ...item, optionLabel: `${item.label} (hidden)` }))
  ]
}
