import { eq, type InferSelectModel } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { watchEntries } from '../db/schema'

type WatchEntryRow = InferSelectModel<typeof watchEntries>

export function listWatchEntries(titleId?: number): WatchEntryRow[] {
  const database = getDatabase()
  return titleId === undefined
    ? database.select().from(watchEntries).all()
    : database.select().from(watchEntries).where(eq(watchEntries.titleId, titleId)).all()
}
