import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { lifePeriods, reasons, titles, watchEntries, watchEntryReasons } from '../db/schema'
import { getLocalDate, type MoodKey } from '../../shared/constants'
import { chaptersOn, computeMilestones, type ChapterColor } from '../../shared/timeline'
import type {
  ChapterSummary,
  LifePeriod,
  LifePeriodInput,
  TimelineEntry,
  TimelineOverview,
  TimelinePage,
  TimelineQuery
} from '../../shared/types'
import { EXCERPT, journalConditions } from './watchEntries'

// My Timeline: the diary as a life story, newest first, loaded a few months at a time.
// Search and type use the Journal's own conditions; chapters and highlights are added here.

/** Roughly how many watches one page holds (always whole months). */
const PAGE_SIZE = 60

/** Where a watch sits: its completed date, or its start date while in progress. */
const TIMELINE_DATE = sql`coalesce(${watchEntries.completedAt}, ${watchEntries.startedAt})`
const TIMELINE_MONTH = sql`substr(${TIMELINE_DATE}, 1, 7)`

function toLifePeriod(row: typeof lifePeriods.$inferSelect): LifePeriod {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    color: row.color as ChapterColor,
    note: row.note
  }
}

export function listLifePeriods(db: CineDiaryDatabase = getDatabase()): LifePeriod[] {
  return db
    .select()
    .from(lifePeriods)
    .orderBy(desc(lifePeriods.startDate), desc(lifePeriods.id))
    .all()
    .map(toLifePeriod)
}

function conditions(db: CineDiaryDatabase, query: TimelineQuery, today: string): SQL[] {
  const where = journalConditions({
    search: query.search,
    type: query.type,
    reasonId: null,
    moodBefore: null,
    moodImproved: false,
    hasReflection: false
  })
  if (query.highlightsOnly) where.push(eq(watchEntries.isHighlight, true))
  if (query.chapterId !== null) {
    const chapter = db.select().from(lifePeriods).where(eq(lifePeriods.id, query.chapterId)).get()
    if (!chapter) where.push(sql`0`)
    else {
      where.push(sql`${TIMELINE_DATE} BETWEEN ${chapter.startDate} AND ${chapter.endDate ?? today}`)
    }
  }
  return where
}

/**
 * One page of the timeline: whole months, newest first, starting before `before` (YYYY-MM).
 * Milestones are worked out over the whole diary, so filters never move them.
 */
export function getTimelinePage(
  query: TimelineQuery,
  before: string | null,
  db: CineDiaryDatabase = getDatabase(),
  today = getLocalDate()
): TimelinePage {
  const where = conditions(db, query, today)
  const monthCounts = db
    .select({ month: sql<string>`${TIMELINE_MONTH}`, count: sql<number>`count(*)` })
    .from(watchEntries)
    .innerJoin(titles, eq(watchEntries.titleId, titles.id))
    .where(and(...where, before ? sql`${TIMELINE_MONTH} < ${before}` : undefined))
    .groupBy(TIMELINE_MONTH)
    .orderBy(desc(TIMELINE_MONTH))
    .all()

  // Whole months until the page is full (at least one month).
  const months: string[] = []
  let size = 0
  for (const { month, count } of monthCounts) {
    if (months.length > 0 && size + count > PAGE_SIZE) break
    months.push(month)
    size += count
  }
  if (months.length === 0) return { months: [], nextBefore: null }

  const rows = db
    .select({
      entry: watchEntries,
      title: {
        id: titles.id,
        title: titles.title,
        type: titles.type,
        posterFile: titles.posterFile
      },
      note: sql<string | null>`${EXCERPT}`
    })
    .from(watchEntries)
    .innerJoin(titles, eq(watchEntries.titleId, titles.id))
    .where(and(...where, inArray(TIMELINE_MONTH, months)))
    .orderBy(desc(TIMELINE_DATE), desc(watchEntries.id))
    .all()

  const reasonRows = rows.length
    ? db
        .select({ entryId: watchEntryReasons.watchEntryId, label: reasons.label })
        .from(watchEntryReasons)
        .innerJoin(reasons, eq(watchEntryReasons.reasonId, reasons.id))
        .where(
          inArray(
            watchEntryReasons.watchEntryId,
            rows.map((row) => row.entry.id)
          )
        )
        .all()
    : []
  const reasonsByEntry = new Map<number, string[]>()
  for (const row of reasonRows) {
    reasonsByEntry.set(row.entryId, [...(reasonsByEntry.get(row.entryId) ?? []), row.label])
  }

  const milestones = computeMilestones(
    db
      .select({
        id: watchEntries.id,
        titleId: watchEntries.titleId,
        startedAt: watchEntries.startedAt,
        completedAt: watchEntries.completedAt
      })
      .from(watchEntries)
      .all()
  )
  const chapters = listLifePeriods(db)

  const byMonth = new Map<string, TimelineEntry[]>(months.map((month) => [month, []]))
  for (const { entry, title, note } of rows) {
    const date = entry.completedAt ?? entry.startedAt
    byMonth.get(date.slice(0, 7))?.push({
      id: entry.id,
      title,
      date,
      completed: entry.completedAt !== null,
      isRewatch: entry.isRewatch,
      isHighlight: entry.isHighlight,
      moodBefore: entry.moodBefore as MoodKey | null,
      moodBeforeScore: entry.moodBeforeScore,
      moodAfter: entry.moodAfter as MoodKey | null,
      moodAfterScore: entry.moodAfterScore,
      reasons: reasonsByEntry.get(entry.id) ?? [],
      note,
      milestones: milestones.get(entry.id) ?? [],
      chapterIds: chaptersOn(date, chapters, today)
    })
  }
  return {
    months: months.map((month) => ({ month, entries: byMonth.get(month) ?? [] })),
    nextBefore: months.length < monthCounts.length ? months[months.length - 1] : null
  }
}

