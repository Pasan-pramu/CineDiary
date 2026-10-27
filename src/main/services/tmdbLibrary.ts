import { asc, eq, isNotNull } from 'drizzle-orm'
import { net } from 'electron'
import { getDatabase } from '../db/client'
import { genres, titleCast, titleCrew, titleGenres, titles } from '../db/schema'
import {
  linkUpdates,
  POSTER_CHOICE,
  valuesFromDraft,
  valuesFromTitle,
  type TmdbFieldValues
} from '../../shared/tmdbFields'
import type { Title, TitleCredits, TmdbLinkInput, TmdbResult } from '../../shared/types'
import { checkConnectivity } from './connectivity'
import { saveBackdropFile } from './posters'
import { getTmdbToken } from './settings'
import { findTitleByTmdb, getTitle, listGenres, replacePosterFromTemp } from './titles'
import { createTmdbClient } from './tmdb'
import { syncTitle, type SyncSave, type SyncStore, type SyncTitle } from './tmdbSync'

// TMDB data in my collection: the app's TMDB client, the database side of re-sync,
// cast & crew, and "Link to TMDB".

export const tmdbClient = createTmdbClient({
  fetch: (url, init) => net.fetch(url, init),
  getToken: getTmdbToken,
  onNetworkError: () => void checkConnectivity()
})

function parseSnapshot(json: string | null): TmdbFieldValues | null {
  if (!json) return null
  try {
    const value = JSON.parse(json) as Partial<TmdbFieldValues>
    return typeof value.title === 'string' && Array.isArray(value.genres)
      ? (value as TmdbFieldValues)
      : null
  } catch {
    return null
  }
}

function replaceGenres(titleId: number, names: string[]): void {
  const database = getDatabase()
  database.delete(titleGenres).where(eq(titleGenres.titleId, titleId)).run()
  for (const name of [...new Set(names.map((genre) => genre.trim()).filter(Boolean))]) {
    database.insert(genres).values({ name }).onConflictDoNothing().run()
    const genre = database.select().from(genres).where(eq(genres.name, name)).get()
    if (genre) database.insert(titleGenres).values({ titleId, genreId: genre.id }).run()
  }
}

function writeSync(id: number, save: SyncSave, tmdbId?: number): void {
  const database = getDatabase()
  database.transaction(() => {
    const { genres: genreUpdate, ...columns } = save.updates
    const changed = Object.keys(save.updates).length > 0
    database
      .update(titles)
      .set({
        ...columns,
        ...(tmdbId !== undefined ? { tmdbId } : {}),
        tmdbSnapshot: JSON.stringify(save.snapshot),
        tmdbSyncedAt: save.syncedAt,
        ...(changed ? { updatedAt: save.syncedAt } : {})
      })
      .where(eq(titles.id, id))
      .run()
    if (genreUpdate) replaceGenres(id, genreUpdate)
    database.delete(titleCast).where(eq(titleCast.titleId, id)).run()
    database.delete(titleCrew).where(eq(titleCrew.titleId, id)).run()
    for (const member of save.cast)
      database
        .insert(titleCast)
        .values({ titleId: id, ...member })
        .run()
    for (const member of save.crew)
      database
        .insert(titleCrew)
        .values({ titleId: id, ...member })
        .run()
  })
}

export const librarySyncStore: SyncStore = {
  loadTitle: (id): SyncTitle | null => {
    const title = getTitle(id)
    if (!title?.tmdbId) return null
    const row = getDatabase()
      .select({ snapshot: titles.tmdbSnapshot })
      .from(titles)
      .where(eq(titles.id, id))
      .get()
    return {
      id,
      type: title.type,
      tmdbId: title.tmdbId,
      values: valuesFromTitle(title),
      snapshot: parseSnapshot(row?.snapshot ?? null),
      hasBackdrop: title.backdropFile !== null
    }
  },
  allGenres: () => listGenres(),
  save: (id, save) => writeSync(id, save),
  saveBackdrop: (id, image) => {
    const backdropFile = saveBackdropFile(id, image.bytes, image.contentType)
    getDatabase().update(titles).set({ backdropFile }).where(eq(titles.id, id)).run()
  },
  markChecked: (id, syncedAt) => {
    getDatabase().update(titles).set({ tmdbSyncedAt: syncedAt }).where(eq(titles.id, id)).run()
  }
}

