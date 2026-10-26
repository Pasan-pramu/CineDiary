import { and, desc, eq, isNull, type InferSelectModel, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../db/client'
import { reasons, titles, watchEntries, watchEntryReasons } from '../db/schema'
import { getTitle } from './titles'
import type { Reason, WatchEntry, WatchEntryInput, WatchEntryUpdateInput } from '../../shared/types'
import type { MoodKey } from '../../shared/constants'

type EntryRow = InferSelectModel<typeof watchEntries>

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
