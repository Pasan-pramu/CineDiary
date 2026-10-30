import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import type { CineDiaryDatabase } from '../db/client'
import { globalSearch, SEARCH_GROUP_LIMIT, snippetAround } from './search'
import { runMigrations } from '../db/migrate'

// Global search on a small in-memory sample diary (no real data).

const holder = vi.hoisted(() => ({ db: null as CineDiaryDatabase | null }))
vi.mock('../db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/client')>()),
  getDatabase: (): CineDiaryDatabase => {
    if (!holder.db) throw new Error('Test database not ready')
    return holder.db
  }
}))

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const NOW = '2026-01-01T00:00:00.000Z'
let sqlite: Database.Database
let db: CineDiaryDatabase

beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  holder.db = db
  runMigrations(sqlite, db, MIGRATIONS)
})
afterEach(() => {
  sqlite.close()
  holder.db = null
})

function addTitle(
  id: number,
  title: string,
  extra: { original?: string; year?: number } = {}
): void {
  sqlite
    .prepare(
      `INSERT INTO titles (id, type, title, original_title, year, status, created_at, updated_at)
        VALUES (?, 'movie', ?, ?, ?, 'completed', ?, ?)`
    )
    .run(id, title, extra.original ?? null, extra.year ?? null, NOW, NOW)
}

