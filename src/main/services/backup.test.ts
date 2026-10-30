import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  autoBackupName,
  BackupError,
  createBackup,
  ensureFreeSpace,
  inspectBackup,
  pruneAutoBackups,
  restoreFromStaging,
  safeEntryPath,
  verifyBackup
} from './backup'
import { runMigrations } from '../db/migrate'

// Everything here runs on temporary folders with sample databases built from the real
// migrations. No real CineDiary data is ever touched.

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const SUPPORTED = (
  JSON.parse(readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')) as {
    entries: unknown[]
  }
).entries.length

const cleanup: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const step of cleanup.splice(0).reverse()) await step()
})

async function tempDir(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `cinediary-${name}-`))
  cleanup.push(() => rm(dir, { recursive: true, force: true }))
  return dir
}

interface SampleData {
  dir: string
  db: Database.Database
}

/** A data folder like userData: database, images, plus things a backup must leave alone. */
async function sampleData(name: string, titles: string[]): Promise<SampleData> {
  const dir = await tempDir(name)
  const db = new Database(join(dir, 'cinediary.db'))
  db.pragma('journal_mode = WAL')
  runMigrations(db, drizzle(db), MIGRATIONS)
  const now = '2026-01-01T00:00:00.000Z'
  titles.forEach((title, index) => {
    const id = index + 1
    db.prepare(
      "INSERT INTO titles (id, type, title, status, created_at, updated_at) VALUES (?, 'movie', ?, 'completed', ?, ?)"
    ).run(id, title, now, now)
    db.prepare(
      'INSERT INTO watch_entries (title_id, started_at, completed_at, mood_before_score, mood_after_score, thoughts, created_at, updated_at) VALUES (?, ?, ?, 3, 8, ?, ?, ?)'
    ).run(id, '2026-01-01', '2026-01-01', `Thoughts about ${title}`, now, now)
  })
  for (const folder of ['posters', 'backdrops', 'banners', 'posters-temp', 'safety-backups']) {
    await mkdir(join(dir, folder))
  }
  for (let id = 1; id <= titles.length; id++) {
    await writeFile(join(dir, 'posters', `${id}.jpg`), `${name} poster ${id}`)
  }
  await writeFile(join(dir, 'backdrops', '1.jpg'), `${name} backdrop`)
  await writeFile(join(dir, 'banners', 'banner-abc.png'), `${name} banner`)
  await writeFile(join(dir, 'posters-temp', 'unsaved.jpg'), 'temp')
  await writeFile(join(dir, 'safety-backups', 'keep-me.zip'), 'old safety backup')
  cleanup.push(() => {
    if (db.open) db.close()
  })
  return { dir, db }
}

function titleNames(dir: string): string[] {
  const db = new Database(join(dir, 'cinediary.db'), { readonly: true })
  try {
    return (
      db.prepare('SELECT title FROM titles ORDER BY id').all() as Array<{ title: string }>
    ).map((row) => row.title)
  } finally {
    db.close()
  }
}

async function backupOf(data: SampleData, out: string): Promise<string> {
  const file = join(out, 'CineDiary-backup-2026-10-27.zip')
  await createBackup({
    db: data.db,
    dataDir: data.dir,
    outFile: file,
    appVersion: '1.0.0',
    kind: 'manual'
  })
  return file
}

async function expectBackupError(promise: Promise<unknown>, code: string): Promise<BackupError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(BackupError)
  expect((error as BackupError).code).toBe(code)
  return error as BackupError
}

