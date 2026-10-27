import type { LinkChoice, Title, TmdbTitleDraft } from './types'

// The TMDB-sourced fields of a title, and the two rules built on them:
// - Link to TMDB: per field, keep my value or use TMDB's (defaults below).
// - Re-sync: a field I edited (it differs from the last TMDB snapshot) is never overwritten.
// Values are always compared AFTER our mapping (genre aliases, country/language names), so
// mapped TMDB data never looks like my own edit.

export interface TmdbFieldValues {
  title: string
  originalTitle: string | null
  year: number | null
  overview: string | null
  genres: string[]
  country: string | null
  language: string | null
  runtimeMinutes: number | null
  totalSeasons: number | null
  totalEpisodes: number | null
  imdbId: string | null
}

export type TmdbField = keyof TmdbFieldValues

/** Fields re-sync may update (and the snapshot stores). */
export const SYNC_FIELDS: TmdbField[] = [
  'title',
  'originalTitle',
  'year',
  'overview',
  'genres',
  'country',
  'language',
  'runtimeMinutes',
  'totalSeasons',
  'totalEpisodes',
  'imdbId'
]

/** Fields shown in the Link to TMDB comparison (the poster is handled separately). */
export const LINK_FIELDS: Array<{ key: TmdbField; label: string; seriesOnly?: boolean }> = [
  { key: 'title', label: 'Title' },
  { key: 'originalTitle', label: 'Original title' },
  { key: 'year', label: 'Year' },
  { key: 'overview', label: 'Synopsis' },
  { key: 'genres', label: 'Genres' },
  { key: 'country', label: 'Country' },
  { key: 'language', label: 'Language' },
  { key: 'runtimeMinutes', label: 'Runtime' },
  { key: 'totalSeasons', label: 'Seasons', seriesOnly: true },
  { key: 'totalEpisodes', label: 'Episodes', seriesOnly: true }
]

export const POSTER_CHOICE = 'poster'

export function valuesFromTitle(title: Title): TmdbFieldValues {
  return {
    title: title.title,
    originalTitle: title.originalTitle,
    year: title.year,
    overview: title.overview,
    genres: title.genres,
    country: title.country,
    language: title.language,
    runtimeMinutes: title.runtimeMinutes,
    totalSeasons: title.totalSeasons,
    totalEpisodes: title.totalEpisodes,
    imdbId: title.imdbId
  }
}

export function valuesFromDraft(draft: TmdbTitleDraft): TmdbFieldValues {
  return {
    title: draft.title,
    originalTitle: draft.originalTitle,
    year: draft.year,
    overview: draft.overview,
    genres: draft.genres,
    country: draft.country,
    language: draft.language,
    runtimeMinutes: draft.runtimeMinutes,
    totalSeasons: draft.totalSeasons,
    totalEpisodes: draft.totalEpisodes,
    imdbId: draft.imdbId
  }
}

type FieldValue = TmdbFieldValues[TmdbField]

export function isEmpty(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  return typeof value === 'string' && value.trim() === ''
}

function genreSet(genres: string[]): string {
  return [...new Set(genres.map((genre) => genre.trim().toLowerCase()))].sort().join('|')
}

/** Equal for our purposes: genres as a case-insensitive set, text trimmed, empty == null. */
export function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  if (isEmpty(a) && isEmpty(b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && genreSet(a) === genreSet(b)
  }
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim()
  return a === b
}

/** Link to TMDB defaults: keep my value when I have one, otherwise fill from TMDB. */
export function defaultLinkChoice(
  mine: FieldValue | undefined,
  tmdb: FieldValue | undefined
): LinkChoice {
  return isEmpty(mine) && !isEmpty(tmdb) ? 'tmdb' : 'mine'
}

export function defaultLinkChoices(
  mine: TmdbFieldValues,
  tmdb: TmdbFieldValues,
  poster: { mine: boolean; tmdb: boolean }
): Record<string, LinkChoice> {
  const choices: Record<string, LinkChoice> = {}
  for (const { key } of LINK_FIELDS) choices[key] = defaultLinkChoice(mine[key], tmdb[key])
  choices[POSTER_CHOICE] = !poster.mine && poster.tmdb ? 'tmdb' : 'mine'
  return choices
}

/** The values to write when linking: only fields chosen as "Use TMDB" (imdbId always). */
export function linkUpdates(
  next: TmdbFieldValues,
  choices: Record<string, LinkChoice>
): Partial<TmdbFieldValues> {
  const updates: Partial<TmdbFieldValues> = {}
  for (const { key } of LINK_FIELDS) {
    if (choices[key] === 'tmdb') Object.assign(updates, { [key]: next[key] })
  }
  // The IMDb id is an identifier, not something shown or edited, so it always comes along.
  if (next.imdbId) updates.imdbId = next.imdbId
  return updates
}

export interface SyncPlan {
  /** Fields to change to TMDB's new value. */
  updates: Partial<TmdbFieldValues>
  /** Fields left alone because they look like my own edits. */
  mine: TmdbField[]
}

/**
 * Re-sync rule per field:
 * - already equal to TMDB → nothing to do;
 * - equal to the last snapshot (I never changed it) → follow TMDB;
 * - no snapshot yet (titles from before snapshots existed) → only fill empty fields;
 * - otherwise it's my edit → keep it.
 * The caller then stores `next` as the new snapshot.
 */
export function planFieldUpdates(
  current: TmdbFieldValues,
  snapshot: TmdbFieldValues | null,
  next: TmdbFieldValues
): SyncPlan {
  const updates: Partial<TmdbFieldValues> = {}
  const mine: TmdbField[] = []
  for (const field of SYNC_FIELDS) {
    if (sameValue(current[field], next[field])) continue
    const untouched = snapshot
      ? sameValue(current[field], snapshot[field])
      : isEmpty(current[field])
    if (untouched) Object.assign(updates, { [field]: next[field] })
    else mine.push(field)
  }
  return { updates, mine }
}
