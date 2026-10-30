import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { fileURLToPath } from 'node:url'
import * as schema from '../db/schema'
import { runMigrations } from '../db/migrate'
import type { CineDiaryDatabase } from '../db/client'

// Test helpers: an in-memory SQLite database with the real migrations (never a file, never
// the real diary), plus small inserts for a hand-made sample diary.
//
// Services that call getDatabase() get this one with, at the top of the test file:
//   vi.mock('../db/client', async (original) => ({
//     ...(await original<typeof import('../db/client')>()),
//     getDatabase: (await import('../test/memoryDb')).currentDatabase
//   }))

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
export const NOW = '2026-01-01T00:00:00.000Z'

let sqlite: Database.Database | null = null
let database: CineDiaryDatabase | null = null

export function openMemoryDatabase(): { sqlite: Database.Database; db: CineDiaryDatabase } {
  sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  database = drizzle(sqlite, { schema })
  runMigrations(sqlite, database, MIGRATIONS)
  return { sqlite, db: database }
}

export function closeMemoryDatabase(): void {
  sqlite?.close()
  sqlite = null
  database = null
}

export function currentDatabase(): CineDiaryDatabase {
  if (!database) throw new Error('Test database not open (call openMemoryDatabase first)')
  return database
}

function raw(): Database.Database {
  if (!sqlite) throw new Error('Test database not open')
  return sqlite
}

export interface SampleTitle {
  id: number
  title?: string
  type?: 'movie' | 'series'
  status?: string
  runtime?: number | null
  rating?: number | null
  genres?: string[]
}

export function insertTitle(title: SampleTitle): void {
  raw()
    .prepare(
      `INSERT INTO titles (id, type, title, status, runtime_minutes, rating, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title.id,
      title.type ?? 'movie',
      title.title ?? `Title ${title.id}`,
      title.status ?? 'planned',
      title.runtime ?? null,
      title.rating ?? null,
      NOW,
      NOW
    )
  for (const name of title.genres ?? []) {
    raw().prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)').run(name)
    const { id } = raw().prepare('SELECT id FROM genres WHERE name = ?').get(name) as {
      id: number
    }
    raw().prepare('INSERT INTO title_genres VALUES (?, ?)').run(title.id, id)
  }
}

export interface SampleWatch {
  id: number
  titleId: number
  started: string
  /** null = still watching. */
  completed?: string | null
  episodes?: number
  moodBefore?: string | null
  before?: number | null
  moodAfter?: string | null
  after?: number | null
  thoughts?: string | null
  lessons?: string | null
  reasonNote?: string | null
  reasons?: number[]
}

export function insertWatch(watch: SampleWatch): void {
  raw()
    .prepare(
      `INSERT INTO watch_entries (id, title_id, started_at, completed_at, episodes_watched,
        mood_before, mood_before_score, mood_after, mood_after_score, thoughts, lessons,
        reason_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      watch.id,
      watch.titleId,
      watch.started,
      watch.completed === undefined ? watch.started : watch.completed,
      watch.episodes ?? 0,
      watch.moodBefore ?? null,
      watch.before ?? null,
      watch.moodAfter ?? null,
      watch.after ?? null,
      watch.thoughts ?? null,
      watch.lessons ?? null,
      watch.reasonNote ?? null,
      NOW,
      NOW
    )
  for (const reasonId of watch.reasons ?? []) {
    raw().prepare('INSERT INTO watch_entry_reasons VALUES (?, ?)').run(watch.id, reasonId)
  }
}

/** Adds reasons with ids 1, 2, … in the given order. */
export function insertReasons(labels: string[]): void {
  labels.forEach((label, index) =>
    raw()
      .prepare('INSERT INTO reasons (id, key, label, is_custom) VALUES (?, ?, ?, 0)')
      .run(index + 1, label.toLowerCase().replace(/\W+/g, '_'), label)
  )
}

export function titleStatus(id: number): string {
  return (raw().prepare('SELECT status FROM titles WHERE id = ?').get(id) as { status: string })
    .status
}
