import { sql, type SQL } from 'drizzle-orm'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { lastPossibleDaySql } from '../db/watchDates'
import { getLocalDate } from '../../shared/constants'
import { listMoods, moodLabels } from './moods'
import { findPrompt, type DiscoverPrompt } from '../../shared/discoverPrompts'
import type { DatePrecision } from '../../shared/watchDate'
import { genreKey } from '../../shared/genres'
import type {
  DiscoverItem,
  DiscoverQuery,
  DiscoverResult,
  Recommendation,
  RecommendationOption,
  RecommendationQuery,
  RecommendationResult,
  Title
} from '../../shared/types'
import { getTitlesByIds } from './titles'
import { EXCERPT } from './watchEntries'

// Rule-based suggestions from my own history (no ML):
// - recommend(): Home's "What should I watch?" for one mood or reason.
// - discover(): the Discover page, for a prompt from src/shared/discoverPrompts.ts.
// Both use the same rule for "a similar situation": the mood before watching matches, OR the
// watch was tagged with a matching reason (default reasons like "Stressed" share their key
// with the mood). Mood changes only count from finished watches with both scores.

/** Same rule as Insights: a mood-based list needs this many matching watches. */
const MIN_MOOD_ENTRIES = 2
const RESULT_LIMIT = 4
const DISCOVER_GROUP_LIMIT = 6
/** "Haven't watched in a while": last finished at least this many months ago. */
const REVISIT_AFTER_MONTHS = 6
const REVISIT_MIN_RATING = 8

/** A finished watch with both mood scores. */
const SCORED = sql`we.completed_at IS NOT NULL
  AND we.mood_before_score IS NOT NULL AND we.mood_after_score IS NOT NULL`

/** Titles I'm watching right now (an open run on a title I haven't dropped). */
const WATCHING_NOW = sql`EXISTS (
    SELECT 1 FROM watch_entries open_entry
    JOIN titles open_title ON open_title.id = open_entry.title_id
    WHERE open_entry.title_id = we.title_id
      AND open_entry.completed_at IS NULL AND open_title.status != 'dropped'
  )`

/** Finished, scored watches on titles you're not watching right now (Home's list). */
const ELIGIBLE = sql`${SCORED} AND NOT ${WATCHING_NOW}`

function list(values: string[]): SQL {
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )
}

function hasReason(keys: string[]): SQL {
  return sql`EXISTS (
    SELECT 1 FROM watch_entry_reasons wer
    JOIN reasons r ON r.id = wer.reason_id
    WHERE wer.watch_entry_id = we.id AND r.key IN (${list(keys)})
  )`
}

/** "A similar situation": mood before in `moods`, or tagged with one of `reasons`. */
function matchesSituation(moods: string[], reasons: string[]): SQL {
  const parts: SQL[] = []
  if (moods.length) parts.push(sql`we.mood_before IN (${list(moods)})`)
  if (reasons.length) parts.push(hasReason(reasons))
  return parts.length ? sql`(${sql.join(parts, sql` OR `)})` : sql`0`
}

function matches(query: Pick<RecommendationQuery, 'mood' | 'reasonKey'>): SQL {
  if (query.mood) return matchesSituation([query.mood], [query.mood])
  return matchesSituation([], [query.reasonKey ?? ''])
}

/** Moods and reasons with enough matching watches to give suggestions. */
export function getRecommendationOptions(): RecommendationOption[] {
  const database = getDatabase()
  const count = (condition: SQL): number =>
    database.get<{ n: number }>(sql`
      SELECT count(*) AS "n" FROM watch_entries we WHERE ${ELIGIBLE} AND ${condition}`).n

  // Only moods and reasons you can still pick (hidden ones are left out of this picker).
  const allMoods = listMoods(database)
  const moodKeys = new Set(allMoods.map((mood) => mood.key))
  const moods = allMoods
    .filter((mood) => !mood.isHidden)
    .map((mood) => ({
      kind: 'mood' as const,
      key: mood.key,
      label: mood.label,
      emoji: mood.emoji,
      watches: count(matches({ mood: mood.key, reasonKey: null }))
    }))
  // Reasons that share a key with a mood are already covered by that mood.
  const reasons = database
    .all<{ key: string; label: string }>(
      sql`SELECT key AS "key", label AS "label" FROM reasons WHERE is_hidden = 0`
    )
    .filter((reason) => !moodKeys.has(reason.key))
    .map((reason) => ({
      kind: 'reason' as const,
      key: reason.key,
      label: reason.label,
      emoji: null,
      watches: count(matchesSituation([], [reason.key]))
    }))
  return [...moods, ...reasons]
    .filter((option) => option.watches >= MIN_MOOD_ENTRIES)
    .sort((a, b) => b.watches - a.watches || a.label.localeCompare(b.label))
}

