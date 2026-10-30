import type Database from 'better-sqlite3'
import { APP_NAME } from '../../shared/app'
import type { DatePrecision } from '../../shared/watchDate'

// Readable exports of my diary: JSON (everything, documented) and CSV (watch entries, for
// spreadsheets). Images, the TMDB token and TMDB snapshots are never included.

const README = {
  about: `${APP_NAME} export: everything I logged. Dates are local calendar dates (YYYY-MM-DD); timestamps are ISO 8601 (UTC). Images, the TMDB token and internal sync data are not included.`,
  titles:
    'One entry per movie or series. status: planned | watching | completed | dropped | rewatching. rating: my 1–10 rating. runtimeMinutes is the episode runtime for series. tmdbId/imdbId link to The Movie Database / IMDb when known. cast, directors and creators come from TMDB.',
  watches:
    'Each time I watched a title (rewatches are separate). Scores are 1–10; moodChange = moodAfterScore − moodBeforeScore (null when a score is missing). moodBefore/moodAfter are keys, with readable labels in moodBeforeLabel/moodAfterLabel. reasons are the labels I picked; reflections are thoughts, lessons, favoriteCharacter, favoriteScene and favoriteQuote.',
  genres: 'Every genre in my collection.',
  moods:
    'Every mood I can pick before and after a watch, in my order. moodBefore/moodAfter on a watch use these keys. isCustom marks ones I created; isHidden ones are no longer offered when logging but still appear on old watches.',
  reasons:
    'Every reason I can pick when logging a watch, in my order; isCustom marks ones I created, isHidden ones are no longer offered when logging.',
  highlights: 'isHighlight on a watch marks a moment I highlighted on my timeline.',
  lifePeriods:
    'Life chapters on my timeline (e.g. "Final year at university"). startDate/endDate are YYYY-MM-DD; endDate null = ongoing. Chapters may overlap. color is a theme color name (violet, blue, green, amber, rose, teal).'
}

interface TitleRow {
  id: number
  type: 'movie' | 'series'
  title: string
  original_title: string | null
  year: number | null
  overview: string | null
  country: string | null
  language: string | null
  runtime_minutes: number | null
  total_seasons: number | null
  total_episodes: number | null
  status: string
  rating: number | null
  is_favorite: number
  tmdb_id: number | null
  imdb_id: string | null
  created_at: string
  updated_at: string
}

interface WatchRow {
  id: number
  title_id: number
  started_at: string
  completed_at: string | null
  date_precision: DatePrecision
  is_rewatch: number
  episodes_watched: number
  mood_before: string | null
  mood_before_score: number | null
  reason_note: string | null
  mood_after: string | null
  mood_after_score: number | null
  thoughts: string | null
  lessons: string | null
  favorite_character: string | null
  favorite_scene: string | null
  favorite_quote: string | null
  would_rewatch: number | null
  would_recommend: number | null
  notes: string | null
  is_highlight: number
  created_at: string
  updated_at: string
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row])
  return groups
}

function optionalBoolean(value: number | null): boolean | null {
  return value === null ? null : value === 1
}

function moodChange(row: WatchRow): number | null {
  return row.mood_before_score !== null && row.mood_after_score !== null
    ? row.mood_after_score - row.mood_before_score
    : null
}

