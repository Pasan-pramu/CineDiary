import type { CastMember, CrewMember, TitleType, TmdbError, TmdbResult } from '../../shared/types'
import {
  planFieldUpdates,
  valuesFromDraft,
  type SyncPlan,
  type TmdbFieldValues
} from '../../shared/tmdbFields'
import type { TmdbClient, TmdbImage } from './tmdb'

// Re-sync logic for TMDB titles. No Electron or database imports: the database side is passed
// in as a SyncStore (see tmdbLibrary.ts), so tests can run this with fakes.

export interface SyncTitle {
  id: number
  type: TitleType
  tmdbId: number
  /** Current values in my collection (possibly edited by me). */
  values: TmdbFieldValues
  /** TMDB values from the last sync; null for titles from before snapshots existed. */
  snapshot: TmdbFieldValues | null
  hasBackdrop: boolean
}

export interface SyncSave {
  updates: Partial<TmdbFieldValues>
  snapshot: TmdbFieldValues
  cast: CastMember[]
  crew: CrewMember[]
  syncedAt: string
}

export interface SyncStore {
  loadTitle: (id: number) => SyncTitle | null
  /** All genre names in the collection (for mapping TMDB genres onto mine). */
  allGenres: () => string[]
  save: (id: number, save: SyncSave) => void
  saveBackdrop: (id: number, image: TmdbImage) => void
  /** Records a check without changes (e.g. TMDB no longer has the title), so it waits its turn. */
  markChecked: (id: number, syncedAt: string) => void
}

/**
 * 'sync': apply TMDB changes to fields I haven't edited.
 * 'record': the title was just saved from TMDB — keep everything as I saved it and only store
 * the snapshot, cast, crew and backdrop.
 */
export type SyncMode = 'sync' | 'record'

/** Errors that mean "stop for now and try again later". */
export function shouldPause(error: TmdbError): boolean {
  return error.code !== 'not_found'
}

export async function syncTitle(
  id: number,
  client: TmdbClient,
  store: SyncStore,
  mode: SyncMode = 'sync',
  now: () => Date = () => new Date()
): Promise<TmdbResult<SyncPlan>> {
  const title = store.loadTitle(id)
  if (!title) return { ok: true, data: { updates: {}, mine: [] } }
  // Prefer this title's own genre names when TMDB's could map to more than one of mine.
  const details = await client.getDetails(title.type, title.tmdbId, [
    ...title.values.genres,
    ...store.allGenres()
  ])
  if (!details.ok) {
    if (details.error.code === 'not_found') store.markChecked(id, now().toISOString())
    return details
  }

  const next = valuesFromDraft(details.data.draft)
  const plan: SyncPlan =
    mode === 'record'
      ? { updates: {}, mine: [] }
      : planFieldUpdates(title.values, title.snapshot, next)
  store.save(id, {
    updates: plan.updates,
    snapshot: next,
    cast: details.data.cast,
    crew: details.data.crew,
    syncedAt: now().toISOString()
  })

  // Backdrops are only downloaded when missing, never re-downloaded.
  if (!title.hasBackdrop && details.data.backdropPath) {
    const image = await client.fetchImage('w1280', details.data.backdropPath)
    if (image.ok) store.saveBackdrop(id, image.data)
    else if (image.error.code === 'rate_limited' || image.error.code === 'offline') return image
  }
  return { ok: true, data: plan }
}

export interface BatchOptions {
  /** Pause between titles, to stay well under TMDB's rate limits. */
  delayMs: number
  sleep: (ms: number) => Promise<void>
  /** Checked before each title; true stops the run (e.g. cancel). */
  shouldStop: () => boolean
  onProgress?: (done: number, total: number) => void
}

export interface BatchResult {
  done: number
  total: number
  /** null = finished everything. */
  stopped: null | 'cancelled' | TmdbError
}

/** Syncs titles one by one; stops at the first error (rate limit, offline, …) or on cancel. */
export async function runSyncBatch(
  ids: number[],
  client: TmdbClient,
  store: SyncStore,
  options: BatchOptions
): Promise<BatchResult> {
  let done = 0
  for (const id of ids) {
    if (options.shouldStop()) return { done, total: ids.length, stopped: 'cancelled' }
    const result = await syncTitle(id, client, store)
    if (!result.ok && shouldPause(result.error)) {
      return { done, total: ids.length, stopped: result.error }
    }
    done++
    options.onProgress?.(done, ids.length)
    if (done < ids.length) await options.sleep(options.delayMs)
  }
  return { done, total: ids.length, stopped: null }
}
