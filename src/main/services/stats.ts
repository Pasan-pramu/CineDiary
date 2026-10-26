import { sql } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { titles, watchEntries } from '../db/schema'

export interface Stats {
  titleCount: number
  watchEntryCount: number
}

export function getStats(): Stats {
  const database = getDatabase()
  const titleCount = database
    .select({ count: sql<number>`count(*)` })
    .from(titles)
    .get()
  const watchEntryCount = database
    .select({ count: sql<number>`count(*)` })
    .from(watchEntries)
    .get()
  return {
    titleCount: titleCount?.count ?? 0,
    watchEntryCount: watchEntryCount?.count ?? 0
  }
}
