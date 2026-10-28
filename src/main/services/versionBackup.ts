import type Database from 'better-sqlite3'
import { readdir } from 'node:fs/promises'
import { pruneAutoBackups } from './backup'

// The first start of a new app version backs the diary up before any migration runs.
// These backups sit in <data folder>/safety-backups next to the restore/move safety backups,
// with their own prefix and their own limit, so neither kind ever prunes the other.
// No Electron imports, so it can be tested (versionBackup.test.ts); backupManager makes the zip.

/** Fixed: pruning matches on it, so it never follows the display name. */
export const UPGRADE_BACKUP_PREFIX = 'CineDiary-upgrade-'
export const KEEP_UPGRADE_BACKUPS = 5
/** The settings key holding the version that last opened this diary. */
export const LAST_APP_VERSION = 'last_app_version'

export interface DiaryVersion {
  /** False for a brand-new database (no migrations have ever run on it). */
  hasDiary: boolean
  /** The app version that last opened it; null before M12 or for a new diary. */
  lastVersion: string | null
}

/** Reads, before migrations run, whether this is an existing diary and which version last used it. */
export function readDiaryVersion(db: Database.Database): DiaryVersion {
  const table = (name: string): boolean =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !==
    undefined
  if (!table('__drizzle_migrations')) return { hasDiary: false, lastVersion: null }
  if (!table('settings')) return { hasDiary: true, lastVersion: null }
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(LAST_APP_VERSION) as
    { value: string | null } | undefined
  return { hasDiary: true, lastVersion: row?.value ?? null }
}

/** Records the version that opened the diary (after migrations). */
export function writeAppVersion(db: Database.Database, version: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(LAST_APP_VERSION, version)
}

/** An existing diary opened by a different version than last time (upgrade or downgrade). */
export function needsUpgradeBackup(diary: DiaryVersion, currentVersion: string): boolean {
  return diary.hasDiary && diary.lastVersion !== currentVersion
}

/** e.g. "CineDiary-upgrade-2026-10-28T17-20-05-123Z-1.0.0-to-1.0.1.zip": time first, so it sorts. */
export function upgradeBackupName(from: string | null, to: string, date: Date): string {
  const time = date.toISOString().replace(/[:.]/g, '-')
  return `${UPGRADE_BACKUP_PREFIX}${time}-${from ?? 'earlier'}-to-${to}.zip`
}

/** Keeps the newest few upgrade backups in `folder`; other files are never touched. */
export async function pruneUpgradeBackups(
  folder: string,
  keep = KEEP_UPGRADE_BACKUPS
): Promise<string[]> {
  const names = (await readdir(folder)).filter(
    (name) => name.startsWith(UPGRADE_BACKUP_PREFIX) && name.endsWith('.zip')
  )
  return pruneAutoBackups(folder, names, keep)
}