function addWatch(id: number, titleId: number, date: string, fields: Record<string, string>): void {
  sqlite
    .prepare(
      `INSERT INTO watch_entries (id, title_id, started_at, completed_at, thoughts, lessons,
        favorite_quote, reason_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      titleId,
      date,
      date,
      fields.thoughts ?? null,
      fields.lessons ?? null,
      fields.quote ?? null,
      fields.reason ?? null,
      NOW,
      NOW
    )
}

describe('global search', () => {
  it('needs at least 2 characters (after trimming)', () => {
    addTitle(1, 'Up')
    expect(globalSearch(' u ').query).toBe('')
    expect(globalSearch(' u ').titles).toEqual({ items: [], total: 0 })
    expect(globalSearch(' up ').titles.total).toBe(1)
  })

  it('treats %, _ and \\ literally', () => {
    addTitle(1, '100% Wolf')
    addTitle(2, '1000 Wolves')
    addTitle(3, 'snake_case')
    addTitle(4, 'snakeXcase')
    addTitle(5, 'Back\\slash')
    addTitle(6, 'Backslash')
    expect(globalSearch('0%').titles.items.map((hit) => hit.id)).toEqual([1])
    expect(globalSearch('e_c').titles.items.map((hit) => hit.id)).toEqual([3])
    expect(globalSearch('k\\s').titles.items.map((hit) => hit.id)).toEqual([5])
  })

  it('finds titles by original title, genre, cast and director, saying why, each once', () => {
    addTitle(1, 'Spirited Away', { original: 'Sen to Chihiro no Kamikakushi' })
    addTitle(2, 'Interstellar')
    addTitle(3, 'Dune')
    addTitle(4, 'Arrival')
    sqlite
      .prepare(
        "INSERT INTO genres (id, name) VALUES (1, 'Science Fiction'), (2, 'Drama'), (3, 'Space Fiction')"
      )
      .run()
    sqlite.prepare('INSERT INTO title_genres VALUES (2, 1), (2, 2), (2, 3), (3, 1)').run()
    sqlite
      .prepare(
        `INSERT INTO title_cast (title_id, name, character, "order") VALUES
          (2, 'Jessica Chastain', 'Murph', 0), (4, 'Amy Adams', 'Louise', 0)`
      )
      .run()
    sqlite
      .prepare(
        `INSERT INTO title_crew (title_id, name, role, "order") VALUES
          (3, 'Denis Villeneuve', 'director', 0), (4, 'Denis Villeneuve', 'director', 0)`
      )
      .run()

    expect(globalSearch('chihiro').titles.items).toEqual([
      expect.objectContaining({ id: 1, match: 'Original title: Sen to Chihiro no Kamikakushi' })
    ])
    // Interstellar has two matching genres but appears once.
    const fiction = globalSearch('fiction').titles
    expect(fiction.total).toBe(2)
    expect(fiction.items.map((hit) => [hit.title, hit.match])).toEqual([
      ['Dune', 'Genre: Science Fiction'],
      ['Interstellar', 'Genre: Science Fiction']
    ])
    expect(globalSearch('chastain').titles.items).toEqual([
      expect.objectContaining({ id: 2, match: 'Cast: Jessica Chastain' })
    ])
    expect(globalSearch('villeneuve').titles.items.map((hit) => [hit.title, hit.match])).toEqual([
      ['Arrival', 'Director: Denis Villeneuve'],
      ['Dune', 'Director: Denis Villeneuve']
    ])
    // A title-name match needs no explanation.
    expect(globalSearch('dune').titles.items).toEqual([
      expect.objectContaining({ id: 3, match: null })
    ])
  })

  it('ranks an exact title first, then titles starting with the text', () => {
    addTitle(1, 'The Matrix Reloaded')
    addTitle(2, 'Matrix')
    addTitle(3, 'Matrix Resurrections')
    expect(globalSearch('matrix').titles.items.map((hit) => hit.id)).toEqual([2, 3, 1])
  })

  it('returns at most 5 per group, with the full total', () => {
    for (let id = 1; id <= 8; id++) {
      addTitle(id, `Night ${id}`)
      addWatch(id, id, `2026-0${id}-01`, { thoughts: `A night to remember, number ${id}` })
      sqlite
        .prepare(
          "INSERT INTO life_periods (name, start_date, color, created_at, updated_at) VALUES (?, ?, 'teal', ?, ?)"
        )
        .run(`Night shift ${id}`, `2020-0${id}-01`, NOW, NOW)
    }
    const result = globalSearch('night')
    for (const group of [result.titles, result.journal, result.chapters]) {
      expect(group.items).toHaveLength(SEARCH_GROUP_LIMIT)
      expect(group.total).toBe(8)
    }
    // Journal and chapters: newest first.
    expect(result.journal.items[0].date).toBe('2026-08-01')
    expect(result.chapters.items[0].startDate).toBe('2020-08-01')
  })

  it('searches journal text and says which field matched', () => {
    addTitle(1, 'Paddington 2')
    addTitle(2, 'Up')
    addWatch(1, 1, '2026-03-01', { lessons: 'Kindness wins in the end.' })
    addWatch(2, 2, '2026-04-01', { reason: 'Needed something kind after exams' })
    addWatch(3, 1, '2026-05-01', { quote: 'If we are kind and polite, the world will be right.' })
    addWatch(4, 2, '2026-06-01', { thoughts: 'Nothing to do with it.' })
    const journal = globalSearch('kind').journal
    expect(journal.total).toBe(3)
    expect(journal.items.map((hit) => [hit.entryId, hit.field, hit.title])).toEqual([
      [3, 'Quote', 'Paddington 2'],
      [2, 'Why I watched', 'Up'],
      [1, 'Lessons', 'Paddington 2']
    ])
  })

  it('finds chapters by name or note, quoting the note only when that matched', () => {
    sqlite
      .prepare(
        `INSERT INTO life_periods (id, name, start_date, end_date, color, note, created_at, updated_at) VALUES
          (1, 'Final year at university', '2025-09-01', '2026-06-30', 'violet', 'Thesis and late nights', ?, ?),
          (2, 'Summer in Lisbon', '2024-06-01', NULL, 'amber', 'Long walks after the thesis was done', ?, ?)`
      )
      .run(NOW, NOW, NOW, NOW)
    expect(globalSearch('lisbon').chapters.items).toEqual([
      expect.objectContaining({ id: 2, endDate: null, color: 'amber', snippet: null })
    ])
    expect(globalSearch('thesis').chapters.items.map((hit) => [hit.id, hit.snippet])).toEqual([
      [1, 'Thesis and late nights'],
      [2, 'Long walks after the thesis was done']
    ])
  })
})

describe('snippets', () => {
  it('cuts long text around the match with …', () => {
    const text = `${'a'.repeat(200)} the needle ${'b'.repeat(200)}`
    const snippet = snippetAround(text, 'NEEDLE', 20)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet).toContain('the needle')
    expect(snippet.length).toBeLessThan(60)
  })
})
