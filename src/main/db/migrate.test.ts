import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runMigrations } from './migrate'

// Migration 0006 rebuilds `titles` and `watch_entries` to add the 1–10 CHECKs. These tests
// build a diary at 0005 (in memory), fill it, then upgrade it, like a real 1.0.0 → 1.1.0 start.

const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url))
const NOW = '2026-01-01T00:00:00.000Z'

let folders: string[] = []
afterEach(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true })
  folders = []
})

/** A copy of the migrations folder that stops after migration `last` (e.g. 5 = 0005). */
function migrationsUpTo(last: number): string {
  const folder = mkdtempSync(join(tmpdir(), 'cinediary-migrations-'))
  folders.push(folder)
  cpSync(MIGRATIONS, folder, { recursive: true })
  const journalPath = join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number }[] }
  journal.entries = journal.entries.filter((entry) => entry.idx <= last)
  writeFileSync(journalPath, JSON.stringify(journal))
  return folder
}

/** A 1.0.0 diary (schema 0005) with a title, a watch, reasons, genres, cast and crew. */
function diaryAt0005(score = 4): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite, drizzle(sqlite), migrationsUpTo(5))
  sqlite.exec(`
    INSERT INTO titles (id, type, title, status, rating, created_at, updated_at)
      VALUES (1, 'movie', 'Paterson', 'completed', 8, '${NOW}', '${NOW}'),
             (5, 'movie', 'Deleted later', 'planned', NULL, '${NOW}', '${NOW}');
    DELETE FROM titles WHERE id = 5;
    INSERT INTO genres (id, name) VALUES (1, 'Drama');
    INSERT INTO title_genres VALUES (1, 1);
    INSERT INTO title_cast (title_id, name, character, "order") VALUES (1, 'Adam Driver', 'Paterson', 0);
    INSERT INTO title_crew (title_id, name, role, "order") VALUES (1, 'Jim Jarmusch', 'director', 0);
    INSERT INTO reasons (id, key, label, is_custom) VALUES (1, 'curious', 'Curious', 0);
    INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before,
        mood_before_score, mood_after, mood_after_score, created_at, updated_at)
      VALUES (3, 1, '2025-05-01', '2025-05-01', 'sad', ${score}, 'calm', 7, '${NOW}', '${NOW}');
    INSERT INTO watch_entry_reasons VALUES (3, 1);
  `)
  return sqlite
}

const count = (sqlite: Database.Database, table: string): number =>
  (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n

describe('migration 0006: 1–10 checks', () => {
  it('keeps every row, link, index and id counter, with foreign keys back on', () => {
    const sqlite = diaryAt0005()
    runMigrations(sqlite, drizzle(sqlite), MIGRATIONS)

    expect(sqlite.prepare('SELECT * FROM titles').all()).toMatchObject([
      { id: 1, title: 'Paterson', rating: 8 }
    ])
    expect(sqlite.prepare('SELECT * FROM watch_entries').get()).toMatchObject({
      id: 3,
      mood_before_score: 4,
      mood_after_score: 7
    })
    for (const table of ['title_genres', 'title_cast', 'title_crew', 'watch_entry_reasons'])
      expect(count(sqlite, table), table).toBe(1)
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    const indexes = (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as {
        name: string
      }[]
    ).map((row) => row.name)
    expect(indexes).toEqual(
      expect.arrayContaining([
        'titles_tmdb_type_unique',
        'titles_title_index',
        'titles_status_index',
        'watch_entries_title_id_index',
        'watch_entries_completed_at_index'
      ])
    )
    // Title 5 was deleted before the upgrade: its id is never handed out again.
    sqlite
      .prepare(
        `INSERT INTO titles (type, title, status, created_at, updated_at)
         VALUES ('movie', 'New', 'planned', '${NOW}', '${NOW}')`
      )
      .run()
    expect(sqlite.prepare("SELECT id FROM titles WHERE title = 'New'").get()).toEqual({ id: 6 })
    // Deleting a title still cascades to its watches and their reasons.
    sqlite.prepare('DELETE FROM titles WHERE id = 1').run()
    expect(count(sqlite, 'watch_entries')).toBe(0)
    expect(count(sqlite, 'watch_entry_reasons')).toBe(0)
  })

  it('refuses to start on an out-of-range score and changes nothing', () => {
    const sqlite = diaryAt0005(11)
    expect(() => runMigrations(sqlite, drizzle(sqlite), MIGRATIONS)).toThrow(/CHECK/)
    // Rolled back: still schema 0005, the score untouched, foreign keys on again.
    expect(sqlite.prepare('SELECT mood_before_score FROM watch_entries').get()).toEqual({
      mood_before_score: 11
    })
    expect(count(sqlite, '__drizzle_migrations')).toBe(6)
    expect(count(sqlite, 'watch_entry_reasons')).toBe(1)
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('the database itself rejects scores and ratings outside 1–10', () => {
    const sqlite = diaryAt0005()
    runMigrations(sqlite, drizzle(sqlite), MIGRATIONS)
    const setScore = (column: string, value: unknown): unknown =>
      sqlite.prepare(`UPDATE watch_entries SET ${column} = ? WHERE id = 3`).run(value)
    const setRating = (value: unknown): unknown =>
      sqlite.prepare('UPDATE titles SET rating = ? WHERE id = 1').run(value)

    for (const value of [0, 11, -3, 7.5, 'seven']) {
      expect(() => setScore('mood_before_score', value), String(value)).toThrow(/CHECK/)
      expect(() => setScore('mood_after_score', value), String(value)).toThrow(/CHECK/)
      expect(() => setRating(value), String(value)).toThrow(/CHECK/)
    }
    for (const value of [1, 10, null]) {
      expect(() => setScore('mood_before_score', value)).not.toThrow()
      expect(() => setScore('mood_after_score', value)).not.toThrow()
      expect(() => setRating(value)).not.toThrow()
    }
  })
})