/**
 * Titles that lifted your mood before, best average change first (ties: more watches first).
 * Each comes with its best matching watch for the "why" line.
 */
export function recommend(
  query: RecommendationQuery,
  database: CineDiaryDatabase = getDatabase()
): RecommendationResult {
  const where = sql`${ELIGIBLE} AND ${matches(query)}
    ${query.type === 'all' ? sql`` : sql`AND t.type = ${query.type}`}`

  const { n } = database.get<{ n: number }>(sql`
    SELECT count(*) AS "n"
    FROM watch_entries we JOIN titles t ON t.id = we.title_id
    WHERE ${where}`)
  if (n < MIN_MOOD_ENTRIES) return { items: [], n, enoughData: false }

  const rows = database.all<{ titleId: number; averageChange: number; n: number }>(sql`
    SELECT we.title_id AS "titleId",
      avg(we.mood_after_score - we.mood_before_score) AS "averageChange",
      count(*) AS "n"
    FROM watch_entries we JOIN titles t ON t.id = we.title_id
    WHERE ${where}
    GROUP BY we.title_id
    HAVING avg(we.mood_after_score - we.mood_before_score) > 0
    ORDER BY avg(we.mood_after_score - we.mood_before_score) DESC, count(*) DESC, t.title
    LIMIT ${RESULT_LIMIT}`)

  const titles = new Map(
    getTitlesByIds(
      rows.map((row) => row.titleId),
      database
    ).map((t) => [t.id, t])
  )
  const items = rows.flatMap((row): Recommendation[] => {
    const title = titles.get(row.titleId)
    const why = database.get<Recommendation['why'] | undefined>(sql`
      SELECT we.mood_before_score AS "before", we.mood_after_score AS "after",
        ${EXCERPT} AS "excerpt"
      FROM watch_entries we JOIN titles t ON t.id = we.title_id
      WHERE ${where} AND we.title_id = ${row.titleId}
      ORDER BY we.mood_after_score - we.mood_before_score DESC, we.completed_at DESC
      LIMIT 1`)
    return title && why ? [{ title, averageChange: row.averageChange, n: row.n, why }] : []
  })
  return { items, n, enoughData: true }
}

// --- Discover ---

/**
 * Titles that may be suggested at all: not dropped, not being watched right now, and within
 * the type and runtime filters. Unknown runtimes are kept here and split off afterwards.
 */
function candidateTitles(query: DiscoverQuery): SQL {
  return sql`t.status NOT IN ('dropped', 'watching', 'rewatching')
    AND NOT EXISTS (
      SELECT 1 FROM watch_entries open_entry
      WHERE open_entry.title_id = t.id AND open_entry.completed_at IS NULL
    )
    ${query.type === 'all' ? sql`` : sql`AND t.type = ${query.type}`}
    ${query.maxRuntime === null ? sql`` : sql`AND (t.runtime_minutes IS NULL OR t.runtime_minutes <= ${query.maxRuntime})`}`
}

interface BestWatch {
  moodBefore: string | null
  /** Null only for unscored watches (used by "Haven't watched in a while"). */
  before: number | null
  after: number | null
  note: string | null
  reasonKeys: string | null
}