describe('createBackup + verifyBackup', () => {
  it('writes the database, images and manifest, and verifies the result', async () => {
    const data = await sampleData('a', ['Interstellar', 'Paddington 2'])
    // Not checkpointed yet: it only lives in the WAL, which a raw file copy would miss.
    data.db
      .prepare(
        "INSERT INTO titles (type, title, status, created_at, updated_at) VALUES ('movie', 'Only in WAL', 'planned', 'x', 'x')"
      )
      .run()
    const out = await tempDir('out')
    const file = await backupOf(data, out)

    const entries = Object.keys(unzipSync(await readFile(file))).sort()
    expect(entries).toEqual([
      'backdrops/1.jpg',
      'banners/banner-abc.png',
      'cinediary.db',
      'manifest.json',
      'posters/1.jpg',
      'posters/2.jpg'
    ])
    expect(await readdir(out)).toEqual(['CineDiary-backup-2026-10-27.zip']) // no leftovers

    const preview = await verifyBackup(file, join(out, 'verify'), SUPPORTED)
    expect(preview.manifest).toMatchObject({
      format: 'cinediary-backup',
      appVersion: '1.0.0',
      schemaVersion: SUPPORTED,
      kind: 'manual',
      counts: { titles: 3, watchEntries: 2, posters: 2, backdrops: 1 }
    })
    expect(preview.counts.titles).toBe(3)
    expect(existsSync(join(out, 'verify'))).toBe(false)
  })

  it('fails with a clear message when there is not enough disk space', async () => {
    const dir = await tempDir('space')
    const error = await expectBackupError(
      ensureFreeSpace(dir, Number.MAX_SAFE_INTEGER),
      'not_enough_space'
    )
    expect(error.message).toMatch(/Not enough free disk space/)
  })
})

describe('restore', () => {
  async function stagedBackupOf(source: SampleData, target: SampleData): Promise<string> {
    const out = await tempDir('out')
    const file = await backupOf(source, out)
    const staging = join(target.dir, 'restore-staging-1')
    await inspectBackup(file, staging, SUPPORTED)
    return staging
  }

  it('replaces only the database and image folders', async () => {
    const backupSource = await sampleData('a', ['Interstellar', 'Paddington 2'])
    const current = await sampleData('b', ['Dune'])
    const staging = await stagedBackupOf(backupSource, current)
    let reopened = false

    await restoreFromStaging({
      stagingDir: staging,
      dataDir: current.dir,
      asideDir: join(current.dir, 'restore-previous-1'),
      closeDatabase: () => current.db.close(),
      reopenDatabase: () => {
        reopened = true
      }
    })

    expect(reopened).toBe(false)
    expect(titleNames(current.dir)).toEqual(['Interstellar', 'Paddington 2'])
    expect(await readFile(join(current.dir, 'posters', '2.jpg'), 'utf8')).toBe('a poster 2')
    expect(await readFile(join(current.dir, 'banners', 'banner-abc.png'), 'utf8')).toBe('a banner')
    // Never moved or overwritten: safety backups, temp posters, the staging folder itself.
    expect(await readFile(join(current.dir, 'safety-backups', 'keep-me.zip'), 'utf8')).toBe(
      'old safety backup'
    )
    expect(existsSync(join(current.dir, 'posters-temp', 'unsaved.jpg'))).toBe(true)
    expect(existsSync(join(staging, 'manifest.json'))).toBe(true)
    // The previous data is kept aside (cleaned up on the next start).
    expect(existsSync(join(current.dir, 'restore-previous-1', 'cinediary.db'))).toBe(true)
  })

  it('rolls back to the original data when something fails halfway', async () => {
    const backupSource = await sampleData('a', ['Interstellar', 'Paddington 2'])
    const current = await sampleData('b', ['Dune'])
    const staging = await stagedBackupOf(backupSource, current)
    let reopened = false

    const error = await expectBackupError(
      restoreFromStaging({
        stagingDir: staging,
        dataDir: current.dir,
        asideDir: join(current.dir, 'restore-previous-1'),
        closeDatabase: () => current.db.close(),
        reopenDatabase: () => {
          reopened = true
        },
        afterSwap: () => {
          throw new Error('simulated failure')
        }
      }),
      'failed'
    )

    expect(error.message).toMatch(/put back/)
    expect(reopened).toBe(true)
    expect(titleNames(current.dir)).toEqual(['Dune'])
    expect(await readFile(join(current.dir, 'posters', '1.jpg'), 'utf8')).toBe('b poster 1')
    expect(existsSync(join(current.dir, 'posters', '2.jpg'))).toBe(false)
    expect(existsSync(join(current.dir, 'restore-previous-1'))).toBe(false)
    expect(existsSync(join(current.dir, 'safety-backups', 'keep-me.zip'))).toBe(true)
  })
})

