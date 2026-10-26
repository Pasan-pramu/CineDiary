import { eq, type InferSelectModel } from 'drizzle-orm'
import { deletePosterFile } from './posters'
import { getDatabase } from '../db/client'
import { titles } from '../db/schema'

type TitleRow = InferSelectModel<typeof titles>

export function listTitles(): TitleRow[] {
  return getDatabase().select().from(titles).all()
}

export function getTitle(id: number): TitleRow | undefined {
  return getDatabase().select().from(titles).where(eq(titles.id, id)).get()
}

export function deleteTitle(id: number): void {
  const database = getDatabase()
  const title = getTitle(id)
  if (!title) return
  database.delete(titles).where(eq(titles.id, id)).run()
  deletePosterFile(title.posterFile)
}
