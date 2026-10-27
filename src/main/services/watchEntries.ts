import { and, desc, eq, inArray, isNull, type InferSelectModel, sql, type SQL } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../db/client'
import { reasons, titles, watchEntries, watchEntryReasons } from '../db/schema'
import { getTitle } from './titles'
import type {
  JournalEntry,
  JournalQuery,
  JournalResult,
  Reason,
  WatchEntry,
  WatchEntryInput,
  WatchEntryUpdateInput
} from '../../shared/types'
import type { MoodKey } from '../../shared/constants'

type EntryRow = InferSelectModel<typeof watchEntries>
type JournalRow = EntryRow & {
  title: Pick<JournalEntry['title'], 'id' | 'title' | 'type' | 'posterFile' | 'status'>
}

// SQL snippets on watch_entries columns (unqualified, so use them where those names are unique).

/** SQL: true when a watch has any written reflection. */
export const HAS_REFLECTION = sql.raw(`(
  NULLIF(TRIM(thoughts), '') IS NOT NULL OR NULLIF(TRIM(lessons), '') IS NOT NULL
  OR NULLIF(TRIM(favorite_scene), '') IS NOT NULL OR NULLIF(TRIM(favorite_quote), '') IS NOT NULL
  OR NULLIF(TRIM(favorite_character), '') IS NOT NULL OR NULLIF(TRIM(reason_note), '') IS NOT NULL
  OR NULLIF(TRIM(notes), '') IS NOT NULL
)`)

/** SQL: the line we quote from a watch: thoughts first, then lessons, quote, reason, notes. */
export const EXCERPT = sql.raw(`coalesce(
  NULLIF(TRIM(thoughts), ''), NULLIF(TRIM(lessons), ''), NULLIF(TRIM(favorite_quote), ''),
  NULLIF(TRIM(reason_note), ''), NULLIF(TRIM(notes), '')
)`)

function toEntry(row: EntryRow): WatchEntry {
  const reasonRows = getDatabase()
    .select({ id: reasons.id, key: reasons.key, label: reasons.label, isCustom: reasons.isCustom })
    .from(watchEntryReasons)
    .innerJoin(reasons, eq(watchEntryReasons.reasonId, reasons.id))
    .where(eq(watchEntryReasons.watchEntryId, row.id))
    .all()
  return {
    ...row,
    moodBefore: row.moodBefore as MoodKey | null,
    moodAfter: row.moodAfter as MoodKey | null,
    reasons: reasonRows
  }
}

