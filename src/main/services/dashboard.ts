import { sql } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { getLocalDate, type MoodKey } from '../../shared/constants'
import type {
  CurrentWatch,
  DashboardData,
  RecentWatch,
  TimelineItem,
  Title,
  WatchMemory
} from '../../shared/types'
import { getMoodTrend, getNewTitlesSince, getRatingChangeSince, periodStart } from './stats'
import { getTitlesByIds } from './titles'
import { EXCERPT, HAS_REFLECTION } from './watchEntries'

// The Home page's lists. Counting lives in stats.ts (the page also calls stats.insights);
// this file only picks which titles and memories to show.

const ROW_LIMIT = 8
const FAVORITES_LIMIT = 20
const TIMELINE_LIMIT = 5
const MOOD_TREND_LIMIT = 12
const MEMORY_MIN_AGE_DAYS = 30

function titlesInOrder<T extends { titleId: number }>(rows: T[]): Array<T & { title: Title }> {
  const titles = new Map(getTitlesByIds(rows.map((row) => row.titleId)).map((t) => [t.id, t]))
  return rows.flatMap((row) => {
    const title = titles.get(row.titleId)
    return title ? [{ ...row, title }] : []
  })
}

function getRecentlyWatched(): RecentWatch[] {
  const rows = getDatabase().all<{ titleId: number; completedAt: string }>(sql`
    SELECT title_id AS "titleId", max(completed_at) AS "completedAt"
    FROM watch_entries
    WHERE completed_at IS NOT NULL
    GROUP BY title_id
    ORDER BY max(completed_at) DESC, max(id) DESC
    LIMIT ${ROW_LIMIT}`)
  return titlesInOrder(rows).map(({ title, completedAt }) => ({ title, completedAt }))
}

/** Open watches, except on titles you dropped (same rule as the Journal). */
function getCurrentlyWatching(): CurrentWatch[] {
  const rows = getDatabase().all<{
    titleId: number
    startedAt: string
    episodesWatched: number
    isRewatch: number
  }>(sql`
    SELECT we.title_id AS "titleId", we.started_at AS "startedAt",
      we.episodes_watched AS "episodesWatched", we.is_rewatch AS "isRewatch"
    FROM watch_entries we
    JOIN titles t ON t.id = we.title_id
    WHERE we.completed_at IS NULL AND t.status != 'dropped'
    ORDER BY we.started_at DESC, we.id DESC
    LIMIT ${ROW_LIMIT}`)
  return titlesInOrder(rows).map(({ title, startedAt, episodesWatched, isRewatch }) => ({
    title,
    startedAt,
    episodesWatched,
    isRewatch: Boolean(isRewatch)
  }))
}

function getRecentlyAdded(): Title[] {
  const rows = getDatabase().all<{ titleId: number }>(sql`
    SELECT id AS "titleId" FROM titles ORDER BY created_at DESC, id DESC LIMIT ${ROW_LIMIT}`)
  return titlesInOrder(rows).map(({ title }) => title)
}

function getFavorites(): Title[] {
  const rows = getDatabase().all<{ titleId: number }>(sql`
    SELECT id AS "titleId" FROM titles
    WHERE is_favorite = 1
    ORDER BY rating IS NULL, rating DESC, title
    LIMIT ${FAVORITES_LIMIT}`)
  return titlesInOrder(rows).map(({ title }) => title)
}

/** Same number all day, different tomorrow: picks "random" memories that don't flicker. */
function dailyIndex(today: string, count: number): number {
  let hash = 0
  for (const character of today) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % count
}

interface MemoryRow {
  entryId: number
  titleId: number
  completedAt: string
  moodBefore: MoodKey | null
  moodBeforeScore: number | null
  moodAfter: MoodKey | null
  moodAfterScore: number | null
  excerpt: string | null
}

/**
 * A watch completed on this day in an earlier year, or else one older than 30 days.
 * Watches with a written reflection are preferred in both cases.
 */
function getMemory(today: string): WatchMemory | null {
  const database = getDatabase()
  const [year, month, day] = today.split('-').map(Number)
  const cutoff = getLocalDate(new Date(year, month - 1, day - MEMORY_MIN_AGE_DAYS))
  const pick = (
    condition: ReturnType<typeof sql>,
    kind: WatchMemory['kind']
  ): WatchMemory | null => {
    const rows = database.all<MemoryRow & { hasReflection: number }>(sql`
      SELECT id AS "entryId", title_id AS "titleId", completed_at AS "completedAt",
        mood_before AS "moodBefore", mood_before_score AS "moodBeforeScore",
        mood_after AS "moodAfter", mood_after_score AS "moodAfterScore",
        ${EXCERPT} AS "excerpt", ${HAS_REFLECTION} AS "hasReflection"
      FROM watch_entries
      WHERE completed_at IS NOT NULL AND ${condition}
      ORDER BY id`)
    const reflective = rows.filter((row) => row.hasReflection)
    const candidates = reflective.length ? reflective : rows
    if (candidates.length === 0) return null
    const [memory] = titlesInOrder([candidates[dailyIndex(today, candidates.length)]])
    if (!memory) return null
    return {
      entryId: memory.entryId,
      title: memory.title,
      completedAt: memory.completedAt,
      kind,
      moodBefore: memory.moodBefore,
      moodBeforeScore: memory.moodBeforeScore,
      moodAfter: memory.moodAfter,
      moodAfterScore: memory.moodAfterScore,
      excerpt: memory.excerpt
    }
  }
  return (
    pick(
      sql`substr(completed_at, 6, 5) = ${today.slice(5)} AND completed_at < ${today.slice(0, 4)}`,
      'on_this_day'
    ) ?? pick(sql`completed_at <= ${cutoff}`, 'memory')
  )
}

function getTimeline(): TimelineItem[] {
  const rows = getDatabase().all<{
    entryId: number
    titleId: number
    date: string
    completed: number
    moodBeforeScore: number | null
    moodAfterScore: number | null
    excerpt: string | null
  }>(sql`
    SELECT id AS "entryId", title_id AS "titleId",
      coalesce(completed_at, started_at) AS "date", completed_at IS NOT NULL AS "completed",
      mood_before_score AS "moodBeforeScore", mood_after_score AS "moodAfterScore",
      ${EXCERPT} AS "excerpt"
    FROM watch_entries
    ORDER BY coalesce(completed_at, started_at) DESC, id DESC
    LIMIT ${TIMELINE_LIMIT}`)
  return titlesInOrder(rows).map(({ title, ...row }) => ({
    entryId: row.entryId,
    date: row.date,
    completed: Boolean(row.completed),
    moodBeforeScore: row.moodBeforeScore,
    moodAfterScore: row.moodAfterScore,
    excerpt: row.excerpt,
    title: {
      id: title.id,
      title: title.title,
      type: title.type,
      posterFile: title.posterFile,
      genres: title.genres
    }
  }))
}

export function getDashboard(): DashboardData {
  const today = getLocalDate()
  const { count } = getDatabase().get<{ count: number }>(
    sql`SELECT count(*) AS "count" FROM titles`
  )
  const monthStart = periodStart('month', today) ?? today
  return {
    hasTitles: count > 0,
    newThisMonth: getNewTitlesSince(monthStart),
    ratingChangeThisMonth: getRatingChangeSince(monthStart),
    moodTrend: getMoodTrend(MOOD_TREND_LIMIT),
    recentlyWatched: getRecentlyWatched(),
    currentlyWatching: getCurrentlyWatching(),
    recentlyAdded: getRecentlyAdded(),
    favorites: getFavorites(),
    memory: getMemory(today),
    timeline: getTimeline()
  }
}