describe('chapters, highlights and date precision', () => {
  it('survive a backup and restore', async () => {
    const source = await sampleData('a', ['Interstellar', 'Paddington 2'])
    source.db
      .prepare(
        `INSERT INTO life_periods (name, start_date, end_date, color, note, created_at, updated_at)
         VALUES ('Final year at university', '2025-09-01', NULL, 'violet', 'Thesis', 'x', 'x')`
      )
      .run()
    source.db.prepare('UPDATE watch_entries SET is_highlight = 1 WHERE title_id = 2').run()
    source.db
      .prepare(
        "UPDATE watch_entries SET completed_at = '2019-10-01', date_precision = 'month' WHERE title_id = 1"
      )
      .run()
    const current = await sampleData('b', ['Dune'])
    const out = await tempDir('out')
    const file = await backupOf(source, out)
    const staging = join(current.dir, 'restore-staging')
    await inspectBackup(file, staging, SUPPORTED)
    await restoreFromStaging({
      stagingDir: staging,
      dataDir: current.dir,
      asideDir: join(current.dir, 'restore-previous-1'),
      closeDatabase: () => current.db.close(),
      reopenDatabase: () => undefined
    })

    const restored = new Database(join(current.dir, 'cinediary.db'), { readonly: true })
    try {
      expect(
        restored.prepare('SELECT name, end_date AS endDate, color FROM life_periods').all()
      ).toEqual([{ name: 'Final year at university', endDate: null, color: 'violet' }])
      expect(
        restored
          .prepare('SELECT title_id AS titleId FROM watch_entries WHERE is_highlight = 1')
          .all()
      ).toEqual([{ titleId: 2 }])
      // How well a watch's date is remembered survives too.
      expect(
        restored
          .prepare(
            'SELECT completed_at AS completedAt, date_precision AS precision FROM watch_entries WHERE title_id = 1'
          )
          .get()
      ).toEqual({ completedAt: '2019-10-01', precision: 'month' })
    } finally {
      restored.close()
    }
  })
})