function attachReasons(rows: JournalRow[]): JournalEntry[] {
  if (rows.length === 0) return []
  const reasonRows = getDatabase()
    .select({
      entryId: watchEntryReasons.watchEntryId,
      id: reasons.id,
      key: reasons.key,
      label: reasons.label,
      isCustom: reasons.isCustom
    })
    .from(watchEntryReasons)
    .innerJoin(reasons, eq(watchEntryReasons.reasonId, reasons.id))
    .where(
      inArray(
        watchEntryReasons.watchEntryId,
        rows.map((row) => row.id)
      )
    )
    .all()
  const reasonMap = new Map<number, Reason[]>()
  for (const reason of reasonRows) {
    const list = reasonMap.get(reason.entryId) ?? []
    list.push({
      id: reason.id,
      key: reason.key,
      label: reason.label,
      isCustom: reason.isCustom
    })
    reasonMap.set(reason.entryId, list)
  }
  return rows.map((row) => ({
    ...row,
    moodBefore: row.moodBefore as MoodKey | null,
    moodAfter: row.moodAfter as MoodKey | null,
    reasons: reasonMap.get(row.id) ?? []
  }))
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/** The Journal's search and filter conditions (also reused by the Timeline). */
export function journalConditions(query: JournalQuery): SQL[] {
  const conditions: SQL[] = []
  const search = query.search.trim()
  if (search) {
    const pattern = `%${escapeLike(search)}%`
    conditions.push(sql`(
        ${titles.title} LIKE ${pattern} ESCAPE '\\'
        OR ${watchEntries.reasonNote} LIKE ${pattern} ESCAPE '\\'
        OR ${watchEntries.thoughts} LIKE ${pattern} ESCAPE '\\'
        OR ${watchEntries.lessons} LIKE ${pattern} ESCAPE '\\'
        OR ${watchEntries.favoriteQuote} LIKE ${pattern} ESCAPE '\\'
      )`)
  }
  if (query.type !== 'all') conditions.push(eq(titles.type, query.type))
  if (query.reasonId !== null) {
    conditions.push(sql`EXISTS (
        SELECT 1 FROM watch_entry_reasons AS journal_filter_reasons
        WHERE journal_filter_reasons.watch_entry_id = ${watchEntries.id}
          AND journal_filter_reasons.reason_id = ${query.reasonId}
      )`)
  }
  if (query.moodBefore !== null) conditions.push(eq(watchEntries.moodBefore, query.moodBefore))
  if (query.moodImproved) {
    conditions.push(
      sql`${watchEntries.moodBeforeScore} IS NOT NULL
          AND ${watchEntries.moodAfterScore} IS NOT NULL
          AND ${watchEntries.moodAfterScore} > ${watchEntries.moodBeforeScore}`
    )
  }
  if (query.hasReflection) {
    conditions.push(sql`(
        NULLIF(TRIM(${watchEntries.thoughts}), '') IS NOT NULL
        OR NULLIF(TRIM(${watchEntries.lessons}), '') IS NOT NULL
        OR NULLIF(TRIM(${watchEntries.favoriteCharacter}), '') IS NOT NULL
        OR NULLIF(TRIM(${watchEntries.favoriteScene}), '') IS NOT NULL
        OR NULLIF(TRIM(${watchEntries.favoriteQuote}), '') IS NOT NULL
      )`)
  }
  return conditions
}

function toJournalRow(row: { entry: EntryRow; title: typeof titles.$inferSelect }): JournalRow {
  return {
    ...row.entry,
    title: {
      id: row.title.id,
      title: row.title.title,
      type: row.title.type,
      posterFile: row.title.posterFile,
      status: row.title.status
    }
  }
}

export function searchJournal(query: JournalQuery): JournalResult {
  const database = getDatabase()
  const where = journalConditions(query)
  const rows = database
    .select({ entry: watchEntries, title: titles })
    .from(watchEntries)
    .innerJoin(titles, eq(watchEntries.titleId, titles.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(
      desc(sql`COALESCE(${watchEntries.completedAt}, ${watchEntries.startedAt})`),
      desc(watchEntries.id)
    )
    .all()
    .map(toJournalRow)
  const entries = attachReasons(rows)
  const currentlyWatching = entries.filter(
    (entry) => entry.completedAt === null && entry.title.status !== 'dropped'
  )
  const groupedEntries = entries.filter(
    (entry) => entry.completedAt !== null || entry.title.status === 'dropped'
  )
  const today = new Date()
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`
  const monthEntries = entries.filter((entry) =>
    (entry.completedAt ?? entry.startedAt).startsWith(monthPrefix)
  )
  const beforeScores = entries.flatMap((entry) =>
    entry.moodBeforeScore === null ? [] : [entry.moodBeforeScore]
  )
  const afterScores = entries.flatMap((entry) =>
    entry.moodAfterScore === null ? [] : [entry.moodAfterScore]
  )
  const changes = entries.flatMap((entry) =>
    entry.moodBeforeScore !== null && entry.moodAfterScore !== null
      ? [entry.moodAfterScore - entry.moodBeforeScore]
      : []
  )
  const average = (values: number[]): number | null =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  return {
    entries: groupedEntries,
    currentlyWatching,
    summary: {
      entriesThisMonth: monthEntries.length,
      averageMoodBefore: average(beforeScores),
      averageMoodAfter: average(afterScores),
      averageMoodChange: average(changes)
    }
  }
}

function updateTitleStatus(titleId: number): void {
  const database = getDatabase()
  const active = database
    .select({ id: watchEntries.id })
    .from(watchEntries)
    .where(and(eq(watchEntries.titleId, titleId), isNull(watchEntries.completedAt)))
    .get()
  const completed = database
    .select({ id: watchEntries.id })
    .from(watchEntries)
    .where(and(eq(watchEntries.titleId, titleId), sql`${watchEntries.completedAt} IS NOT NULL`))
    .get()
  const title = getTitle(titleId)
  if (!title) return
  const status = active
    ? completed
      ? 'rewatching'
      : 'watching'
    : completed
      ? 'completed'
      : 'planned'
  database
    .update(titles)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(titles.id, titleId))
    .run()
}

function assertOneActive(titleId: number, entryId?: number): void {
  const active = getDatabase()
    .select({ id: watchEntries.id })
    .from(watchEntries)
    .where(and(eq(watchEntries.titleId, titleId), isNull(watchEntries.completedAt)))
    .get()
  if (active && active.id !== entryId)
    throw new Error('This title already has an in-progress watch.')
}

function saveReasons(entryId: number, reasonIds: number[] | undefined): void {
  const database = getDatabase()
  database.delete(watchEntryReasons).where(eq(watchEntryReasons.watchEntryId, entryId)).run()
  for (const reasonId of [...new Set(reasonIds ?? [])]) {
    database.insert(watchEntryReasons).values({ watchEntryId: entryId, reasonId }).run()
  }
}

function getEntry(id: number): WatchEntry {
  const row = getDatabase().select().from(watchEntries).where(eq(watchEntries.id, id)).get()
  if (!row) throw new Error('Watch entry not found.')
  return toEntry(row)
}

export function listWatchEntries(titleId?: number): WatchEntry[] {
  const rows =
    titleId === undefined
      ? getDatabase().select().from(watchEntries).orderBy(desc(watchEntries.startedAt)).all()
      : getDatabase()
          .select()
          .from(watchEntries)
          .where(eq(watchEntries.titleId, titleId))
          .orderBy(desc(watchEntries.startedAt))
          .all()
  return rows.map(toEntry)
}

export function startWatch(input: WatchEntryInput): WatchEntry {
  assertOneActive(input.titleId)
  const title = getTitle(input.titleId)
  if (!title) throw new Error('Title not found.')
  const now = new Date().toISOString()
  const id = getDatabase()
    .insert(watchEntries)
    .values({
      titleId: input.titleId,
      startedAt: input.startedAt,
      isRewatch: (input.isRewatch ?? title.status === 'completed') || title.status === 'rewatching',
      episodesWatched: input.episodesWatched ?? 0,
      moodBefore: input.moodBefore,
      moodBeforeScore: input.moodBeforeScore,
      reasonNote: input.reasonNote,
      createdAt: now,
      updatedAt: now
    })
    .returning({ id: watchEntries.id })
    .get().id
  saveReasons(id, input.reasonIds)
  updateTitleStatus(input.titleId)
  return getEntry(id)
}

export function finishWatch(input: WatchEntryUpdateInput): WatchEntry {
  const existing = getEntry(input.id)
  const now = new Date().toISOString()
  getDatabase()
    .update(watchEntries)
    .set({
      completedAt: input.completedAt ?? existing.completedAt,
      moodAfter: input.moodAfter,
      moodAfterScore: input.moodAfterScore,
      thoughts: input.thoughts,
      lessons: input.lessons,
      favoriteCharacter: input.favoriteCharacter,
      favoriteScene: input.favoriteScene,
      favoriteQuote: input.favoriteQuote,
      wouldRewatch: input.wouldRewatch,
      wouldRecommend: input.wouldRecommend,
      notes: input.notes,
      episodesWatched: input.episodesWatched ?? existing.episodesWatched,
      updatedAt: now
    })
    .where(eq(watchEntries.id, input.id))
    .run()
  saveReasons(input.id, input.reasonIds)
  if (input.rating !== undefined)
    getDatabase()
      .update(titles)
      .set({ rating: input.rating })
      .where(eq(titles.id, existing.titleId))
      .run()
  updateTitleStatus(existing.titleId)
  return getEntry(input.id)
}

export function createPastWatch(input: WatchEntryInput): WatchEntry {
  if (!input.completedAt) throw new Error('A past watch needs a completed date.')
  assertOneActive(input.titleId)
  const now = new Date().toISOString()
  const id = getDatabase()
    .insert(watchEntries)
    .values({
      titleId: input.titleId,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      isRewatch: input.isRewatch ?? false,
      episodesWatched: input.episodesWatched ?? 0,
      moodBefore: input.moodBefore,
      moodBeforeScore: input.moodBeforeScore,
      reasonNote: input.reasonNote,
      moodAfter: input.moodAfter,
      moodAfterScore: input.moodAfterScore,
      thoughts: input.thoughts,
      lessons: input.lessons,
      favoriteCharacter: input.favoriteCharacter,
      favoriteScene: input.favoriteScene,
      favoriteQuote: input.favoriteQuote,
      wouldRewatch: input.wouldRewatch,
      wouldRecommend: input.wouldRecommend,
      notes: input.notes,
      createdAt: now,
      updatedAt: now
    })
    .returning({ id: watchEntries.id })
    .get().id
  saveReasons(id, input.reasonIds)
  if (input.rating !== undefined)
    getDatabase()
      .update(titles)
      .set({ rating: input.rating })
      .where(eq(titles.id, input.titleId))
      .run()
  updateTitleStatus(input.titleId)
  return getEntry(id)
}

export function updateWatch(input: WatchEntryUpdateInput): WatchEntry {
  const existing = getEntry(input.id)
  if (!input.completedAt) assertOneActive(existing.titleId, input.id)
  const now = new Date().toISOString()
  getDatabase()
    .update(watchEntries)
    .set({
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      episodesWatched: input.episodesWatched ?? existing.episodesWatched,
      moodBefore: input.moodBefore,
      moodBeforeScore: input.moodBeforeScore,
      reasonNote: input.reasonNote,
      moodAfter: input.moodAfter,
      moodAfterScore: input.moodAfterScore,
      thoughts: input.thoughts,
      lessons: input.lessons,
      favoriteCharacter: input.favoriteCharacter,
      favoriteScene: input.favoriteScene,
      favoriteQuote: input.favoriteQuote,
      wouldRewatch: input.wouldRewatch,
      wouldRecommend: input.wouldRecommend,
      notes: input.notes,
      updatedAt: now
    })
    .where(eq(watchEntries.id, input.id))
    .run()
  saveReasons(input.id, input.reasonIds)
  if (input.rating !== undefined)
    getDatabase()
      .update(titles)
      .set({ rating: input.rating })
      .where(eq(titles.id, existing.titleId))
      .run()
  updateTitleStatus(existing.titleId)
  return getEntry(input.id)
}

export function deleteWatch(id: number): void {
  const existing = getEntry(id)
  getDatabase().delete(watchEntries).where(eq(watchEntries.id, id)).run()
  updateTitleStatus(existing.titleId)
}

export function incrementEpisodes(id: number): WatchEntry {
  const entry = getEntry(id)
  const title = getTitle(entry.titleId)
  if (!title || title.type !== 'series')
    throw new Error('Episode progress is only available for series.')
  if (title.totalEpisodes !== null && entry.episodesWatched >= title.totalEpisodes)
    throw new Error('All episodes are already marked watched.')
  getDatabase()
    .update(watchEntries)
    .set({ episodesWatched: entry.episodesWatched + 1, updatedAt: new Date().toISOString() })
    .where(eq(watchEntries.id, id))
    .run()
  return getEntry(id)
}

export function listReasons(): Reason[] {
  return getDatabase().select().from(reasons).orderBy(reasons.label).all()
}

export function createReason(label: string): Reason {
  const clean = label.trim()
  if (!clean) throw new Error('Reason cannot be empty.')
  const key = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${randomUUID().slice(0, 8)}`
  getDatabase().insert(reasons).values({ key, label: clean, isCustom: true }).run()
  const reason = getDatabase().select().from(reasons).where(eq(reasons.key, key)).get()
  if (!reason) throw new Error('Reason could not be created.')
  return reason
}

/** Marks a watch as a highlight on the timeline (or unmarks it). */
export function setHighlight(id: number, isHighlight: boolean): WatchEntry {
  const database = getDatabase()
  database
    .update(watchEntries)
    .set({ isHighlight, updatedAt: new Date().toISOString() })
    .where(eq(watchEntries.id, id))
    .run()
  const row = database.select().from(watchEntries).where(eq(watchEntries.id, id)).get()
  if (!row) throw new Error('Watch entry not found.')
  return toEntry(row)
}
