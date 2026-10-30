import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  holdsDiary,
  isCineDiaryItem,
  POINTER_FILE,
  readPointer,
  removePointer,
  resolveStartup,
  writePointer
} from './dataLocation'
import { checkMoveTarget, copyDataFolder, removeDiaryItems, verifyCopy } from './dataMove'
import { runMigrations } from '../db/migrate'

// Moving the data folder and finding it again at startup, on temporary folders only.

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const temp: string[] = []
const open: Database.Database[] = []
afterEach(() => {
  for (const db of open.splice(0)) if (db.open) db.close()
  for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `cinediary-${name}-`))
  temp.push(dir)
  return dir
}

/** A data folder like the real one: an open WAL database, images, a safety backup and a log. */
function sampleDataFolder(): { dir: string; db: Database.Database } {
  const dir = tempDir('data')
  const db = new Database(join(dir, 'cinediary.db'))
  open.push(db)
  db.pragma('journal_mode = WAL')
  runMigrations(db, drizzle(db), MIGRATIONS)
  const now = '2026-01-01T00:00:00.000Z'
  for (let id = 1; id <= 3; id++) {
    db.prepare(
      "INSERT INTO titles (id, type, title, status, created_at, updated_at) VALUES (?, 'movie', ?, 'completed', ?, ?)"
    ).run(id, `Title ${id}`, now, now)
  }
  for (const folder of [
    'posters',
    'backdrops',
    'banners',
    'safety-backups',
    'logs',
    'posters-temp'
  ])
    mkdirSync(join(dir, folder))
  writeFileSync(join(dir, 'posters', '1.jpg'), 'poster one')
  writeFileSync(join(dir, 'posters', '2.jpg'), 'poster two')
  writeFileSync(join(dir, 'banners', 'banner-a.png'), 'banner')
  writeFileSync(join(dir, 'safety-backups', 'CineDiary-safety-1.zip'), 'zip')
  writeFileSync(join(dir, 'logs', 'cinediary.log'), 'a log line\n')
  writeFileSync(join(dir, 'posters-temp', 'unsaved.jpg'), 'temp')
  // Chromium's own files, as in the default location (userData).
  mkdirSync(join(dir, 'Local Storage'))
  writeFileSync(join(dir, 'Preferences'), '{}')
  writeFileSync(join(dir, 'window-state.json'), '{}')
  return { dir, db }
}

describe('checkMoveTarget', () => {
  it('accepts a new folder or an empty one, and creates it', async () => {
    const { dir } = sampleDataFolder()
    const target = join(tempDir('target'), 'CineDiary')
    expect(await checkMoveTarget(dir, target, dir)).toEqual({ ok: true, folder: target })
    expect(existsSync(target)).toBe(true)
  })

  it('refuses the same folder, a folder inside it, and a folder with other files', async () => {
    const { dir } = sampleDataFolder()
    expect(await checkMoveTarget(dir, dir, dir)).toMatchObject({ ok: false, message: /already/ })
    expect(await checkMoveTarget(dir, join(dir, 'inside'), dir)).toMatchObject({
      ok: false,
      message: /outside/
    })
    const busy = tempDir('busy')
    writeFileSync(join(busy, 'notes.txt'), 'mine')
    expect(await checkMoveTarget(dir, busy, dir)).toMatchObject({ ok: false, message: /empty/ })
  })

  it('allows the default location (with Electron’s files) unless it already holds a diary', async () => {
    const { dir } = sampleDataFolder()
    const defaultFolder = tempDir('userdata')
    writeFileSync(join(defaultFolder, 'Preferences'), '{}')
    expect(await checkMoveTarget(dir, defaultFolder, defaultFolder)).toMatchObject({ ok: true })
    writeFileSync(join(defaultFolder, 'cinediary.db'), '')
    expect(await checkMoveTarget(dir, defaultFolder, defaultFolder)).toMatchObject({
      ok: false,
      message: /already holds CineDiary data/
    })
  })
})

