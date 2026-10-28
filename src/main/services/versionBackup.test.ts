import Database from 'better-sqlite3'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeMemoryDatabase, openMemoryDatabase } from '../test/memoryDb'
import {
  KEEP_UPGRADE_BACKUPS,
  needsUpgradeBackup,
  pruneUpgradeBackups,
  readDiaryVersion,
  upgradeBackupName,
  writeAppVersion
} from './versionBackup'

// Runs on an in-memory database and a temporary folder; never on real data.

const cleanup: Array<() => Promise<void> | void> = []
afterEach(async () => {
  for (const step of cleanup.splice(0).reverse()) await step()
})

describe('version check before migrations', () => {
  it('sees a brand-new database as no diary (nothing to back up)', () => {
    const db = new Database(':memory:')
    cleanup.push(() => void db.close())
    const diary = readDiaryVersion(db)
    expect(diary).toEqual({ hasDiary: false, lastVersion: null })
    expect(needsUpgradeBackup(diary, '1.0.0')).toBe(false)
  })

  it('backs up a diary from before version tracking, then not again for the same version', () => {
    const { sqlite } = openMemoryDatabase()
    cleanup.push(closeMemoryDatabase)
    const before = readDiaryVersion(sqlite)
    expect(before).toEqual({ hasDiary: true, lastVersion: null })
    expect(needsUpgradeBackup(before, '1.0.0')).toBe(true)

    writeAppVersion(sqlite, '1.0.0')
    expect(needsUpgradeBackup(readDiaryVersion(sqlite), '1.0.0')).toBe(false)
  })

  it('backs up when another version opens the diary', () => {
    const { sqlite } = openMemoryDatabase()
    cleanup.push(closeMemoryDatabase)
    writeAppVersion(sqlite, '1.0.0')
    expect(needsUpgradeBackup(readDiaryVersion(sqlite), '1.0.1')).toBe(true)
    writeAppVersion(sqlite, '1.0.1')
    expect(readDiaryVersion(sqlite).lastVersion).toBe('1.0.1')
  })
})

describe('upgrade backup pruning', () => {
  it('keeps the newest five upgrade backups and never touches other safety backups', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cinediary-upgrade-backups-'))
    cleanup.push(() => rm(folder, { recursive: true, force: true }))

    const upgrades = Array.from({ length: 7 }, (_, index) =>
      upgradeBackupName(`1.0.${index}`, `1.0.${index + 1}`, new Date(Date.UTC(2026, 0, index + 1)))
    )
    const others = [
      'CineDiary-safety-2025-01-01T00-00-00-000Z.zip',
      'CineDiary-safety-2026-06-01T00-00-00-000Z.zip',
      'CineDiary-safety-2027-01-01T00-00-00-000Z.zip',
      'notes.txt'
    ]
    for (const name of [...upgrades, ...others]) await writeFile(join(folder, name), 'zip')

    const kept = await pruneUpgradeBackups(folder)

    expect(KEEP_UPGRADE_BACKUPS).toBe(5)
    expect(kept).toEqual(upgrades.slice(2))
    expect((await readdir(folder)).sort()).toEqual([...upgrades.slice(2), ...others].sort())
  })

  it('names sort by time, whatever the versions', () => {
    const older = upgradeBackupName('1.9.0', '1.10.0', new Date('2026-01-01T00:00:00Z'))
    const newer = upgradeBackupName(null, '1.2.0', new Date('2026-02-01T00:00:00Z'))
    expect([newer, older].sort()).toEqual([older, newer])
    expect(newer).toBe('CineDiary-upgrade-2026-02-01T00-00-00-000Z-earlier-to-1.2.0.zip')
  })
})
