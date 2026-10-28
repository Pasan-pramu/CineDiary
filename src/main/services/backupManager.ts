import Database from 'better-sqlite3'
import { app, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { basename, join, relative, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  closeDatabase,
  getSqlite,
  getSupportedSchemaVersion,
  initializeDatabase
} from '../db/client'
import type { BackupDone, BackupOutcome, BackupStatus, RestorePreview } from '../../shared/types'
import {
  autoBackupName,
  BackupError,
  DB_FILE,
  createBackup,
  inspectBackup,
  pruneAutoBackups,
  restoreFromStaging,
  verifyBackup,
  type BackupKind
} from './backup'
import { readSetting, writeSetting } from './settings'
import { resumeTmdbSync, suspendTmdbSync } from './tmdbBackground'
import { logError } from '../logs'
import { dataFolder } from '../dataFolder'
import { pruneUpgradeBackups, upgradeBackupName } from './versionBackup'
import { APP_NAME } from '../../shared/app'

// The app side of backups: settings, automatic backups, restore orchestration and cleanup.
// The actual zip/restore work lives in backup.ts (tested on temporary folders).

const LAST_BACKUP_AT = 'last_backup_at'
const AUTO_ENABLED = 'auto_backup_enabled'
const AUTO_FOLDER = 'auto_backup_folder'
const AUTO_DAYS = 'auto_backup_days'
/** JSON list of the auto-backup file names this feature created (the only ones it may delete). */
const AUTO_FILES = 'auto_backup_files'
const AUTO_ERROR = 'auto_backup_last_error'
const REMINDER_SNOOZED_UNTIL = 'backup_reminder_snoozed_until'

const DEFAULT_AUTO_DAYS = 7
const KEEP_AUTO_BACKUPS = 10
const KEEP_SAFETY_BACKUPS = 5
const REMIND_AFTER_DAYS = 30
const SNOOZE_DAYS = 7
const AUTO_BACKUP_DELAY_MS = 10_000
const DAY_MS = 86_400_000

/** Only one backup or restore at a time. */
let operation: 'backup' | 'restore' | 'move' | null = null
let pendingRestore: { staging: string; createdAt: string } | null = null

const dataDir = (): string => dataFolder()
const safetyDir = (): string => join(dataDir(), 'safety-backups')
const stagingDir = (): string => join(dataDir(), 'restore-staging')

function message(error: unknown): string {
  return error instanceof BackupError
    ? error.message
    : `Something went wrong: ${(error as Error).message}`
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

export function getBackupStatus(): BackupStatus {
  const lastBackupAt = readSetting(LAST_BACKUP_AT)
  const autoFolder = readSetting(AUTO_FOLDER)
  const snoozedUntil = readSetting(REMINDER_SNOOZED_UNTIL)
  const stale = !lastBackupAt || Date.now() - Date.parse(lastBackupAt) > REMIND_AFTER_DAYS * DAY_MS
  return {
    lastBackupAt,
    autoEnabled: readSetting(AUTO_ENABLED) === 'on' && autoFolder !== null,
    autoFolder,
    autoEveryDays: Number(readSetting(AUTO_DAYS)) || DEFAULT_AUTO_DAYS,
    autoFolderInsideData: autoFolder !== null && isInside(dataDir(), autoFolder),
    lastAutoError: readSetting(AUTO_ERROR),
    showReminder: stale && (!snoozedUntil || Date.parse(snoozedUntil) < Date.now())
  }
}

export function setAutoBackup(options: {
  enabled?: boolean
  everyDays?: number
  folder?: string
}): BackupStatus {
  if (options.folder !== undefined) writeSetting(AUTO_FOLDER, options.folder)
  if (options.everyDays !== undefined) writeSetting(AUTO_DAYS, String(options.everyDays))
  if (options.enabled !== undefined) writeSetting(AUTO_ENABLED, options.enabled ? 'on' : null)
  return getBackupStatus()
}

export function snoozeBackupReminder(): BackupStatus {
  writeSetting(REMINDER_SNOOZED_UNTIL, new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString())
  return getBackupStatus()
}

/** Creates and verifies a backup; only a verified backup counts as "last backup". */
async function backupTo(file: string, kind: BackupKind): Promise<BackupDone> {
  const manifest = await createBackup({
    db: getSqlite(),
    dataDir: dataDir(),
    outFile: file,
    appVersion: app.getVersion(),
    kind
  })
  const preview = await verifyBackup(
    file,
    join(dataDir(), `backup-verify-${randomUUID()}`),
    getSupportedSchemaVersion()
  ).catch(async (error: unknown) => {
    // A backup we can't read back is worse than none: remove it.
    await rm(file, { force: true })
    throw error
  })
  if (kind !== 'safety') writeSetting(LAST_BACKUP_AT, manifest.createdAt)
  return { file, createdAt: manifest.createdAt, counts: preview.counts }
}

export async function backupNow(file: string): Promise<BackupOutcome<BackupDone>> {
  if (operation) return { ok: false, message: 'A backup or restore is already running.' }
  operation = 'backup'
  try {
    return { ok: true, data: await backupTo(file, 'manual') }
  } catch (error) {
    return { ok: false, message: message(error) }
  } finally {
    operation = null
  }
}

/** On app start: makes an automatic backup when one is due. Quietly records any error. */
export async function runAutoBackupIfDue(): Promise<void> {
  const status = getBackupStatus()
  if (!status.autoEnabled || !status.autoFolder || operation) return
  const due =
    !status.lastBackupAt ||
    Date.now() - Date.parse(status.lastBackupAt) >= status.autoEveryDays * DAY_MS
  if (!due) return
  if (!existsSync(status.autoFolder)) {
    writeSetting(AUTO_ERROR, `The automatic backup folder can’t be found: ${status.autoFolder}`)
    return
  }
  operation = 'backup'
  try {
    const name = autoBackupName(new Date())
    await backupTo(join(status.autoFolder, name), 'auto')
    const created = [...readCreatedAutoBackups(), name]
    writeSetting(
      AUTO_FILES,
      JSON.stringify(await pruneAutoBackups(status.autoFolder, created, KEEP_AUTO_BACKUPS))
    )
    writeSetting(AUTO_ERROR, null)
  } catch (error) {
    logError('backup:auto', error)
    writeSetting(AUTO_ERROR, message(error))
  } finally {
    operation = null
  }
}

function readCreatedAutoBackups(): string[] {
  try {
    const value = JSON.parse(readSetting(AUTO_FILES) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((name): name is string => typeof name === 'string')
      : []
  } catch {
    return []
  }
}

export function scheduleAutoBackup(): void {
  setTimeout(() => void runAutoBackupIfDue(), AUTO_BACKUP_DELAY_MS)
}

/** Unpacks and checks a backup for the restore preview. Nothing in my data changes yet. */
export async function prepareRestore(zipPath: string): Promise<BackupOutcome<RestorePreview>> {
  if (operation) return { ok: false, message: 'A backup or restore is already running.' }
  try {
    const preview = await inspectBackup(zipPath, stagingDir(), getSupportedSchemaVersion())
    pendingRestore = { staging: stagingDir(), createdAt: preview.manifest.createdAt }
    return {
      ok: true,
      data: {
        fileName: basename(zipPath),
        createdAt: preview.manifest.createdAt,
        appVersion: preview.manifest.appVersion,
        kind: preview.manifest.kind,
        counts: preview.counts
      }
    }
  } catch (error) {
    pendingRestore = null
    return { ok: false, message: message(error) }
  }
}

export async function cancelRestore(): Promise<void> {
  pendingRestore = null
  await rm(stagingDir(), { recursive: true, force: true })
}

/** Writes last_backup_at into a staged backup's database (its snapshot predates that write). */
function recordBackupTimeIn(dbPath: string, createdAt: string): void {
  const db = new Database(dbPath)
  try {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(LAST_BACKUP_AT, createdAt)
  } finally {
    db.close()
  }
}

function safetyBackupName(): string {
  return `CineDiary-safety-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
}

/** A safety backup in <data folder>/safety-backups (the newest few are kept). Returns its path. */
async function makeSafetyBackup(): Promise<string> {
  const file = join(safetyDir(), safetyBackupName())
  await backupTo(file, 'safety')
  const safetyFiles = (await readdir(safetyDir())).filter((name) =>
    name.startsWith('CineDiary-safety-')
  )
  await pruneAutoBackups(safetyDir(), safetyFiles, KEEP_SAFETY_BACKUPS)
  return file
}

/**
 * The first start of a new version, before migrations: backs the diary up as it was (the newest
 * few upgrade backups are kept). If that fails, asks whether to quit. False = quit.
 */
export async function backupBeforeUpgrade(fromVersion: string | null): Promise<boolean> {
  try {
    const file = join(safetyDir(), upgradeBackupName(fromVersion, app.getVersion(), new Date()))
    await backupTo(file, 'safety')
    await pruneUpgradeBackups(safetyDir())
    console.info(`Backup before updating the diary: ${file}`)
    return true
  } catch (error) {
    logError('upgrade-backup', error)
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: APP_NAME,
      message: `${APP_NAME} couldn’t back up your diary before updating it.`,
      detail: `${message(error)}

Quit now (nothing has changed), or continue without a backup.`,
      buttons: ['Quit', 'Continue without backup'],
      defaultId: 0,
      cancelId: 0
    })
    return response === 1
  }
}

/**
 * Starts a data folder move: refuses while a backup or restore runs, then keeps every backup
 * and restore (manual or automatic) out until endDataMove(), and makes a safety backup first.
 */
export async function beginDataMove(): Promise<BackupOutcome<string>> {
  if (operation)
    return { ok: false, message: 'A backup or restore is running. Try again in a moment.' }
  operation = 'move'
  try {
    return { ok: true, data: await makeSafetyBackup() }
  } catch (error) {
    operation = null
    return { ok: false, message: message(error) }
  }
}

/** Backups and restores may run again (a move that failed; a finished one restarts the app). */
export function endDataMove(): void {
  if (operation === 'move') operation = null
}

/**
 * Restores the prepared backup: stops TMDB work, waits for any backup, makes a safety backup
 * of the current data, swaps the data in (rolling back on failure) and relaunches the app.
 */
export async function performRestore(): Promise<BackupOutcome> {
  const staging = pendingRestore?.staging
  if (!pendingRestore || !staging || !existsSync(staging)) {
    return { ok: false, message: 'Pick a backup to restore first.' }
  }
  if (operation) return { ok: false, message: 'A backup is running. Try again in a moment.' }
  operation = 'restore'
  let safetyFile: string | null = null
  try {
    await suspendTmdbSync()
    safetyFile = await makeSafetyBackup()

    // The restored data is exactly what this backup holds, so it counts as backed up then.
    recordBackupTimeIn(join(staging, DB_FILE), pendingRestore.createdAt)
    await restoreFromStaging({
      stagingDir: staging,
      dataDir: dataDir(),
      asideDir: join(dataDir(), `restore-previous-${Date.now()}`),
      closeDatabase,
      reopenDatabase: () => void initializeDatabase()
    })
    pendingRestore = null
    app.relaunch()
    app.exit(0)
    return { ok: true, data: null }
  } catch (error) {
    resumeTmdbSync()
    const note =
      safetyFile && existsSync(safetyFile)
        ? ` A safety backup of your data is at ${safetyFile}.`
        : ''
    return { ok: false, message: `${message(error)}${note}` }
  } finally {
    operation = null
  }
}

/** On start: removes leftovers of earlier restores and verifications (never safety backups). */
export async function cleanUpBackupLeftovers(): Promise<void> {
  for (const entry of await readdir(dataDir()).catch(() => [] as string[])) {
    if (
      entry === 'restore-staging' ||
      entry.startsWith('restore-previous-') ||
      entry.startsWith('backup-verify-')
    ) {
      await rm(join(dataDir(), entry), { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

export function getDataFolder(): string {
  return dataDir()
}

export function isInsideDataFolder(folder: string): boolean {
  return isInside(dataDir(), folder)
}