/** After saving a title from TMDB: store snapshot, cast, crew and backdrop (changes nothing else). */
export function enrichNewTitle(id: number): Promise<TmdbResult<unknown>> {
  return syncTitle(id, tmdbClient, librarySyncStore, 'record')
}

export function getTitleCredits(titleId: number): TitleCredits {
  const database = getDatabase()
  const cast = database
    .select({ name: titleCast.name, character: titleCast.character, order: titleCast.order })
    .from(titleCast)
    .where(eq(titleCast.titleId, titleId))
    .orderBy(asc(titleCast.order))
    .all()
  const crew = database
    .select({ name: titleCrew.name, role: titleCrew.role })
    .from(titleCrew)
    .where(eq(titleCrew.titleId, titleId))
    .orderBy(asc(titleCrew.order))
    .all()
  return {
    cast,
    directors: crew.filter((member) => member.role === 'director').map((member) => member.name),
    creators: crew.filter((member) => member.role === 'creator').map((member) => member.name)
  }
}

/** TMDB titles that are due: never fully synced first, then synced before `staleBefore`. */
export function listTitlesToSync(staleBefore: string | null, limit?: number): number[] {
  const rows = getDatabase()
    .select({ id: titles.id, snapshot: titles.tmdbSnapshot, syncedAt: titles.tmdbSyncedAt })
    .from(titles)
    .where(isNotNull(titles.tmdbId))
    .all()
  const due = rows
    .filter(
      (row) => row.snapshot === null || staleBefore === null || (row.syncedAt ?? '') < staleBefore
    )
    .sort(
      (a, b) =>
        Number(a.snapshot !== null) - Number(b.snapshot !== null) ||
        (a.syncedAt ?? '').localeCompare(b.syncedAt ?? '')
    )
    .map((row) => row.id)
  return limit === undefined ? due : due.slice(0, limit)
}

/**
 * Links a manual title to TMDB. Only fields chosen as "Use TMDB" change; my personal data
 * (status, rating, favorite, watches, moods, reasons, reflections) is never touched.
 */
export async function linkTitle(input: TmdbLinkInput): Promise<TmdbResult<Title>> {
  const title = getTitle(input.titleId)
  const fail = (message: string): TmdbResult<Title> => ({
    ok: false,
    error: { code: 'unknown', message }
  })
  if (!title) return fail('This title no longer exists.')
  if (title.tmdbId !== null) return fail('This title is already linked to TMDB.')
  const duplicate = findTitleByTmdb(input.tmdbId, title.type)
  if (duplicate) return fail(`“${duplicate.title}” is already linked to that TMDB title.`)

  const details = await tmdbClient.getDetails(title.type, input.tmdbId, [
    ...title.genres,
    ...listGenres()
  ])
  if (!details.ok) return details
  const next = valuesFromDraft(details.data.draft)
  const updates = linkUpdates(next, input.choices)
  writeSync(
    title.id,
    {
      updates,
      snapshot: next,
      cast: details.data.cast,
      crew: details.data.crew,
      syncedAt: new Date().toISOString()
    },
    input.tmdbId
  )
  if (input.choices[POSTER_CHOICE] === 'tmdb' && input.tempPosterFile) {
    replacePosterFromTemp(title.id, input.tempPosterFile, title.posterFile)
  }
  if (details.data.backdropPath && !title.backdropFile) {
    const image = await tmdbClient.fetchImage('w1280', details.data.backdropPath)
    if (image.ok) librarySyncStore.saveBackdrop(title.id, image.data)
  }
  const linked = getTitle(title.id)
  return linked ? { ok: true, data: linked } : fail('The title could not be loaded after linking.')
}
