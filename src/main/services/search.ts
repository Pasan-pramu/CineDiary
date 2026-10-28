import { sql } from 'drizzle-orm'
import { getDatabase, type CineDiaryDatabase } from '../db/client'
import { containsPattern, escapeLike } from '../db/like'
import { titles } from '../db/schema'
import type { ChapterColor } from '../../shared/timeline'
import type {
  GlobalSearchResult,
  SearchChapterHit,
  SearchJournalHit,
  SearchTitleHit
} from '../../shared/types'
import { titleMatches } from './titles'

// The top-bar search: titles, journal text and life chapters, a few of each.
// Titles use the same condition as the Collection search, journal hits the same fields
// as the Journal's own search, so "See all" shows what the dropdown counted.

export const SEARCH_GROUP_LIMIT = 5
export const SEARCH_MIN_LENGTH = 2
const SNIPPET_RADIUS = 50

const EMPTY = { items: [], total: 0 }

/** A short excerpt of `text` around the first match, with … where it was cut. */
export function snippetAround(text: string, query: string, radius = SNIPPET_RADIUS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const index = clean.toLowerCase().indexOf(query.toLowerCase())
  if (index < 0 || clean.length <= radius * 2) return clean.slice(0, radius * 2)
  const start = Math.max(0, index - radius)
  const end = Math.min(clean.length, index + query.length + radius)
  return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`
}

function searchTitles(query: string, db: CineDiaryDatabase): GlobalSearchResult['titles'] {
  const pattern = containsPattern(query)
  const where = titleMatches(query)
  // Why a title matched, when it wasn't by its own title (the first reason that applies).
  const match = sql`coalesce(
      CASE WHEN ${titles.title} LIKE ${pattern} ESCAPE '\\' THEN '' END,
      'Original title: ' || CASE WHEN ${titles.originalTitle} LIKE ${pattern} ESCAPE '\\'
        THEN ${titles.originalTitle} END,
      'Genre: ' || (SELECT g.name FROM title_genres tg JOIN genres g ON g.id = tg.genre_id
        WHERE tg.title_id = ${titles.id} AND g.name LIKE ${pattern} ESCAPE '\\'
        ORDER BY g.name LIMIT 1),
      'Cast: ' || (SELECT c.name FROM title_cast c
        WHERE c.title_id = ${titles.id} AND c.name LIKE ${pattern} ESCAPE '\\'
        ORDER BY c."order" LIMIT 1),
      (SELECT CASE c.role WHEN 'director' THEN 'Director: ' ELSE 'Creator: ' END || c.name
        FROM title_crew c
        WHERE c.title_id = ${titles.id} AND c.name LIKE ${pattern} ESCAPE '\\'
        ORDER BY c."order" LIMIT 1)
    )`
  const rows = db.all<Omit<SearchTitleHit, 'match'> & { match: string | null }>(sql`
    SELECT ${titles.id} AS "id", ${titles.title} AS "title", ${titles.type} AS "type",
      ${titles.year} AS "year", ${titles.posterFile} AS "posterFile", ${match} AS "match"
    FROM ${titles}
    WHERE ${where}
    ORDER BY lower(${titles.title}) = lower(${query}) DESC,
      ${titles.title} LIKE ${`${escapeLike(query)}%`} ESCAPE '\\' DESC,
      ${titles.title} COLLATE NOCASE, ${titles.id}
    LIMIT ${SEARCH_GROUP_LIMIT}`)
  const { total } = db.get<{ total: number }>(sql`
    SELECT count(*) AS "total" FROM ${titles} WHERE ${where}`)
  return { items: rows.map((row) => ({ ...row, match: row.match || null })), total }
}

/** Journal text, in the order we quote it elsewhere: thoughts, lessons, quote, why I watched. */
const JOURNAL_FIELDS = [
  ['thoughts', 'Thoughts'],
  ['lessons', 'Lessons'],
  ['favorite_quote', 'Quote'],
  ['reason_note', 'Why I watched']
] as const

function searchJournal(query: string, db: CineDiaryDatabase): GlobalSearchResult['journal'] {
  const pattern = containsPattern(query)
  const where = sql.join(
    JOURNAL_FIELDS.map(([column]) => sql`we.${sql.raw(column)} LIKE ${pattern} ESCAPE '\\'`),
    sql` OR `
  )
  const rows = db.all<{
    entryId: number
    titleId: number
    title: string
    posterFile: string | null
    date: string
    thoughts: string | null
    lessons: string | null
    favorite_quote: string | null
    reason_note: string | null
  }>(sql`
    SELECT we.id AS "entryId", t.id AS "titleId", t.title AS "title", t.poster_file AS "posterFile",
      coalesce(we.completed_at, we.started_at) AS "date",
      we.thoughts, we.lessons, we.favorite_quote, we.reason_note
    FROM watch_entries we JOIN titles t ON t.id = we.title_id
    WHERE ${where}
    ORDER BY coalesce(we.completed_at, we.started_at) DESC, we.id DESC
    LIMIT ${SEARCH_GROUP_LIMIT}`)
  const { total } = db.get<{ total: number }>(sql`
    SELECT count(*) AS "total" FROM watch_entries we WHERE ${where}`)
  const items: SearchJournalHit[] = rows.map((row) => {
    const lower = query.toLowerCase()
    const [column, field] =
      JOURNAL_FIELDS.find(([key]) => row[key]?.toLowerCase().includes(lower)) ?? JOURNAL_FIELDS[0]
    return {
      entryId: row.entryId,
      titleId: row.titleId,
      title: row.title,
      posterFile: row.posterFile,
      date: row.date,
      field,
      snippet: snippetAround(row[column] ?? '', query)
    }
  })
  return { items, total }
}

function searchChapters(query: string, db: CineDiaryDatabase): GlobalSearchResult['chapters'] {
  const pattern = containsPattern(query)
  const where = sql`(name LIKE ${pattern} ESCAPE '\\' OR note LIKE ${pattern} ESCAPE '\\')`
  const rows = db.all<
    Omit<SearchChapterHit, 'snippet' | 'color'> & { color: string; note: string | null }
  >(sql`
    SELECT id AS "id", name AS "name", start_date AS "startDate", end_date AS "endDate",
      color AS "color", note AS "note"
    FROM life_periods WHERE ${where}
    ORDER BY start_date DESC, id DESC
    LIMIT ${SEARCH_GROUP_LIMIT}`)
  const { total } = db.get<{ total: number }>(sql`
    SELECT count(*) AS "total" FROM life_periods WHERE ${where}`)
  const items: SearchChapterHit[] = rows.map(({ note, color, ...row }) => ({
    ...row,
    color: color as ChapterColor,
    snippet:
      note && !row.name.toLowerCase().includes(query.toLowerCase())
        ? snippetAround(note, query)
        : null
  }))
  return { items, total }
}

/** Everything that matches `text` (2+ characters after trimming), grouped. */
export function globalSearch(
  text: string,
  db: CineDiaryDatabase = getDatabase()
): GlobalSearchResult {
  const query = text.trim()
  if (query.length < SEARCH_MIN_LENGTH) {
    return { query: '', titles: EMPTY, journal: EMPTY, chapters: EMPTY }
  }
  return {
    query,
    titles: searchTitles(query, db),
    journal: searchJournal(query, db),
    chapters: searchChapters(query, db)
  }
}