/** Finished watches inside a chapter: count, average mood change (with n) and top genre. */
export function chapterSummary(
  chapter: LifePeriod,
  db: CineDiaryDatabase = getDatabase(),
  today = getLocalDate()
): ChapterSummary {
  const range = sql`we.completed_at IS NOT NULL
    AND we.completed_at BETWEEN ${chapter.startDate} AND ${chapter.endDate ?? today}`
  const totals = db.get<{ watches: number; average: number | null; moodN: number }>(sql`
    SELECT count(*) AS "watches",
      avg(we.mood_after_score - we.mood_before_score) AS "average",
      count(we.mood_after_score - we.mood_before_score) AS "moodN"
    FROM watch_entries we WHERE ${range}`)
  const genre = db.get<{ name: string } | undefined>(sql`
    SELECT g.name AS "name" FROM watch_entries we
    JOIN title_genres tg ON tg.title_id = we.title_id
    JOIN genres g ON g.id = tg.genre_id
    WHERE ${range}
    GROUP BY g.id ORDER BY count(*) DESC, g.name LIMIT 1`)
  return {
    watches: totals.watches,
    averageMoodChange: totals.average,
    moodN: totals.moodN,
    topGenre: genre?.name ?? null
  }
}

/** Years (for the jump list) under the current filters, and every chapter with its summary. */
export function getTimelineOverview(
  query: TimelineQuery,
  db: CineDiaryDatabase = getDatabase(),
  today = getLocalDate()
): TimelineOverview {
  const years = db
    .select({ year: sql<string>`substr(${TIMELINE_DATE}, 1, 4)`, count: sql<number>`count(*)` })
    .from(watchEntries)
    .innerJoin(titles, eq(watchEntries.titleId, titles.id))
    .where(and(...conditions(db, query, today)))
    .groupBy(sql`substr(${TIMELINE_DATE}, 1, 4)`)
    .orderBy(desc(sql`substr(${TIMELINE_DATE}, 1, 4)`))
    .all()
  return {
    total: years.reduce((sum, year) => sum + year.count, 0),
    years,
    chapters: listLifePeriods(db).map((chapter) => ({
      ...chapter,
      summary: chapterSummary(chapter, db, today)
    }))
  }
}

export function createLifePeriod(input: LifePeriodInput): LifePeriod {
  const now = new Date().toISOString()
  const row = getDatabase()
    .insert(lifePeriods)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning()
    .get()
  return toLifePeriod(row)
}

export function updateLifePeriod(id: number, input: LifePeriodInput): LifePeriod {
  const row = getDatabase()
    .update(lifePeriods)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(lifePeriods.id, id))
    .returning()
    .get()
  if (!row) throw new Error('Chapter not found.')
  return toLifePeriod(row)
}

export function deleteLifePeriod(id: number): void {
  getDatabase().delete(lifePeriods).where(eq(lifePeriods.id, id)).run()
}
