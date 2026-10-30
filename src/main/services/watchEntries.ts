import { and, desc, eq, inArray, isNull, type InferSelectModel, sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { containsPattern } from '../db/like'
import { lastPossibleDaySql } from '../db/watchDates'
import { reasons, titles, watchEntries, watchEntryReasons } from '../db/schema'
import { isMoodKey } from './moods'
import { getTitle } from './titles'
import type {
  FirstWatch,
  JournalEntry,
  JournalQuery,
  JournalResult,
  Reason,
  WatchEntry,
  WatchEntryInput,
  WatchEntryUpdateInput
} from '../../shared/types'
import { getLocalDate, type MoodKey } from '../../shared/constants'
import { storedWatchDate, type DatePrecision } from '../../shared/watchDate'

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

/** Where a watch sits in time: its completed date, or its start date while in progress. */
const WATCH_DATE = sql`coalesce(${watchEntries.completedAt}, ${watchEntries.startedAt})`

/**
 * The Journal's search and filter conditions (also used by the Timeline).
 * A chapter runs from its start date to its end date, or to `today` while it's ongoing.
 */
export function journalConditions(query: JournalQuery, today = getLocalDate()): SQL[] {
  const conditions: SQL[] = []
  const search = query.search.trim()
  if (search) {
    const pattern = containsPattern(search)
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
  if (query.feelingOrReason !== null) {
    // "Lonely (feeling or reason)": the mood before, or a reason with the same key or name.
    const label = sql`(SELECT label FROM moods WHERE key = ${query.feelingOrReason})`
    conditions.push(sql`(
        ${watchEntries.moodBefore} = ${query.feelingOrReason}
        OR EXISTS (
          SELECT 1 FROM watch_entry_reasons AS feeling_reasons
          JOIN reasons AS feeling_reason ON feeling_reason.id = feeling_reasons.reason_id
          WHERE feeling_reasons.watch_entry_id = ${watchEntries.id}
            AND (feeling_reason.key = ${query.feelingOrReason}
              OR lower(feeling_reason.label) = lower(coalesce(${label}, '')))
        )
      )`)
  }
  if (query.chapterId !== null) {
    // Only watches certainly inside the chapter: a month or year date must fit wholly, an
    // unknown one never does. A chapter that no longer exists has no start date: no match.
    conditions.push(sql`${watchEntries.datePrecision} != 'unknown'
        AND ${WATCH_DATE} >= (SELECT start_date FROM life_periods WHERE id = ${query.chapterId})
        AND ${lastPossibleDaySql(WATCH_DATE, sql`${watchEntries.datePrecision}`)}
          <= coalesce((SELECT end_date FROM life_periods WHERE id = ${query.chapterId}), ${today})`)
  }
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
    .orderBy(desc(WATCH_DATE), desc(watchEntries.id))
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
  // A year-only date can't be "this month" (it's stored as 1 January).
  const monthEntries = entries.filter(
    (entry) =>
      (entry.datePrecision === 'day' || entry.datePrecision === 'month') &&
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
    total: entries.length,
    summary: {
      entriesThisMonth: monthEntries.length,
      averageMoodBefore: average(beforeScores),
      averageMoodAfter: average(afterScores),
      averageMoodChange: average(changes)
    }
  }
}

/**
 * Recomputes a title's status from its watches: an open run → watching (rewatching if an
 * earlier run finished), otherwise completed if any run finished, else planned.
 * "Dropped" is your decision, so it stays while you edit, log or delete watches; only starting
 * or finishing a watch (`resume`) recomputes a dropped title.
 */
function updateTitleStatus(titleId: number, resume = false): void {
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
  if (title.status === 'dropped' && !resume) return
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

/** Moods can be custom, so the main process checks the keys exist (zod only checks the shape). */
function assertKnownMoods(input: { moodBefore?: string; moodAfter?: string }): void {
  for (const key of [input.moodBefore, input.moodAfter]) {
    if (key !== undefined && !isMoodKey(key)) throw new Error(`Unknown mood “${key}”.`)
  }
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

/**
 * The fields the watch form shows. A field you emptied is saved as empty: drizzle skips
 * `undefined` in an update, which would quietly keep the old value.
 */
function formFields(input: Omit<WatchEntryInput, 'titleId'>): Partial<EntryRow> {
  return {
    startedAt: input.startedAt,
    moodBefore: input.moodBefore ?? null,
    moodBeforeScore: input.moodBeforeScore ?? null,
    reasonNote: input.reasonNote ?? null,
    moodAfter: input.moodAfter ?? null,
    moodAfterScore: input.moodAfterScore ?? null,
    thoughts: input.thoughts ?? null,
    lessons: input.lessons ?? null,
    favoriteCharacter: input.favoriteCharacter ?? null,
    favoriteScene: input.favoriteScene ?? null,
    favoriteQuote: input.favoriteQuote ?? null
  }
}

/**
 * The dates stored for a finished watch (shared/watchDate.ts): an exact day as given; a month,
 * a year or "I don't remember" as the first day it could be, with the start date the same.
 */
function finishedDates(input: Omit<WatchEntryInput, 'titleId'>): {
  startedAt: string
  completedAt: string
  datePrecision: DatePrecision
} {
  const datePrecision = input.datePrecision ?? 'day'
  if (datePrecision === 'unknown' || input.completedAt) {
    const completedAt = storedWatchDate(input.completedAt ?? '', datePrecision)
    return {
      startedAt: datePrecision === 'day' ? input.startedAt : completedAt,
      completedAt,
      datePrecision
    }
  }
  throw new Error('A finished watch needs a date (or “I don’t remember”).')
}

/** A finished watch: a completed date, or "I don't remember". */
function isFinished(input: Omit<WatchEntryInput, 'titleId'>): boolean {
  return Boolean(input.completedAt) || input.datePrecision === 'unknown'
}

/** The personal rating belongs to the title: a number sets it, null clears it, undefined keeps it. */
function saveRating(titleId: number, rating: number | null | undefined): void {
  if (rating === undefined) return
  getDatabase().update(titles).set({ rating }).where(eq(titles.id, titleId)).run()
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
  assertKnownMoods(input)
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
  updateTitleStatus(input.titleId, true)
  return getEntry(id)
}

export function finishWatch(input: WatchEntryUpdateInput): WatchEntry {
  assertKnownMoods(input)
  const existing = getEntry(input.id)
  const now = new Date().toISOString()
  getDatabase()
    .update(watchEntries)
    .set({
      ...formFields(input),
      ...(isFinished(input)
        ? finishedDates(input)
        : { completedAt: existing.completedAt, datePrecision: existing.datePrecision }),
      wouldRewatch: input.wouldRewatch,
      wouldRecommend: input.wouldRecommend,
      notes: input.notes,
      episodesWatched: input.episodesWatched ?? existing.episodesWatched,
      updatedAt: now
    })
    .where(eq(watchEntries.id, input.id))
    .run()
  saveReasons(input.id, input.reasonIds)
  saveRating(existing.titleId, input.rating)
  updateTitleStatus(existing.titleId, true)
  return getEntry(input.id)
}

export function createPastWatch(input: WatchEntryInput): WatchEntry {
  if (!isFinished(input)) throw new Error('A past watch needs a completed date.')
  assertKnownMoods(input)
  // A finished watch can be logged any time, even while another run is in progress.
  const now = new Date().toISOString()
  const id = getDatabase()
    .insert(watchEntries)
    .values({
      titleId: input.titleId,
      ...finishedDates(input),
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
  saveRating(input.titleId, input.rating)
  updateTitleStatus(input.titleId)
  return getEntry(id)
}

/**
 * Saves an edit. Without a completed date the watch is (or stays) in progress, so editing an
 * open run never finishes it.
 */
/**
 * The watch saved with a new title ("Have you watched it?"), with no feelings yet: Watching now
 * starts one today, Already watched logs a finished one with "I don't remember" as its date.
 * The form that opens next edits it, so closing that form still leaves a real watch behind.
 */
export function logFirstWatch(
  titleId: number,
  firstWatch: FirstWatch,
  today = getLocalDate()
): WatchEntry {
  return firstWatch === 'watching'
    ? startWatch({ titleId, startedAt: today })
    : createPastWatch({ titleId, startedAt: today, datePrecision: 'unknown' })
}

export function updateWatch(input: WatchEntryUpdateInput): WatchEntry {
  assertKnownMoods(input)
  const existing = getEntry(input.id)
  const finished = isFinished(input)
  if (!finished) assertOneActive(existing.titleId, input.id)
  const now = new Date().toISOString()
  getDatabase()
    .update(watchEntries)
    .set({
      ...formFields(input),
      ...(finished ? finishedDates(input) : { completedAt: null, datePrecision: 'day' as const }),
      episodesWatched: input.episodesWatched ?? existing.episodesWatched,
      wouldRewatch: input.wouldRewatch,
      wouldRecommend: input.wouldRecommend,
      notes: input.notes,
      updatedAt: now
    })
    .where(eq(watchEntries.id, input.id))
    .run()
  saveReasons(input.id, input.reasonIds)
  saveRating(existing.titleId, input.rating)
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
