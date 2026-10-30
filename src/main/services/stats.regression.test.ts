import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as schema from '../db/schema'
import type { CineDiaryDatabase } from '../db/client'
import { seedDefaultReasons } from '../db/seed'
import { DEFAULT_MOODS } from '../../shared/constants'
import { getDashboard } from './dashboard'
import { getInsights } from './stats'
import { runMigrations } from '../db/migrate'

// Regression guard for the M10c stats refactor: these snapshots were recorded BEFORE the
// refactor, on an in-memory sample diary (no real data). They must keep passing unchanged.

const holder = vi.hoisted(() => ({ db: null as CineDiaryDatabase | null }))
vi.mock('../db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/client')>()),
  getDatabase: (): CineDiaryDatabase => {
    if (!holder.db) throw new Error('Test database not ready')
    return holder.db
  }
}))

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
let sqlite: Database.Database

/** Small deterministic random generator, so the sample diary is the same on every run. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** ~30 titles and ~220 watches from 2023 to today (2026-10-28), with moods, reasons, crew. */
function seedSampleDiary(): void {
  const rand = random(42)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]
  const genreNames = ['Comedy', 'Drama', 'Sci-Fi', 'Action', 'Documentary', 'Romance']
  genreNames.forEach((name, index) =>
    sqlite.prepare('INSERT INTO genres (id, name) VALUES (?, ?)').run(index + 1, name)
  )
  seedDefaultReasons()
  sqlite
    .prepare("INSERT INTO reasons (key, label, is_custom) VALUES ('exam_week', 'Exam week', 1)")
    .run()
  const reasonIds = (
    sqlite.prepare('SELECT id FROM reasons ORDER BY id').all() as { id: number }[]
  ).map((row) => row.id)
  const directors = [
    'Greta Gerwig',
    'Denis Villeneuve',
    'Bong Joon-ho',
    'Céline Sciamma',
    'Hayao Miyazaki'
  ]

  const titleCount = 30
  for (let id = 1; id <= titleCount; id++) {
    const type = id % 4 === 0 ? 'series' : 'movie'
    const created = isoDate(new Date(2023, 0, 1 + id * 40)) + 'T10:00:00.000Z'
    sqlite
      .prepare(
        `INSERT INTO titles (id, type, title, status, rating, is_favorite, runtime_minutes,
          created_at, updated_at) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        type,
        `${type === 'series' ? 'Series' : 'Movie'} ${id}`,
        rand() < 0.7 ? 5 + Math.floor(rand() * 6) : null,
        rand() < 0.25 ? 1 : 0,
        type === 'series' ? 30 + Math.floor(rand() * 30) : 85 + Math.floor(rand() * 70),
        created,
        created
      )
    const first = 1 + Math.floor(rand() * genreNames.length)
    sqlite.prepare('INSERT INTO title_genres VALUES (?, ?)').run(id, first)
    if (rand() < 0.5) {
      const second = 1 + ((first + Math.floor(rand() * 5)) % genreNames.length)
      if (second !== first) sqlite.prepare('INSERT INTO title_genres VALUES (?, ?)').run(id, second)
    }
    if (type === 'movie' && rand() < 0.8) {
      sqlite
        .prepare(
          'INSERT INTO title_crew (title_id, name, role, "order") VALUES (?, ?, \'director\', 0)'
        )
        .run(id, pick(directors))
    }
  }

  const start = new Date(2023, 0, 5).getTime()
  const end = new Date(2026, 9, 28).getTime()
  const now = '2026-01-01T00:00:00.000Z'
  for (let id = 1; id <= 220; id++) {
    // Denser towards today, so "this month" and "6 months" have data too.
    const position = Math.sqrt(rand())
    const date = isoDate(new Date(start + (end - start) * position))
    const titleId = 1 + Math.floor(rand() * titleCount)
    const isSeries = titleId % 4 === 0
    const inProgress = isSeries && rand() < 0.15
    const moodBefore = rand() < 0.8 ? pick(DEFAULT_MOODS).key : null
    const moodAfter = rand() < 0.75 ? pick(DEFAULT_MOODS).key : null
    sqlite
      .prepare(
        `INSERT INTO watch_entries (id, title_id, started_at, completed_at, is_rewatch, episodes_watched,
          mood_before, mood_before_score, mood_after, mood_after_score, thoughts, is_highlight,
          created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        titleId,
        date,
        inProgress ? null : date,
        rand() < 0.2 ? 1 : 0,
        isSeries ? 1 + Math.floor(rand() * 10) : 0,
        moodBefore,
        moodBefore && rand() < 0.9 ? 1 + Math.floor(rand() * 10) : null,
        moodAfter,
        moodAfter && rand() < 0.9 ? 1 + Math.floor(rand() * 10) : null,
        rand() < 0.3 ? `Thoughts on watch ${id}` : null,
        rand() < 0.1 ? 1 : 0,
        now,
        now
      )
    const reasonCount = Math.floor(rand() * 4) // 0–3 reasons
    const chosen = new Set<number>()
    while (chosen.size < reasonCount) chosen.add(pick(reasonIds))
    for (const reasonId of chosen) {
      sqlite.prepare('INSERT INTO watch_entry_reasons VALUES (?, ?)').run(id, reasonId)
    }
  }
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 28, 12, 0, 0))
  sqlite = new Database(':memory:')
  holder.db = drizzle(sqlite, { schema })
  runMigrations(sqlite, holder.db, MIGRATIONS)
  seedSampleDiary()
})

afterAll(() => {
  sqlite.close()
  holder.db = null
  vi.useRealTimers()
})

describe('stats regression (recorded before the M10c refactor)', () => {
  it.each(['month', 'six_months', 'year', 'all'] as const)('getInsights(%s)', (period) => {
    expect(getInsights(period)).toMatchSnapshot()
  })

  it('dashboard numbers', () => {
    expect(getDashboard()).toMatchSnapshot()
  })
})