describe('copy and verify', () => {
  it('copies the database and folders, and the copy verifies', async () => {
    const { dir, db } = sampleDataFolder()
    const target = join(tempDir('target'), 'CineDiary')
    const steps: string[] = []
    db.pragma('query_only = ON')
    await copyDataFolder({ db, source: dir, target, onStep: (step) => steps.push(step) })
    expect(steps).toEqual(['copying-database', 'copying-images'])
    expect(await verifyCopy(db, dir, target)).toEqual([])
    // (Opening the copy to verify it may leave SQLite's -wal/-shm files next to it.)
    expect(
      readdirSync(target)
        .filter((name) => !/-(wal|shm)$/.test(name))
        .sort()
    ).toEqual(['backdrops', 'banners', 'cinediary.db', 'logs', 'posters', 'safety-backups'].sort())
    // Temporary folders and Electron's files stay behind.
    expect(existsSync(join(target, 'posters-temp'))).toBe(false)
    expect(existsSync(join(target, 'Preferences'))).toBe(false)
    const copy = new Database(join(target, 'cinediary.db'), { readonly: true })
    open.push(copy)
    expect((copy.prepare('SELECT count(*) AS n FROM titles').get() as { n: number }).n).toBe(3)
  })

  it('blocks writes while frozen (query_only), so nothing changes after the copy', () => {
    const { db } = sampleDataFolder()
    db.pragma('query_only = ON')
    expect(() => db.prepare("UPDATE titles SET title = 'changed' WHERE id = 1").run()).toThrow(
      /readonly/
    )
    db.pragma('query_only = OFF')
    db.prepare("UPDATE titles SET title = 'changed' WHERE id = 1").run()
  })

  it('reports a copy that does not match', async () => {
    const { dir, db } = sampleDataFolder()
    const target = join(tempDir('target'), 'CineDiary')
    await copyDataFolder({ db, source: dir, target })
    rmSync(join(target, 'posters', '2.jpg'))
    writeFileSync(join(target, 'banners', 'banner-a.png'), 'a different banner')
    const copy = new Database(join(target, 'cinediary.db'))
    copy.prepare('DELETE FROM titles WHERE id = 3').run()
    copy.close()
    const problems = await verifyCopy(db, dir, target)
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toMatch(/titles: 3 rows, but 2/)
    expect(problems.join('\n')).toMatch(/posters: 2 files/)
    expect(problems.join('\n')).toMatch(/banners: 1 files/)
  })

  it('reports a copy whose database is missing', async () => {
    const { dir, db } = sampleDataFolder()
    const target = tempDir('target')
    expect((await verifyCopy(db, dir, target))[0]).toMatch(/can’t be opened/)
  })
})

describe('removeDiaryItems (deleting the old copy)', () => {
  it('removes only CineDiary’s files and leaves everything else', async () => {
    const { dir, db } = sampleDataFolder()
    db.close()
    const removed = await removeDiaryItems(dir)
    expect(removed).toEqual(
      [
        'backdrops',
        'banners',
        'cinediary.db',
        'logs',
        'posters',
        'posters-temp',
        'safety-backups'
      ].sort()
    )
    expect(readdirSync(dir).sort()).toEqual(['Local Storage', 'Preferences', 'window-state.json'])
  })

  it('knows its own items', () => {
    for (const name of ['cinediary.db-wal', 'restore-previous-123', 'backup-verify-x', 'logs'])
      expect(isCineDiaryItem(name), name).toBe(true)
    for (const name of ['Preferences', 'Cache', 'data-location.json', 'window-state.json'])
      expect(isCineDiaryItem(name), name).toBe(false)
  })
})

describe('pointer and startup', () => {
  it('without a pointer, uses the default folder exactly as before', () => {
    const userData = tempDir('userdata')
    expect(resolveStartup(userData)).toEqual({ state: 'ok', folder: userData, pointer: null })
  })

  it('follows a pointer to a folder that holds a diary', () => {
    const userData = tempDir('userdata')
    const { dir } = sampleDataFolder()
    writePointer(userData, { folder: dir, previous: userData })
    expect(resolveStartup(userData)).toEqual({
      state: 'ok',
      folder: dir,
      pointer: { folder: dir, previous: userData }
    })
    expect(holdsDiary(dir)).toBe(true)
  })

  it('reports a missing folder (or one without a diary) instead of starting an empty one', () => {
    const userData = tempDir('userdata')
    const gone = join(tempDir('drive'), 'unplugged')
    writePointer(userData, { folder: gone })
    expect(resolveStartup(userData)).toEqual({ state: 'missing', folder: gone })
    mkdirSync(gone)
    expect(resolveStartup(userData)).toEqual({ state: 'missing', folder: gone })
    expect(existsSync(join(gone, 'cinediary.db'))).toBe(false)
  })

  it('reports a damaged pointer as unreadable', () => {
    const userData = tempDir('userdata')
    writeFileSync(join(userData, POINTER_FILE), '{ not json')
    expect(resolveStartup(userData)).toEqual({ state: 'unreadable', folder: null })
    writeFileSync(join(userData, POINTER_FILE), JSON.stringify({ folder: 'relative/path' }))
    expect(readPointer(userData)).toBe('unreadable')
  })

  it('writes the pointer in one piece and can go back to the default', () => {
    const userData = tempDir('userdata')
    writePointer(userData, { folder: join(userData, 'x') })
    expect(JSON.parse(readFileSync(join(userData, POINTER_FILE), 'utf8'))).toEqual({
      folder: join(userData, 'x')
    })
    expect(existsSync(join(userData, `${POINTER_FILE}.tmp`))).toBe(false)
    removePointer(userData)
    expect(readPointer(userData)).toBeNull()
  })
})
