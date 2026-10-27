import { sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { getLocalDate } from '../../shared/constants'
import type {
  GenreStat,
  Insights,
  InsightsPeriod,
  InsightsTotals,
  MonthlyWatches,
  MoodAverage,
  MoodGroup,
  MoodRanking,
  MoodTrendPoint,
  ReasonCount,
  DirectorStat,
  ReasonEffectiveness,
  ReasonMoodGroup,
  TitleMoodChange
} from '../../shared/types'

// Counting rules (see CLAUDE.md, M5a):
// - A "watch" is a completed watch entry (rewatches included), dated by completed_at.
// - In-progress series entries only add episodes and hours, dated by started_at.
// - Mood averages skip missing scores; mood change only uses entries with both scores.
// - All dates are local calendar dates (YYYY-MM-DD), so periods are plain string compares.

/** Any mood-based ranking needs at least this many entries. */
const MIN_MOOD_ENTRIES = 2

/** Reasons shown under "Most effective for", in display order. */
const EFFECTIVE_REASON_KEYS = [
  'stressed',
  'sad',
  'lonely',
  'needed_motivation',
  'needed_relaxation',
  'happy',
  'wanted_adrenaline'
] as const

const TOP_TITLES_LIMIT = 5
const EFFECTIVE_TITLES_LIMIT = 3

/** First day of the month `offset` months away from (year, month), as YYYY-MM-DD. */
function monthStart(year: number, month: number, offset = 0): string {
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function periodStart(period: InsightsPeriod, today: string): string | null {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  switch (period) {
    case 'month':
      return monthStart(year, month)
    case 'six_months':
      return monthStart(year, month, -5)
    case 'year':
      return `${year}-01-01`
    case 'all':
      return null
  }
}

/**
 * `done` = completed entries in the period, joined with their title.
 * `paired` = the subset with both mood scores, plus their mood change.
 */
function withEntries(from: string | null): SQL {
  return sql`WITH done AS (
      SELECT we.id, we.title_id, we.completed_at, we.episodes_watched,
        we.mood_before_score AS before_score, we.mood_after_score AS after_score,
        t.type, t.title, t.poster_file, t.runtime_minutes, t.rating
      FROM watch_entries we
      JOIN titles t ON t.id = we.title_id
      WHERE we.completed_at IS NOT NULL ${from ? sql`AND we.completed_at >= ${from}` : sql``}
    ),
    paired AS (
      SELECT *, after_score - before_score AS change
      FROM done
      WHERE before_score IS NOT NULL AND after_score IS NOT NULL
    )`
}

function getTotals(from: string | null): InsightsTotals {
  const database = getDatabase()
  const completed = database.get<{
    movies: number
    series: number
    watches: number
    movieMinutes: number
  }>(sql`${withEntries(from)}
    SELECT
      count(DISTINCT CASE WHEN type = 'movie' THEN title_id END) AS "movies",
      count(DISTINCT CASE WHEN type = 'series' THEN title_id END) AS "series",
      count(*) AS "watches",
      coalesce(sum(CASE WHEN type = 'movie' THEN runtime_minutes END), 0) AS "movieMinutes"
    FROM done`)

  // Series progress counts even while a run is still in progress.
  const seriesProgress = database.get<{ episodes: number; seriesMinutes: number }>(sql`
    SELECT
      coalesce(sum(we.episodes_watched), 0) AS "episodes",
      coalesce(sum(we.episodes_watched * coalesce(t.runtime_minutes, 0)), 0) AS "seriesMinutes"
    FROM watch_entries we
    JOIN titles t ON t.id = we.title_id
    WHERE t.type = 'series'
      ${from ? sql`AND coalesce(we.completed_at, we.started_at) >= ${from}` : sql``}`)

  const rating = database.get<{ average: number | null; n: number }>(sql`${withEntries(from)}
    SELECT avg(rating) AS "average", count(*) AS "n"
    FROM titles
    WHERE rating IS NOT NULL AND id IN (SELECT title_id FROM done)`)

  return {
    movies: completed.movies,
    series: completed.series,
    watches: completed.watches,
    episodes: seriesProgress.episodes,
    hours: (completed.movieMinutes + seriesProgress.seriesMinutes) / 60,
    averageRating: rating.average,
    ratedTitles: rating.n
  }
}

/** Completed watches per month for the last 12 months (including this one), zero-filled. */
function getWatchesPerMonth(today: string): MonthlyWatches[] {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const rows = getDatabase().all<MonthlyWatches>(sql`${withEntries(monthStart(year, month, -11))}
    SELECT
      substr(completed_at, 1, 7) AS "month",
      sum(type = 'movie') AS "movies",
      sum(type = 'series') AS "series"
    FROM done
    GROUP BY substr(completed_at, 1, 7)`)
  const byMonth = new Map(rows.map((row) => [row.month, row]))
  return Array.from({ length: 12 }, (_, index) => {
    const key = monthStart(year, month, index - 11).slice(0, 7)
    return byMonth.get(key) ?? { month: key, movies: 0, series: 0 }
  })
}

function getGenres(from: string | null): GenreStat[] {
  return getDatabase().all<GenreStat>(sql`${withEntries(from)},
    rated AS (
      SELECT tg.genre_id, avg(t.rating) AS average_rating, count(*) AS rated_titles
      FROM titles t
      JOIN title_genres tg ON tg.title_id = t.id
      WHERE t.rating IS NOT NULL AND t.id IN (SELECT title_id FROM done)
      GROUP BY tg.genre_id
    )
    SELECT
      g.name AS "genre",
      count(*) AS "watches",
      rated.average_rating AS "averageRating",
      coalesce(rated.rated_titles, 0) AS "ratedTitles"
    FROM done d
    JOIN title_genres tg ON tg.title_id = d.title_id
    JOIN genres g ON g.id = tg.genre_id
    LEFT JOIN rated ON rated.genre_id = g.id
    GROUP BY g.id
    ORDER BY count(*) DESC, g.name`)
}

function getMoodOverview(from: string | null): Insights['mood'] {
  const row = getDatabase().get<{
    beforeAverage: number | null
    beforeN: number
    afterAverage: number | null
    afterN: number
    changeAverage: number | null
    changeN: number
  }>(sql`${withEntries(from)}
    SELECT
      avg(before_score) AS "beforeAverage",
      count(before_score) AS "beforeN",
      avg(after_score) AS "afterAverage",
      count(after_score) AS "afterN",
      (SELECT avg(change) FROM paired) AS "changeAverage",
      (SELECT count(*) FROM paired) AS "changeN"
    FROM done`)
  const average = (value: number | null, n: number): MoodAverage => ({ average: value, n })
  return {
    before: average(row.beforeAverage, row.beforeN),
    after: average(row.afterAverage, row.afterN),
    change: average(row.changeAverage, row.changeN)
  }
}

function countPaired(from: string | null): number {
  return getDatabase().get<{ n: number }>(sql`${withEntries(from)}
    SELECT count(*) AS "n" FROM paired`).n
}

function getMoodByGenre(from: string | null): MoodRanking<MoodGroup> {
  const items = getDatabase().all<MoodGroup>(sql`${withEntries(from)}
    SELECT
      g.name AS "label",
      avg(p.before_score) AS "averageBefore",
      avg(p.after_score) AS "averageAfter",
      avg(p.change) AS "averageChange",
      count(*) AS "n"
    FROM paired p
    JOIN title_genres tg ON tg.title_id = p.title_id
    JOIN genres g ON g.id = tg.genre_id
    GROUP BY g.id
    HAVING count(*) >= ${MIN_MOOD_ENTRIES}
    ORDER BY avg(p.change) DESC, count(*) DESC, g.name`)
  return { items, n: countPaired(from), enoughData: items.length > 0 }
}

function getMoodByReason(from: string | null): MoodRanking<ReasonMoodGroup> {
  const rows = getDatabase().all<
    Omit<ReasonMoodGroup, 'isCustom'> & { isCustom: number }
  >(sql`${withEntries(from)}
    SELECT
      r.key AS "reasonKey",
      r.label AS "label",
      r.is_custom AS "isCustom",
      avg(p.before_score) AS "averageBefore",
      avg(p.after_score) AS "averageAfter",
      avg(p.change) AS "averageChange",
      count(*) AS "n"
    FROM paired p
    JOIN watch_entry_reasons wer ON wer.watch_entry_id = p.id
    JOIN reasons r ON r.id = wer.reason_id
    GROUP BY r.id
    HAVING count(*) >= ${MIN_MOOD_ENTRIES}
    ORDER BY avg(p.change) DESC, count(*) DESC, r.label`)
  const items = rows.map((row) => ({ ...row, isCustom: Boolean(row.isCustom) }))
  return { items, n: countPaired(from), enoughData: items.length > 0 }
}

/**
 * Titles ranked by average mood change. A single watch may appear (its n says so),
 * but the list as a whole needs MIN_MOOD_ENTRIES qualifying watches. Ties rank the
 * title with more watches higher.
 */
function rankTitles(
  from: string | null,
  reasonKey: string | null,
  limit: number
): MoodRanking<TitleMoodChange> {
  const database = getDatabase()
  const source = reasonKey
    ? sql`paired p
      JOIN watch_entry_reasons wer ON wer.watch_entry_id = p.id
      JOIN reasons r ON r.id = wer.reason_id AND r.key = ${reasonKey}`
    : sql`paired p`
  const items = database.all<TitleMoodChange>(sql`${withEntries(from)}
    SELECT
      p.title_id AS "titleId",
      p.title AS "title",
      p.type AS "type",
      p.poster_file AS "posterFile",
      avg(p.change) AS "averageChange",
      count(*) AS "n"
    FROM ${source}
    GROUP BY p.title_id
    ORDER BY avg(p.change) DESC, count(*) DESC, p.title
    LIMIT ${limit}`)
  const { n } = database.get<{ n: number }>(sql`${withEntries(from)}
    SELECT count(*) AS "n" FROM ${source}`)
  const enoughData = n >= MIN_MOOD_ENTRIES
  return { items: enoughData ? items : [], n, enoughData }
}

function getTopReasons(from: string | null): ReasonCount[] {
  const rows = getDatabase().all<
    Omit<ReasonCount, 'isCustom'> & { isCustom: number }
  >(sql`${withEntries(from)}
    SELECT
      r.key AS "reasonKey",
      r.label AS "label",
      r.is_custom AS "isCustom",
      count(*) AS "watches"
    FROM done d
    JOIN watch_entry_reasons wer ON wer.watch_entry_id = d.id
    JOIN reasons r ON r.id = wer.reason_id
    GROUP BY r.id
    ORDER BY count(*) DESC, r.label`)
  return rows.map((row) => ({ ...row, isCustom: Boolean(row.isCustom) }))
}

function getEffectiveFor(from: string | null): ReasonEffectiveness[] {
  const database = getDatabase()
  return EFFECTIVE_REASON_KEYS.flatMap((reasonKey) => {
    const reason = database.get<{ label: string } | undefined>(sql`
      SELECT label AS "label" FROM reasons WHERE key = ${reasonKey}`)
    if (!reason) return []
    const bestGenre = database.get<MoodGroup | undefined>(sql`${withEntries(from)}
      SELECT
        g.name AS "label",
        avg(p.before_score) AS "averageBefore",
        avg(p.after_score) AS "averageAfter",
        avg(p.change) AS "averageChange",
        count(*) AS "n"
      FROM paired p
      JOIN watch_entry_reasons wer ON wer.watch_entry_id = p.id
      JOIN reasons r ON r.id = wer.reason_id AND r.key = ${reasonKey}
      JOIN title_genres tg ON tg.title_id = p.title_id
      JOIN genres g ON g.id = tg.genre_id
      GROUP BY g.id
      HAVING count(*) >= ${MIN_MOOD_ENTRIES}
      ORDER BY avg(p.change) DESC, count(*) DESC, g.name
      LIMIT 1`)
    return [
      {
        reasonKey,
        label: reason.label,
        bestGenre: bestGenre ?? null,
        titles: rankTitles(from, reasonKey, EFFECTIVE_TITLES_LIMIT)
      }
    ]
  })
}

const TOP_DIRECTORS_LIMIT = 5

/** Directors of the movies watched in the period (series creators aren't counted). */
function getTopDirectors(from: string | null): Insights['topDirectors'] {
  const database = getDatabase()
  const items = database.all<DirectorStat>(sql`${withEntries(from)}
    SELECT c.name AS "name", count(*) AS "watches", count(DISTINCT d.title_id) AS "titles"
    FROM done d
    JOIN title_crew c ON c.title_id = d.title_id AND c.role = 'director'
    WHERE d.type = 'movie'
    GROUP BY c.name
    ORDER BY count(*) DESC, count(DISTINCT d.title_id) DESC, c.name
    LIMIT ${TOP_DIRECTORS_LIMIT}`)
  const { n } = database.get<{ n: number }>(sql`${withEntries(from)}
    SELECT count(*) AS "n" FROM done d
    WHERE d.type = 'movie'
      AND EXISTS (SELECT 1 FROM title_crew c WHERE c.title_id = d.title_id AND c.role = 'director')`)
  return { items, n }
}

/** The last `limit` completed watches with at least one mood score, oldest first. */
export function getMoodTrend(limit: number): MoodTrendPoint[] {
  const rows = getDatabase().all<MoodTrendPoint>(sql`${withEntries(null)}
    SELECT
      id AS "entryId",
      title AS "title",
      completed_at AS "date",
      before_score AS "before",
      after_score AS "after"
    FROM done
    WHERE before_score IS NOT NULL OR after_score IS NOT NULL
    ORDER BY completed_at DESC, id DESC
    LIMIT ${limit}`)
  return rows.reverse()
}

/** Titles whose first completed watch is on or after `from`: how much the totals grew. */
export function getNewTitlesSince(from: string): { movies: number; series: number } {
  return getDatabase().get<{ movies: number; series: number }>(sql`
    SELECT
      coalesce(sum(t.type = 'movie'), 0) AS "movies",
      coalesce(sum(t.type = 'series'), 0) AS "series"
    FROM titles t
    JOIN (
      SELECT title_id, min(completed_at) AS first_completed
      FROM watch_entries
      WHERE completed_at IS NOT NULL
      GROUP BY title_id
    ) first ON first.title_id = t.id
    WHERE first.first_completed >= ${from}`)
}

/** Average rating of titles with a completed watch, optionally only watches before `before`. */
function averageWatchedRating(before: string | null): number | null {
  return getDatabase().get<{ average: number | null }>(sql`
    SELECT avg(rating) AS "average"
    FROM titles
    WHERE rating IS NOT NULL AND id IN (
      SELECT title_id FROM watch_entries
      WHERE completed_at IS NOT NULL ${before ? sql`AND completed_at < ${before}` : sql``}
    )`).average
}

/** How much the overall average rating moved since `from`; null when either side is empty. */
export function getRatingChangeSince(from: string): number | null {
  const now = averageWatchedRating(null)
  const before = averageWatchedRating(from)
  return now === null || before === null ? null : now - before
}

export function getInsights(period: InsightsPeriod): Insights {
  const today = getLocalDate()
  const from = periodStart(period, today)
  const { count } = getDatabase().get<{ count: number }>(
    sql`SELECT count(*) AS "count" FROM watch_entries`
  )
  return {
    period,
    from,
    to: today,
    hasAnyWatches: count > 0,
    totals: getTotals(from),
    watchesPerMonth: getWatchesPerMonth(today),
    genres: getGenres(from),
    mood: getMoodOverview(from),
    moodByGenre: getMoodByGenre(from),
    moodByReason: getMoodByReason(from),
    topTitles: rankTitles(from, null, TOP_TITLES_LIMIT),
    topReasons: getTopReasons(from),
    effectiveFor: getEffectiveFor(from),
    topDirectors: getTopDirectors(from)
  }
}