function readAll(db: Database.Database): {
  titles: TitleRow[]
  watches: WatchRow[]
  genresByTitle: Map<number, string[]>
  reasonsByWatch: Map<number, string[]>
  castByTitle: Map<number, Array<{ name: string; character: string | null }>>
  crewByTitle: Map<number, Array<{ name: string; role: string }>>
  moodLabels: Map<string, string>
} {
  const titles = db
    .prepare('SELECT * FROM titles ORDER BY title COLLATE NOCASE, id')
    .all() as TitleRow[]
  const watches = db
    // Oldest first; watches with no remembered date go last, not first.
    .prepare(
      "SELECT * FROM watch_entries ORDER BY date_precision = 'unknown', coalesce(completed_at, started_at), id"
    )
    .all() as WatchRow[]
  const genreRows = db
    .prepare(
      'SELECT tg.title_id AS titleId, g.name AS name FROM title_genres tg JOIN genres g ON g.id = tg.genre_id ORDER BY g.name'
    )
    .all() as Array<{ titleId: number; name: string }>
  const reasonRows = db
    .prepare(
      'SELECT wer.watch_entry_id AS watchId, r.label AS label FROM watch_entry_reasons wer JOIN reasons r ON r.id = wer.reason_id ORDER BY r.label'
    )
    .all() as Array<{ watchId: number; label: string }>
  const castRows = db
    .prepare('SELECT title_id AS titleId, name, character FROM title_cast ORDER BY "order"')
    .all() as Array<{ titleId: number; name: string; character: string | null }>
  const crewRows = db
    .prepare('SELECT title_id AS titleId, name, role FROM title_crew ORDER BY "order"')
    .all() as Array<{ titleId: number; name: string; role: string }>
  const moodRows = db.prepare('SELECT key, label FROM moods').all() as Array<{
    key: string
    label: string
  }>
  const names = <T extends { name: string }>(rows: T[] | undefined): string[] =>
    (rows ?? []).map((row) => row.name)
  return {
    titles,
    watches,
    moodLabels: new Map(moodRows.map((row) => [row.key, row.label])),
    genresByTitle: new Map(
      [...groupBy(genreRows, (row) => row.titleId)].map(([id, rows]) => [id, names(rows)])
    ),
    reasonsByWatch: new Map(
      [...groupBy(reasonRows, (row) => row.watchId)].map(([id, rows]) => [
        id,
        rows.map((row) => row.label)
      ])
    ),
    castByTitle: new Map(
      [...groupBy(castRows, (row) => row.titleId)].map(([id, rows]) => [
        id,
        rows.map(({ name, character }) => ({ name, character }))
      ])
    ),
    crewByTitle: new Map(
      [...groupBy(crewRows, (row) => row.titleId)].map(([id, rows]) => [
        id,
        rows.map(({ name, role }) => ({ name, role }))
      ])
    )
  }
}

/** The full diary as a documented JSON object. */
export function buildJsonExport(
  db: Database.Database,
  appVersion: string,
  now = new Date()
): unknown {
  const data = readAll(db)
  const watchesByTitle = groupBy(data.watches, (row) => row.title_id)
  return {
    _readme: README,
    format: 'cinediary-export',
    formatVersion: 1,
    appVersion,
    exportedAt: now.toISOString(),
    titles: data.titles.map((title) => {
      const crew = data.crewByTitle.get(title.id) ?? []
      return {
        id: title.id,
        type: title.type,
        title: title.title,
        originalTitle: title.original_title,
        year: title.year,
        overview: title.overview,
        country: title.country,
        language: title.language,
        runtimeMinutes: title.runtime_minutes,
        totalSeasons: title.total_seasons,
        totalEpisodes: title.total_episodes,
        status: title.status,
        rating: title.rating,
        isFavorite: title.is_favorite === 1,
        genres: data.genresByTitle.get(title.id) ?? [],
        tmdbId: title.tmdb_id,
        imdbId: title.imdb_id,
        cast: data.castByTitle.get(title.id) ?? [],
        directors: crew.filter((member) => member.role === 'director').map((member) => member.name),
        creators: crew.filter((member) => member.role === 'creator').map((member) => member.name),
        createdAt: title.created_at,
        updatedAt: title.updated_at,
        watches: (watchesByTitle.get(title.id) ?? []).map((watch) => ({
          startedAt: exportedDate(watch.started_at, watch.date_precision),
          completedAt: exportedDate(watch.completed_at, watch.date_precision),
          datePrecision: watch.date_precision,
          isRewatch: watch.is_rewatch === 1,
          episodesWatched: watch.episodes_watched,
          moodBefore: watch.mood_before,
          moodBeforeLabel: watch.mood_before
            ? (data.moodLabels.get(watch.mood_before) ?? null)
            : null,
          moodBeforeScore: watch.mood_before_score,
          moodAfter: watch.mood_after,
          moodAfterLabel: watch.mood_after ? (data.moodLabels.get(watch.mood_after) ?? null) : null,
          moodAfterScore: watch.mood_after_score,
          moodChange: moodChange(watch),
          reasons: data.reasonsByWatch.get(watch.id) ?? [],
          reasonNote: watch.reason_note,
          thoughts: watch.thoughts,
          lessons: watch.lessons,
          favoriteCharacter: watch.favorite_character,
          favoriteScene: watch.favorite_scene,
          favoriteQuote: watch.favorite_quote,
          wouldRewatch: optionalBoolean(watch.would_rewatch),
          wouldRecommend: optionalBoolean(watch.would_recommend),
          notes: watch.notes,
          isHighlight: watch.is_highlight === 1,
          createdAt: watch.created_at,
          updatedAt: watch.updated_at
        }))
      }
    }),
    genres: (
      db.prepare('SELECT name FROM genres ORDER BY name').all() as Array<{ name: string }>
    ).map((row) => row.name),
    moods: (
      db
        .prepare(
          'SELECT key, label, emoji, is_custom AS isCustom, is_hidden AS isHidden FROM moods ORDER BY sort_order, id'
        )
        .all() as Array<{
        key: string
        label: string
        emoji: string
        isCustom: number
        isHidden: number
      }>
    ).map((mood) => ({ ...mood, isCustom: mood.isCustom === 1, isHidden: mood.isHidden === 1 })),
    reasons: (
      db
        .prepare(
          'SELECT key, label, is_custom AS isCustom, is_hidden AS isHidden FROM reasons ORDER BY sort_order, id'
        )
        .all() as Array<{
        key: string
        label: string
        isCustom: number
        isHidden: number
      }>
    ).map((reason) => ({
      ...reason,
      isCustom: reason.isCustom === 1,
      isHidden: reason.isHidden === 1
    })),
    lifePeriods: db
      .prepare(
        'SELECT name, start_date AS startDate, end_date AS endDate, color, note FROM life_periods ORDER BY start_date, id'
      )
      .all()
  }
}

