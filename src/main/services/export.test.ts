import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildJsonExport, buildWatchesCsv, csvCell } from './export'
import { runMigrations } from '../db/migrate'

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
let db: Database.Database

afterEach(() => db?.close())

/** An in-memory diary with one TMDB movie, a watch with reflections, and secrets to leave out. */
function sampleDb(): Database.Database {
  db = new Database(':memory:')
  runMigrations(db, drizzle(db), MIGRATIONS)
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare(
    `INSERT INTO titles (id, type, title, year, status, rating, is_favorite, tmdb_id, tmdb_snapshot,
      poster_file, created_at, updated_at)
     VALUES (1, 'movie', 'Interstellar', 2014, 'completed', 10, 1, 157336, '{"title":"secret"}',
      '1.jpg', ?, ?)`
  ).run(now, now)
  db.prepare("INSERT INTO genres (id, name) VALUES (1, 'Sci-Fi')").run()
  db.prepare('INSERT INTO title_genres VALUES (1, 1)').run()
  db.prepare(
    `INSERT INTO title_cast (title_id, name, character, "order") VALUES (1, 'Matthew McConaughey', 'Cooper', 0)`
  ).run()
  db.prepare(
    `INSERT INTO title_crew (title_id, name, role, "order") VALUES (1, 'Christopher Nolan', 'director', 0)`
  ).run()
  db.prepare(
    `INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before, mood_before_score,
      mood_after, mood_after_score, thoughts, favorite_quote, notes, created_at, updated_at)
     VALUES (1, 1, '2026-01-01', '2026-01-02', 'stressed', 3, 'happy', 8,
      'Made me feel "hopeful", truly', 'Love is the one thing…', '=HYPERLINK("http://evil")', ?, ?)`
  ).run(now, now)
  db.prepare(
    "INSERT INTO reasons (id, key, label, is_custom) VALUES (1, 'stressed', 'Stressed', 0)"
  ).run()
  db.prepare('INSERT INTO watch_entry_reasons VALUES (1, 1)').run()
  db.prepare("INSERT INTO settings (key, value) VALUES ('tmdb_token_encrypted', 'c2VjcmV0')").run()
  db.prepare('UPDATE watch_entries SET is_highlight = 1 WHERE id = 1').run()
  db.prepare(
    `INSERT INTO life_periods (name, start_date, end_date, color, note, created_at, updated_at)
     VALUES ('Final year at university', '2025-09-01', NULL, 'violet', 'Thesis and late nights', ?, ?)`
  ).run(now, now)
  return db
}

describe('JSON export', () => {
  it('contains titles, watches, reasons, cast and reflections, documented', () => {
    const json = buildJsonExport(sampleDb(), '1.0.0', new Date('2026-10-27T00:00:00Z')) as {
      _readme: Record<string, string>
      titles: Array<Record<string, unknown> & { watches: Array<Record<string, unknown>> }>
      genres: string[]
      reasons: Array<{ label: string }>
    }
    expect(json._readme.watches).toMatch(/moodChange/)
    expect(json.genres).toEqual(['Sci-Fi'])
    expect(json.reasons.map((reason) => reason.label)).toEqual(['Stressed'])
    const [title] = json.titles
    expect(title).toMatchObject({
      title: 'Interstellar',
      rating: 10,
      isFavorite: true,
      genres: ['Sci-Fi'],
      cast: [{ name: 'Matthew McConaughey', character: 'Cooper' }],
      directors: ['Christopher Nolan']
    })
    expect(title.watches[0]).toMatchObject({
      moodBeforeLabel: 'Stressed',
      moodAfterLabel: 'Happy',
      moodChange: 5,
      reasons: ['Stressed'],
      thoughts: 'Made me feel "hopeful", truly',
      favoriteQuote: 'Love is the one thing…'
    })
  })

  it('includes life chapters and highlights, documented in _readme', () => {
    const json = buildJsonExport(sampleDb(), '1.0.0') as {
      _readme: Record<string, string>
      lifePeriods: unknown[]
      titles: Array<{ watches: Array<{ isHighlight: boolean }> }>
    }
    expect(json._readme.lifePeriods).toMatch(/endDate null = ongoing/)
    expect(json._readme.highlights).toMatch(/isHighlight/)
    expect(json.lifePeriods).toEqual([
      {
        name: 'Final year at university',
        startDate: '2025-09-01',
        endDate: null,
        color: 'violet',
        note: 'Thesis and late nights'
      }
    ])
    expect(json.titles[0].watches[0].isHighlight).toBe(true)
  })

  it('never includes images, the TMDB token or TMDB snapshots', () => {
    const text = JSON.stringify(buildJsonExport(sampleDb(), '1.0.0'))
    expect(text).not.toMatch(/snapshot|secret|c2VjcmV0|tmdb_token|posterFile|poster_file|1\.jpg/i)
  })
})

describe('CSV export', () => {
  it('opens correctly in Excel: BOM, CRLF, quoting, no formulas', () => {
    const csv = buildWatchesCsv(sampleDb())
    expect(csv.startsWith(`${String.fromCharCode(0xfeff)}Title,Type,Year,Started`)).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(3) // header, one watch, trailing newline
    expect(lines[1]).toContain(
      'Interstellar,Movie,2014,2026-01-01,2026-01-02,day,no,,Stressed,3,Happy,8,5,Stressed'
    )
    expect(lines[1]).toContain('"Made me feel ""hopeful"", truly"')
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(lines[0]).toContain(',Notes,Highlight,My rating')
    expect(lines[1].endsWith(',yes,10')).toBe(true)
  })

  it('escapes single cells', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(-2)).toBe('-2') // numbers stay numbers
    expect(csvCell('-2 days later')).toBe("'-2 days later")
    expect(csvCell('@home')).toBe("'@home")
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    expect(csvCell(true)).toBe('yes')
  })
})