describe('rejected backups (and nothing is changed)', () => {
  async function zipFile(dir: string, files: Record<string, Uint8Array>): Promise<string> {
    const path = join(dir, 'crafted.zip')
    await writeFile(path, zipSync(files))
    return path
  }

  function manifest(overrides: Record<string, unknown> = {}): Uint8Array {
    return strToU8(
      JSON.stringify({
        format: 'cinediary-backup',
        formatVersion: 1,
        appVersion: '1.0.0',
        schemaVersion: SUPPORTED,
        createdAt: '2026-10-27T00:00:00.000Z',
        kind: 'manual',
        counts: { titles: 1, watchEntries: 1, posters: 0, backdrops: 0 },
        ...overrides
      })
    )
  }

  async function validDbBytes(): Promise<Uint8Array> {
    const data = await sampleData('db', ['Dune'])
    data.db.pragma('wal_checkpoint(TRUNCATE)')
    data.db.close()
    return readFile(join(data.dir, 'cinediary.db'))
  }

  it('rejects a backup from a newer schema version', async () => {
    const data = await sampleData('a', ['Interstellar'])
    const out = await tempDir('out')
    const file = await backupOf(data, out)
    const staging = join(out, 'staging')
    await expectBackupError(inspectBackup(file, staging, SUPPORTED - 1), 'newer_schema')
    expect(existsSync(staging)).toBe(false)

    const newer = await zipFile(out, {
      'manifest.json': manifest({ schemaVersion: SUPPORTED + 1 }),
      'cinediary.db': await validDbBytes()
    })
    await expectBackupError(inspectBackup(newer, staging, SUPPORTED), 'newer_schema')
  })

  it('rejects a truncated (damaged) zip', async () => {
    const data = await sampleData('a', ['Interstellar'])
    const out = await tempDir('out')
    const file = await backupOf(data, out)
    const bytes = await readFile(file)
    const cut = join(out, 'cut.zip')
    await writeFile(cut, bytes.subarray(0, Math.floor(bytes.length / 2)))
    const error = await inspectBackup(cut, join(out, 'staging'), SUPPORTED).catch((e) => e)
    expect(error).toBeInstanceOf(BackupError)
    expect(['damaged', 'invalid']).toContain((error as BackupError).code)
    expect(existsSync(join(out, 'staging'))).toBe(false)
  })

  it('rejects a file that is not a zip at all', async () => {
    const out = await tempDir('out')
    const file = join(out, 'notes.zip')
    await writeFile(file, 'just some text, not a backup')
    await expectBackupError(inspectBackup(file, join(out, 'staging'), SUPPORTED), 'invalid')
  })

  it('rejects a zip without a manifest', async () => {
    const out = await tempDir('out')
    const file = await zipFile(out, { 'cinediary.db': await validDbBytes() })
    await expectBackupError(inspectBackup(file, join(out, 'staging'), SUPPORTED), 'invalid')
  })

  it('rejects a backup whose database is corrupted', async () => {
    const out = await tempDir('out')
    const bytes = await validDbBytes()
    const corrupted = new Uint8Array(bytes)
    corrupted.fill(0x5a, 100, Math.min(corrupted.length, 8000)) // smash the schema pages
    const file = await zipFile(out, { 'manifest.json': manifest(), 'cinediary.db': corrupted })
    await expectBackupError(inspectBackup(file, join(out, 'staging'), SUPPORTED), 'damaged')
  })

  it('rejects a malicious "../" entry and writes nothing outside the staging folder', async () => {
    const out = await tempDir('out')
    const staging = join(out, 'nested', 'staging')
    const file = await zipFile(out, {
      'manifest.json': manifest(),
      'cinediary.db': await validDbBytes(),
      '../../evil.txt': strToU8('gotcha')
    })
    const error = await expectBackupError(inspectBackup(file, staging, SUPPORTED), 'unsafe_entry')
    expect(error.message).toMatch(/unexpected file/)
    expect(existsSync(join(out, 'evil.txt'))).toBe(false)
    expect(existsSync(join(out, 'nested', 'evil.txt'))).toBe(false)
    expect(existsSync(staging)).toBe(false)
  })

  it('only accepts the expected layout', () => {
    const target = resolve(tmpdir(), 'staging')
    expect(safeEntryPath(target, 'manifest.json')).toBe(join(target, 'manifest.json'))
    expect(safeEntryPath(target, 'posters/12.jpg')).toBe(join(target, 'posters', '12.jpg'))
    expect(safeEntryPath(target, 'posters/')).toBeNull()
    for (const bad of [
      '../evil.txt',
      'posters/../../evil.txt',
      '/etc/passwd',
      'C:/Windows/evil.dll',
      'posters\\..\\evil.txt',
      'notes.txt',
      'posters/sub/12.jpg',
      'posters-temp/1.jpg'
    ]) {
      expect(() => safeEntryPath(target, bad), bad).toThrow(BackupError)
    }
  })
})

describe('automatic backups', () => {
  it('keeps the newest 10 and only ever deletes backups this feature made', async () => {
    const folder = await tempDir('auto')
    const created: string[] = []
    for (let day = 1; day <= 12; day++) {
      const name = autoBackupName(new Date(2026, 0, day, 9, 30))
      await writeFile(join(folder, name), 'auto')
      created.push(name)
    }
    // Looks like an auto-backup but I put it there myself, plus an unrelated file.
    const mine = autoBackupName(new Date(2025, 0, 1, 8, 0))
    await writeFile(join(folder, mine), 'my own copy')
    await writeFile(join(folder, 'thesis.docx'), 'important')

    const kept = await pruneAutoBackups(folder, created, 10)

    expect(kept).toEqual(created.slice(2))
    expect(existsSync(join(folder, created[0]))).toBe(false)
    expect(existsSync(join(folder, created[1]))).toBe(false)
    expect(existsSync(join(folder, mine))).toBe(true)
    expect(existsSync(join(folder, 'thesis.docx'))).toBe(true)
  })

  it('names auto-backups by local date and time', () => {
    expect(autoBackupName(new Date(2026, 9, 27, 9, 5))).toBe('CineDiary-auto-2026-10-27-0905.zip')
  })
})