/**
 * One CSV cell: quoted when needed, and with a leading ' when it would start a formula in
 * Excel (=, +, -, @, tab, carriage return), so a note can never run as a formula.
 */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null) return ''
  let text = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Byte-order mark: tells Excel the file is UTF-8. */
const BOM = String.fromCharCode(0xfeff)

/**
 * A watch date as far as it's known: 2019-10-14, 2019-10, 2019, or null when not remembered
 * (the stored placeholder never leaves the app). `date_precision` says which.
 */
export function exportedDate(date: string | null, precision: DatePrecision): string | null {
  if (date === null) return null
  switch (precision) {
    case 'day':
      return date
    case 'month':
      return date.slice(0, 7)
    case 'year':
      return date.slice(0, 4)
    case 'unknown':
      return null
  }
}

const CSV_COLUMNS = [
  'Title',
  'Type',
  'Year',
  'Started',
  'Completed',
  'Date precision',
  'Rewatch',
  'Episodes watched',
  'Mood before',
  'Mood before score',
  'Mood after',
  'Mood after score',
  'Mood change',
  'Reasons',
  'Why I watched',
  'Thoughts',
  'Lessons',
  'Favorite character',
  'Favorite scene',
  'Favorite quote',
  'Notes',
  'Highlight',
  'My rating'
]

/** Watch entries as CSV: UTF-8 with BOM and CRLF line endings, so Excel opens it correctly. */
export function buildWatchesCsv(db: Database.Database): string {
  const data = readAll(db)
  const titles = new Map(data.titles.map((title) => [title.id, title]))
  const lines = [CSV_COLUMNS.map(csvCell).join(',')]
  for (const watch of data.watches) {
    const title = titles.get(watch.title_id)
    if (!title) continue
    lines.push(
      [
        title.title,
        title.type === 'series' ? 'Series' : 'Movie',
        title.year,
        exportedDate(watch.started_at, watch.date_precision),
        exportedDate(watch.completed_at, watch.date_precision),
        watch.date_precision,
        watch.is_rewatch === 1,
        title.type === 'series' ? watch.episodes_watched : null,
        watch.mood_before ? (data.moodLabels.get(watch.mood_before) ?? watch.mood_before) : null,
        watch.mood_before_score,
        watch.mood_after ? (data.moodLabels.get(watch.mood_after) ?? watch.mood_after) : null,
        watch.mood_after_score,
        moodChange(watch),
        (data.reasonsByWatch.get(watch.id) ?? []).join('; ') || null,
        watch.reason_note,
        watch.thoughts,
        watch.lessons,
        watch.favorite_character,
        watch.favorite_scene,
        watch.favorite_quote,
        watch.notes,
        watch.is_highlight === 1,
        title.rating
      ]
        .map(csvCell)
        .join(',')
    )
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}
