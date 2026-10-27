import { and, asc, desc, eq, inArray, sql, type InferSelectModel, type SQL } from 'drizzle-orm'
import {
  deleteBackdropFile,
  deletePosterFile,
  deleteTemporaryPoster,
  moveTemporaryPoster
} from './posters'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { genres, titleGenres, titles } from '../db/schema'
import type {
  CollectionQuery,
  CollectionResult,
  CreateTitleInput,
  Title,
  UpdateTitleInput
} from '../../shared/types'

type TitleRow = InferSelectModel<typeof titles>

function withGenres(rows: TitleRow[], database: CineDiaryDatabase = getDatabase()): Title[] {
  if (rows.length === 0) return []
  const genreRows = database
    .select({ titleId: titleGenres.titleId, name: genres.name })
    .from(titleGenres)
    .innerJoin(genres, eq(titleGenres.genreId, genres.id))
    .where(
      inArray(
        titleGenres.titleId,
        rows.map((row) => row.id)
      )
    )
    .all()
  const genreMap = new Map<number, string[]>()
  for (const genre of genreRows) {
    const names = genreMap.get(genre.titleId) ?? []
    names.push(genre.name)
    genreMap.set(genre.titleId, names)
  }
  return rows.map((row) => ({ ...row, genres: genreMap.get(row.id) ?? [] }))
}

export function listTitles(): Title[] {
  return withGenres(getDatabase().select().from(titles).all())
}

/** The collection's title with this TMDB id and type, if any (they're unique together). */
export function findTitleByTmdb(tmdbId: number, type: Title['type']): Title | undefined {
  const row = getDatabase()
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.type, type)))
    .get()
  return row ? withGenres([row])[0] : undefined
}