/** How the best matching watch matched: "Felt sad" or the reason's label. */
function situationLabel(
  watch: BestWatch,
  prompt: DiscoverPrompt,
  reasonLabels: Map<string, string>,
  moodNames: Map<string, string>
): string {
  if (watch.moodBefore && (prompt.moods as string[]).includes(watch.moodBefore)) {
    return `Felt ${(moodNames.get(watch.moodBefore) ?? watch.moodBefore).toLowerCase()}`
  }
  const key = (watch.reasonKeys ?? '').split(',').find((reason) => prompt.reasons.includes(reason))
  return (key && reasonLabels.get(key)) ?? 'A similar moment'
}

function bestMatchingWatch(
  db: CineDiaryDatabase,
  titleId: number,
  situation: SQL,
  scored: boolean
): BestWatch | undefined {
  return db.get<BestWatch | undefined>(sql`
    SELECT we.mood_before AS "moodBefore", we.mood_before_score AS "before",
      we.mood_after_score AS "after", ${EXCERPT} AS "note",
      (SELECT group_concat(r.key) FROM watch_entry_reasons wer JOIN reasons r ON r.id = wer.reason_id
        WHERE wer.watch_entry_id = we.id) AS "reasonKeys"
    FROM watch_entries we
    WHERE we.title_id = ${titleId} AND we.completed_at IS NOT NULL AND ${situation}
      ${scored ? sql`AND ${SCORED}` : sql``}
    ORDER BY coalesce(we.mood_after_score - we.mood_before_score, -99) DESC, we.completed_at DESC
    LIMIT 1`)
}

/**
 * The Discover page's three groups for one prompt, in priority order (a title shows up once):
 * 1. Helped you before — titles that lifted my mood in similar situations.
 * 2. From your watchlist — planned titles in genres that lifted my mood then (history-proven
 *    genres first; the prompt's own genres as a clearly labeled fallback below them).
 * 3. Haven't watched in a while — favorites or 8+ titles not finished for 6+ months that fit.
 */
