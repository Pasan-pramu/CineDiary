import { eq, type InferSelectModel } from 'drizzle-orm'
import { deletePosterFile, deleteTemporaryPoster, moveTemporaryPoster } from './posters'
import { getDatabase } from '../db/client'
import { genres, titleGenres, titles } from '../db/schema'
import type { CreateTitleInput, Title } from '../../shared/types'

type TitleRow = InferSelectModel<typeof titles>

function toTitle(row: TitleRow): Title {
  const genreRows = getDatabase()
    .select({ name: genres.name })
    .from(titleGenres)
    .innerJoin(genres, eq(titleGenres.genreId, genres.id))
    .where(eq(titleGenres.titleId, row.id))
    .all()
  return { ...row, genres: genreRows.map((genre) => genre.name) }
}

export function listTitles(): Title[] {
  return getDatabase().select().from(titles).all().map(toTitle)
}

export function getTitle(id: number): Title | undefined {
  const row = getDatabase().select().from(titles).where(eq(titles.id, id)).get()
  return row ? toTitle(row) : undefined
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
  const result = database.transaction((transaction) => {
    const inserted = transaction
      .insert(titles)
      .values({
        type: input.type,
        title: input.title,
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
}
