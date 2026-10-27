import { sql, type SQL } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { MOODS } from '../../shared/constants'
import type {
  Recommendation,
  RecommendationOption,
  RecommendationQuery,
  RecommendationResult
} from '../../shared/types'
import { getTitlesByIds } from './titles'
import { EXCERPT } from './watchEntries'

// "What should I watch?": rule-based, only from your own history (used by Home, later Discover).
// A watch matches a mood when you started it in that mood OR tagged the reason with the same key
// (default reasons like "Stressed" share their key with the mood). Only completed watches with
// both mood scores count, and titles you're currently watching are left out.

/** Same rule as Insights: a mood-based list needs this many matching watches. */
const MIN_MOOD_ENTRIES = 2
const RESULT_LIMIT = 4

const MOOD_KEYS = new Set<string>(MOODS.map((mood) => mood.key))

/** Completed watches with both scores, on titles you're not watching right now. */
const ELIGIBLE = sql`
  we.completed_at IS NOT NULL
  AND we.mood_before_score IS NOT NULL AND we.mood_after_score IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM watch_entries open_entry
    JOIN titles open_title ON open_title.id = open_entry.title_id
    WHERE open_entry.title_id = we.title_id
      AND open_entry.completed_at IS NULL AND open_title.status != 'dropped'
  )`

function hasReason(key: string): SQL {
  return sql`EXISTS (
    SELECT 1 FROM watch_entry_reasons wer
    JOIN reasons r ON r.id = wer.reason_id
    WHERE wer.watch_entry_id = we.id AND r.key = ${key}
  )`
}

function matches(query: Pick<RecommendationQuery, 'mood' | 'reasonKey'>): SQL {
  if (query.mood) return sql`(we.mood_before = ${query.mood} OR ${hasReason(query.mood)})`
  return hasReason(query.reasonKey ?? '')
}

/** Moods and reasons with enough matching watches to give suggestions. */
export function getRecommendationOptions(): RecommendationOption[] {
  const database = getDatabase()
  const count = (condition: SQL): number =>
    database.get<{ n: number }>(sql`
      SELECT count(*) AS "n" FROM watch_entries we WHERE ${ELIGIBLE} AND ${condition}`).n

  const moods = MOODS.map((mood) => ({
    kind: 'mood' as const,
    key: mood.key,
    label: mood.label,
    emoji: mood.emoji,
    watches: count(matches({ mood: mood.key, reasonKey: null }))
  }))
  // Reasons that share a key with a mood are already covered by that mood.
  const reasons = database
    .all<{ key: string; label: string }>(sql`SELECT key AS "key", label AS "label" FROM reasons`)
    .filter((reason) => !MOOD_KEYS.has(reason.key))
    .map((reason) => ({
      kind: 'reason' as const,
      key: reason.key,
      label: reason.label,
      emoji: null,
      watches: count(hasReason(reason.key))
    }))
  return [...moods, ...reasons]
    .filter((option) => option.watches >= MIN_MOOD_ENTRIES)
    .sort((a, b) => b.watches - a.watches || a.label.localeCompare(b.label))
}

/**
 * Titles that lifted your mood before, best average change first (ties: more watches first).
 * Each comes with its best matching watch for the "why" line.
 */
export function recommend(query: RecommendationQuery): RecommendationResult {
  const database = getDatabase()
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

  const titles = new Map(getTitlesByIds(rows.map((row) => row.titleId)).map((t) => [t.id, t]))
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