export function discoverIn(
  db: CineDiaryDatabase,
  query: DiscoverQuery,
  now = new Date()
): DiscoverResult {
  const prompt = findPrompt(query.prompt)
  const empty: DiscoverResult = {
    helped: {
      items: [],
      n: 0,
      enoughData: false,
      enoughWithoutFilters: false,
      hidden: !query.includeRewatches
    },
    watchlist: [],
    revisit: { items: [], hidden: !query.includeRewatches },
    hiddenUnknownRuntime: 0,
    hasMoodHistory: false
  }
  if (!prompt) return empty

  const situation = matchesSituation(prompt.moods, prompt.reasons)
  const candidates = candidateTitles(query)
  const reasonLabels = new Map(
    db
      .all<{ key: string; label: string }>(sql`SELECT key AS "key", label AS "label" FROM reasons`)
      .map((reason) => [reason.key, reason.label])
  )
  const moodNames = moodLabels(db)
  const hasMoodHistory =
    db.get<{ n: number }>(sql`SELECT count(*) AS "n" FROM watch_entries we WHERE ${SCORED}`).n > 0

  // 1. Helped you before (needs "include rewatches": these are titles I've seen).
  let helpedN = 0
  let helpedNWithoutFilters = 0
  let helpedRows: Array<{ titleId: number; averageChange: number; n: number }> = []
  if (query.includeRewatches) {
    const where = sql`${SCORED} AND ${situation} AND ${candidates}`
    helpedN = db.get<{ n: number }>(sql`
      SELECT count(*) AS "n" FROM watch_entries we JOIN titles t ON t.id = we.title_id WHERE ${where}`).n
    // Same count without the type and runtime filters, to tell "filtered out" from "no data".
    const unfiltered = candidateTitles({ ...query, type: 'all', maxRuntime: null })
    helpedNWithoutFilters = db.get<{ n: number }>(sql`
      SELECT count(*) AS "n" FROM watch_entries we JOIN titles t ON t.id = we.title_id
      WHERE ${SCORED} AND ${situation} AND ${unfiltered}`).n
    if (helpedN >= MIN_MOOD_ENTRIES) {
      helpedRows = db.all(sql`
        SELECT we.title_id AS "titleId",
          avg(we.mood_after_score - we.mood_before_score) AS "averageChange",
          count(*) AS "n"
        FROM watch_entries we JOIN titles t ON t.id = we.title_id
        WHERE ${where}
        GROUP BY we.title_id
        HAVING avg(we.mood_after_score - we.mood_before_score) > 0
        ORDER BY avg(we.mood_after_score - we.mood_before_score) DESC, count(*) DESC, t.title`)
    }
  }

  // 2. From your watchlist: genres that lifted my mood in similar situations (any title).
  const provenGenres = new Map(
    db
      .all<{ name: string; averageChange: number; n: number }>(
        sql`
        SELECT g.name AS "name", avg(we.mood_after_score - we.mood_before_score) AS "averageChange",
          count(*) AS "n"
        FROM watch_entries we
        JOIN title_genres tg ON tg.title_id = we.title_id
        JOIN genres g ON g.id = tg.genre_id
        WHERE ${SCORED} AND ${situation}
        GROUP BY g.id
        HAVING count(*) >= ${MIN_MOOD_ENTRIES} AND avg(we.mood_after_score - we.mood_before_score) > 0`
      )
      .map((genre) => [genreKey(genre.name), genre])
  )
  const promptGenres = prompt.genres.map(genreKey)
  const plannedIds = db
    .all<{ id: number }>(
      sql`
      SELECT t.id AS "id" FROM titles t
      WHERE t.status = 'planned' AND ${candidates}
        ${query.includeRewatches ? sql`` : sql`AND NOT EXISTS (SELECT 1 FROM watch_entries w WHERE w.title_id = t.id AND w.completed_at IS NOT NULL)`}
      ORDER BY t.title`
    )
    .map((row) => row.id)

  // 3. Haven't watched in a while.
  const sixMonthsAgo = getLocalDate(
    new Date(now.getFullYear(), now.getMonth() - REVISIT_AFTER_MONTHS, now.getDate())
  )
  // Only remembered dates count: every known watch must have ended 6+ months ago (a month or
  // year date by its last day). A title watched only on dates you don't remember is never "a
  // while ago". With max(), SQLite takes date_precision from the latest watch.
  const revisitRows = query.includeRewatches
    ? db.all<{
        id: number
        lastWatched: string
        lastWatchedPrecision: DatePrecision
        matchedBefore: number
      }>(sql`
        SELECT t.id AS "id", max(w.completed_at) AS "lastWatched",
          w.date_precision AS "lastWatchedPrecision",
          EXISTS (SELECT 1 FROM watch_entries we WHERE we.title_id = t.id
            AND we.completed_at IS NOT NULL AND ${situation}) AS "matchedBefore"
        FROM titles t JOIN watch_entries w ON w.title_id = t.id
          AND w.completed_at IS NOT NULL AND w.date_precision != 'unknown'
        WHERE (t.is_favorite = 1 OR t.rating >= ${REVISIT_MIN_RATING}) AND ${candidates}
        GROUP BY t.id
        HAVING max(${lastPossibleDaySql(sql`w.completed_at`, sql`w.date_precision`, getLocalDate(now))})
          < ${sixMonthsAgo}`)
    : []

  const allIds = [
    ...new Set([
      ...helpedRows.map((row) => row.titleId),
      ...plannedIds,
      ...revisitRows.map((row) => row.id)
    ])
  ]
  const titles = new Map(getTitlesByIds(allIds, db).map((title) => [title.id, title]))
  const used = new Set<number>()
  let hiddenUnknownRuntime = 0

  /** Keeps a title once, applying the unknown-runtime rule and the group limit. */
  const take = (items: DiscoverItem[]): DiscoverItem[] => {
    const kept: DiscoverItem[] = []
    for (const item of items) {
      if (used.has(item.title.id)) continue
      used.add(item.title.id)
      if (
        query.maxRuntime !== null &&
        item.title.runtimeMinutes === null &&
        !query.includeUnknownRuntime
      ) {
        hiddenUnknownRuntime++
        continue
      }
      if (kept.length < DISCOVER_GROUP_LIMIT) kept.push(item)
    }
    return kept
  }

  const helped = take(
    helpedRows.flatMap((row): DiscoverItem[] => {
      const title = titles.get(row.titleId)
      const watch = bestMatchingWatch(db, row.titleId, situation, true)
      if (!title || !watch || watch.before === null || watch.after === null) return []
      return [
        {
          title,
          why: {
            kind: 'history',
            label: situationLabel(watch, prompt, reasonLabels, moodNames),
            before: watch.before,
            after: watch.after,
            averageChange: row.averageChange,
            n: row.n,
            note: watch.note
          }
        }
      ]
    })
  )

  /** A planned title's best history-proven genre, else a prompt genre (labeled fallback). */
  const genreMatch = (title: Title): { item: DiscoverItem; rank: number[] } | null => {
    let best: { name: string; averageChange: number; n: number } | null = null
    for (const name of title.genres) {
      const stat = provenGenres.get(genreKey(name))
      if (
        stat &&
        (!best ||
          stat.averageChange > best.averageChange ||
          (stat.averageChange === best.averageChange && stat.n > best.n))
      ) {
        best = { name, averageChange: stat.averageChange, n: stat.n }
      }
    }
    if (best) {
      return {
        item: {
          title,
          why: { kind: 'genre', genre: best.name, averageChange: best.averageChange, n: best.n }
        },
        rank: [0, -best.averageChange, -best.n]
      }
    }
    const fallback = title.genres.find((name) => promptGenres.includes(genreKey(name)))
    if (!fallback) return null
    return {
      item: { title, why: { kind: 'genreFallback', genre: fallback } },
      // Always below history-proven genres; among fallbacks, the prompt's genre order.
      rank: [1, promptGenres.indexOf(genreKey(fallback)), 0]
    }
  }
  const watchlistCandidates = plannedIds
    .flatMap((id) => {
      const title = titles.get(id)
      const match = title ? genreMatch(title) : null
      return match ? [match] : []
    })
    .sort(
      (a, b) =>
        a.rank[0] - b.rank[0] ||
        a.rank[1] - b.rank[1] ||
        a.rank[2] - b.rank[2] ||
        a.item.title.title.localeCompare(b.item.title.title)
    )
    .map((match) => match.item)
  const watchlist = take(watchlistCandidates)

  const revisit = take(
    revisitRows
      .flatMap((row): DiscoverItem[] => {
        const title = titles.get(row.id)
        if (!title) return []
        const genre = title.genres.find((name) => promptGenres.includes(genreKey(name))) ?? null
        if (!genre && !row.matchedBefore) return [] // doesn't fit this prompt
        const watch = row.matchedBefore
          ? bestMatchingWatch(db, row.id, situation, false)
          : undefined
        return [
          {
            title,
            why: {
              kind: 'revisit',
              favorite: title.isFavorite,
              rating: title.rating,
              lastWatched: row.lastWatched,
              lastWatchedPrecision: row.lastWatchedPrecision,
              genre,
              history:
                watch && watch.before !== null && watch.after !== null
                  ? {
                      label: situationLabel(watch, prompt, reasonLabels, moodNames),
                      before: watch.before,
                      after: watch.after,
                      note: watch.note
                    }
                  : null
            }
          }
        ]
      })
      // Favorites first, then higher ratings, then the ones I haven't seen for longest.
      .sort(
        (a, b) =>
          Number(b.title.isFavorite) - Number(a.title.isFavorite) ||
          (b.title.rating ?? 0) - (a.title.rating ?? 0) ||
          (a.why.kind === 'revisit' && b.why.kind === 'revisit'
            ? a.why.lastWatched.localeCompare(b.why.lastWatched)
            : 0)
      )
  )

  return {
    helped: {
      items: helped,
      n: helpedN,
      enoughData: helpedN >= MIN_MOOD_ENTRIES,
      enoughWithoutFilters: helpedNWithoutFilters >= MIN_MOOD_ENTRIES,
      hidden: !query.includeRewatches
    },
    watchlist,
    revisit: { items: revisit, hidden: !query.includeRewatches },
    hiddenUnknownRuntime,
    hasMoodHistory
  }
}

export function discover(query: DiscoverQuery): DiscoverResult {
  return discoverIn(getDatabase(), query)
}