/** Titles for the given ids, in the same order (missing ids are skipped). */
export function getTitlesByIds(
  ids: number[],
  database: CineDiaryDatabase = getDatabase()
): Title[] {
  if (ids.length === 0) return []
  const rows = database.select().from(titles).where(inArray(titles.id, ids)).all()
  const byId = new Map(withGenres(rows, database).map((title) => [title.id, title]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

export function getTitle(id: number): Title | undefined {
  const row = getDatabase().select().from(titles).where(eq(titles.id, id)).get()
  return row ? withGenres([row])[0] : undefined
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function collectionConditions(query: CollectionQuery): SQL[] {
  const conditions: SQL[] = []
  if (query.search.trim()) {
    conditions.push(sql`${titles.title} LIKE ${`%${escapeLike(query.search.trim())}%`} ESCAPE '\\'`)
  }
  if (query.type !== 'all') conditions.push(eq(titles.type, query.type))
  if (query.status !== 'all') conditions.push(eq(titles.status, query.status))
  if (query.favorite) conditions.push(eq(titles.isFavorite, true))
  if (query.minimumRating !== null) {
    conditions.push(sql`${titles.rating} >= ${query.minimumRating}`)
  }
  if (query.genre) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM title_genres AS filter_title_genres
      INNER JOIN genres AS filter_genres
        ON filter_genres.id = filter_title_genres.genre_id
      WHERE filter_title_genres.title_id = ${titles.id}
        AND filter_genres.name = ${query.genre}
    )`)
  }
  return conditions
}

export function searchTitles(query: CollectionQuery): CollectionResult {
  const database = getDatabase()
  const conditions = collectionConditions(query)
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const sortDirection = query.direction === 'asc' ? asc : desc
  const orderBy =
    query.sort === 'title'
      ? [sortDirection(titles.title), asc(titles.id)]
      : query.sort === 'rating'
        ? [
            asc(sql`CASE WHEN ${titles.rating} IS NULL THEN 1 ELSE 0 END`),
            sortDirection(titles.rating),
            asc(titles.title)
          ]
        : query.sort === 'year'
          ? [sortDirection(titles.year), asc(titles.title)]
          : [desc(titles.createdAt), asc(titles.title)]
  const rows = database
    .select()
    .from(titles)
    .where(where)
    .orderBy(...orderBy)
    .all()
  const count = database
    .select({ count: sql<number>`count(DISTINCT ${titles.id})` })
    .from(titles)
    .where(where)
    .get()
  return { titles: withGenres(rows), total: count?.count ?? 0 }
}

export function listGenres(): string[] {
  return getDatabase()
    .select({ name: genres.name })
    .from(genres)
    .all()
    .map((genre) => genre.name)
}

export function createTitle(input: CreateTitleInput): Title {
  const database = getDatabase()
  const now = new Date().toISOString()
  if (input.tmdbId !== undefined) {
    const existing = findTitleByTmdb(input.tmdbId, input.type)
    if (existing) throw new Error(`“${existing.title}” is already in your collection.`)
  }
  const result = database.transaction((transaction) => {
    const inserted = transaction
      .insert(titles)
      .values({
        type: input.type,
        title: input.title,
        originalTitle: input.originalTitle,
        year: input.year,
        overview: input.overview,
        country: input.country,
        language: input.language,
        runtimeMinutes: input.runtimeMinutes,
        totalSeasons: input.totalSeasons,
        totalEpisodes: input.totalEpisodes,
        status: input.status,
        rating: input.rating,
        isFavorite: input.isFavorite,
        tmdbId: input.tmdbId,
        imdbId: input.imdbId,
        // Details came from TMDB just now (used later to re-sync stale titles).
        tmdbSyncedAt: input.tmdbId !== undefined ? now : null,
        createdAt: now,
        updatedAt: now
      })
      .returning({ id: titles.id })
      .get()
    for (const name of [...new Set(input.genres.map((genre) => genre.trim()))]) {
      transaction.insert(genres).values({ name }).onConflictDoNothing().run()
      const genre = transaction.select().from(genres).where(eq(genres.name, name)).get()
      if (genre)
        transaction.insert(titleGenres).values({ titleId: inserted.id, genreId: genre.id }).run()
    }
    return inserted.id
  })
  let savedPosterFile: string | null = null
  try {
    if (input.tempPosterFile) {
      const extension = input.tempPosterFile.slice(input.tempPosterFile.lastIndexOf('.'))
      savedPosterFile = moveTemporaryPoster(input.tempPosterFile, result, extension)
      database
        .update(titles)
        .set({ posterFile: savedPosterFile, updatedAt: now })
        .where(eq(titles.id, result))
        .run()
    }
  } catch (error) {
    database.delete(titles).where(eq(titles.id, result)).run()
    deleteTemporaryPoster(input.tempPosterFile)
    deletePosterFile(savedPosterFile)
    throw error
  }
  const title = getTitle(result)
  if (!title) throw new Error('The title was created but could not be loaded.')
  return title
}

export function deleteTitle(id: number): void {
  const database = getDatabase()
  const title = getTitle(id)
  if (!title) return
  database.delete(titles).where(eq(titles.id, id)).run()
  deletePosterFile(title.posterFile)
  deleteBackdropFile(title.backdropFile)
}

/**
 * Moves a temporary poster into place as this title's poster. The old file is only deleted
 * when its name differs (both are named after the title id, e.g. "12.jpg").
 */
export function replacePosterFromTemp(
  titleId: number,
  tempFile: string,
  oldPosterFile: string | null
): void {
  const extension = tempFile.slice(tempFile.lastIndexOf('.'))
  const posterFile = moveTemporaryPoster(tempFile, titleId, extension)
  if (oldPosterFile && oldPosterFile !== posterFile) deletePosterFile(oldPosterFile)
  getDatabase()
    .update(titles)
    .set({ posterFile, updatedAt: new Date().toISOString() })
    .where(eq(titles.id, titleId))
    .run()
}

export function updateTitle(input: UpdateTitleInput): Title {
  const database = getDatabase()
  const existing = getTitle(input.id)
  if (!existing) throw new Error('Title not found.')
  const now = new Date().toISOString()
  database.transaction((transaction) => {
    transaction
      .update(titles)
      .set({
        type: input.type,
        title: input.title,
        originalTitle: input.originalTitle ?? null,
        year: input.year,
        overview: input.overview,
        country: input.country,
        language: input.language,
        runtimeMinutes: input.runtimeMinutes,
        totalSeasons: input.totalSeasons,
        totalEpisodes: input.totalEpisodes,
        status: input.status,
        rating: input.rating,
        isFavorite: input.isFavorite,
        updatedAt: now
      })
      .where(eq(titles.id, input.id))
      .run()
    transaction.delete(titleGenres).where(eq(titleGenres.titleId, input.id)).run()
    for (const name of [...new Set(input.genres.map((genre) => genre.trim()))]) {
      transaction.insert(genres).values({ name }).onConflictDoNothing().run()
      const genre = transaction.select().from(genres).where(eq(genres.name, name)).get()
      if (genre)
        transaction.insert(titleGenres).values({ titleId: input.id, genreId: genre.id }).run()
    }
  })
  if (input.removePoster) {
    deletePosterFile(existing.posterFile)
    database
      .update(titles)
      .set({ posterFile: null, updatedAt: now })
      .where(eq(titles.id, input.id))
      .run()
  }
  if (input.tempPosterFile) {
    replacePosterFromTemp(
      input.id,
      input.tempPosterFile,
      input.removePoster ? null : existing.posterFile
    )
  }
  const title = getTitle(input.id)
  if (!title) throw new Error('Title could not be loaded after update.')
  return title
}

export function setTitleStatus(id: number, status: 'dropped' | 'watching' | 'rewatching'): Title {
  const database = getDatabase()
  database
    .update(titles)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(titles.id, id))
    .run()
  const title = getTitle(id)
  if (!title) throw new Error('Title not found.')
  return title
}

export function toggleFavorite(id: number): Title {
  const database = getDatabase()
  const title = getTitle(id)
  if (!title) throw new Error('Title not found.')
  database
    .update(titles)
    .set({ isFavorite: !title.isFavorite, updatedAt: new Date().toISOString() })
    .where(eq(titles.id, id))
    .run()
  const updated = getTitle(id)
  if (!updated) throw new Error('Title not found after update.')
  return updated
}
