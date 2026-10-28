import Database from 'better-sqlite3'
import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import { createReadStream, createWriteStream, existsSync, type WriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { z } from 'zod'
import { APP_NAME } from '../../shared/app'

// Full backups (.zip) and restore. No Electron imports: callers pass in the open database and
// the folders, so tests can run all of this on temporary folders (see backup.test.ts).
//
// Zip layout:  manifest.json · cinediary.db · posters/ · backdrops/ · banners/

export const BACKUP_FORMAT = 'cinediary-backup'
export const BACKUP_FORMAT_VERSION = 1
export const DB_FILE = 'cinediary.db'
export const IMAGE_FOLDERS = ['posters', 'backdrops', 'banners'] as const

/** Everything a restore replaces in the data folder (nothing else is ever touched). */
const DATA_ITEMS = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, ...IMAGE_FOLDERS]

/** Extra free space we insist on, beyond the estimated size. */
const SPACE_MARGIN_BYTES = 50 * 1024 * 1024

export type BackupErrorCode =
  'not_enough_space' | 'invalid' | 'damaged' | 'unsafe_entry' | 'newer_schema' | 'busy' | 'failed'

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string
  ) {
    super(message)
  }
}

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  appVersion: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string(),
  kind: z.enum(['manual', 'auto', 'safety']),
  counts: z.object({
    titles: z.number().int().nonnegative(),
    watchEntries: z.number().int().nonnegative(),
    posters: z.number().int().nonnegative(),
    backdrops: z.number().int().nonnegative()
  })
})

export type BackupManifest = z.infer<typeof manifestSchema>
export type BackupKind = BackupManifest['kind']

// --- small helpers ---

/** Number of applied migrations: our schema version. */
export function schemaVersionOf(db: Database.Database): number {
  const table = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
    )
    .get()
  if (!table) return 0
  return (db.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n
}

function countRows(db: Database.Database, table: 'titles' | 'watch_entries'): number {
  return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
}

async function listFiles(folder: string): Promise<string[]> {
  if (!existsSync(folder)) return []
  const entries = await readdir(folder, { withFileTypes: true })
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
}

async function folderSize(folder: string): Promise<number> {
  let total = 0
  for (const name of await listFiles(folder)) total += (await stat(join(folder, name))).size
  return total
}

async function fileSize(path: string): Promise<number> {
  return existsSync(path) ? (await stat(path)).size : 0
}

/** Throws a friendly error when the disk holding `folder` can't fit `bytes` (plus a margin). */
export async function ensureFreeSpace(folder: string, bytes: number): Promise<void> {
  let free: number
  try {
    const info = await statfs(folder)
    free = info.bavail * info.bsize
  } catch {
    return // can't tell (e.g. some network drives): go ahead, errors are still caught later
  }
  if (free < bytes + SPACE_MARGIN_BYTES) {
    const needMb = Math.ceil((bytes + SPACE_MARGIN_BYTES) / 1024 / 1024)
    const freeMb = Math.floor(free / 1024 / 1024)
    throw new BackupError(
      'not_enough_space',
      `Not enough free disk space: about ${needMb} MB is needed but only ${freeMb} MB is free. Free up some space or choose another drive.`
    )
  }
}

/** Windows can briefly lock files (antivirus, indexing); retry a rename a few times. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt >= 4 || (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES')) throw error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200 * (attempt + 1)))
    }
  }
}

function waitForDrain(stream: WriteStream): Promise<void> {
  return stream.writableNeedDrain
    ? new Promise((resolveDrain) => stream.once('drain', () => resolveDrain()))
    : Promise.resolve()
}

// --- create ---

export interface CreateBackupOptions {
  /** The app's open database; a consistent snapshot is taken with SQLite's backup API. */
  db: Database.Database
  /** Folder holding posters/, backdrops/ and banners/. */
  dataDir: string
  outFile: string
  appVersion: string
  kind: BackupKind
  now?: Date
}

/** Writes a full backup. The zip only appears under its final name once it's complete. */
export async function createBackup(options: CreateBackupOptions): Promise<BackupManifest> {
  const { db, dataDir, outFile } = options
  const outDir = dirname(outFile)
  await mkdir(outDir, { recursive: true })

  // Estimate: database (+ WAL) twice (snapshot + zip) plus the images.
  const dbBytes = (await fileSize(db.name)) + (await fileSize(`${db.name}-wal`))
  let imageBytes = 0
  for (const folder of IMAGE_FOLDERS) imageBytes += await folderSize(join(dataDir, folder))
  await ensureFreeSpace(outDir, dbBytes * 2 + imageBytes)

  const snapshot = `${outFile}.db-snapshot`
  const partial = `${outFile}.partial`
  try {
    await db.backup(snapshot)
    // The copy inherits WAL mode; switch it to a plain single file so nothing sits beside it.
    const snapshotDb = new Database(snapshot)
    snapshotDb.pragma('journal_mode = DELETE')
    let manifest: BackupManifest
    try {
      manifest = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        appVersion: options.appVersion,
        schemaVersion: schemaVersionOf(snapshotDb),
        createdAt: (options.now ?? new Date()).toISOString(),
        kind: options.kind,
        counts: {
          titles: countRows(snapshotDb, 'titles'),
          watchEntries: countRows(snapshotDb, 'watch_entries'),
          posters: (await listFiles(join(dataDir, 'posters'))).length,
          backdrops: (await listFiles(join(dataDir, 'backdrops'))).length
        }
      }
    } finally {
      snapshotDb.close()
    }

    await writeZip(partial, dataDir, snapshot, manifest)
    await renameWithRetry(partial, outFile)
    return manifest
  } catch (error) {
    await rm(partial, { force: true })
    if (error instanceof BackupError) throw error
    if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
      throw new BackupError(
        'not_enough_space',
        'The disk ran out of space while writing the backup.'
      )
    }
    throw new BackupError('failed', `The backup could not be written: ${(error as Error).message}`)
  } finally {
    for (const file of [snapshot, `${snapshot}-wal`, `${snapshot}-shm`])
      await rm(file, { force: true })
  }
}

async function writeZip(
  zipPath: string,
  dataDir: string,
  snapshotPath: string,
  manifest: BackupManifest
): Promise<void> {
  const out = createWriteStream(zipPath)
  let failure: Error | null = null
  const finished = new Promise<void>((resolveWrite, rejectWrite) => {
    out.on('finish', resolveWrite)
    out.on('error', rejectWrite)
  })
  const zip = new Zip((error, chunk, final) => {
    if (error) failure = error
    else out.write(chunk)
    if (final) out.end()
  })

  const addBytes = (name: string, bytes: Uint8Array): void => {
    const entry = new ZipDeflate(name, { level: 6 })
    zip.add(entry)
    entry.push(bytes, true)
  }
  const addFile = async (name: string, path: string, compress: boolean): Promise<void> => {
    const entry = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
    zip.add(entry)
    for await (const chunk of createReadStream(path)) {
      entry.push(chunk as Uint8Array)
      await waitForDrain(out)
      if (failure) throw failure
    }
    entry.push(new Uint8Array(0), true)
  }

  // The manifest goes first so a preview only has to read the start of the zip.
  addBytes('manifest.json', new TextEncoder().encode(JSON.stringify(manifest, null, 2)))
  await addFile(DB_FILE, snapshotPath, true)
  // Images are already compressed (JPG/PNG/WebP), so they're stored as-is.
  for (const folder of IMAGE_FOLDERS) {
    for (const name of await listFiles(join(dataDir, folder))) {
      await addFile(`${folder}/${name}`, join(dataDir, folder, name), false)
    }
  }
  zip.end()
  await finished
  if (failure) throw failure
}

// --- read / validate ---

/**
 * Zip-slip protection: only the expected layout is accepted, and every path must stay inside
 * the target folder. Returns null for folder entries ("posters/") that need no file.
 */
export function safeEntryPath(targetDir: string, name: string): string | null {
  const unsafe = (): never => {
    throw new BackupError(
      'unsafe_entry',
      `The backup contains an unexpected file (“${name}”), so it wasn’t used.`
    )
  }
  if (!name || isAbsolute(name) || name.includes('\\') || /^[a-zA-Z]:/.test(name)) unsafe()
  if (name.split('/').some((part) => part === '..' || part === '.')) unsafe()
  const folderEntry = IMAGE_FOLDERS.some((folder) => name === `${folder}/`)
  if (folderEntry) return null
  const allowed =
    name === 'manifest.json' ||
    name === DB_FILE ||
    IMAGE_FOLDERS.some((folder) => new RegExp(`^${folder}/[A-Za-z0-9_.-]+$`).test(name))
  if (!allowed) unsafe()
  const root = resolve(targetDir)
  const path = resolve(root, name)
  if (!path.startsWith(root + sep)) unsafe()
  return path
}

/** Streams a backup zip into `targetDir`, rejecting anything outside the expected layout. */
async function extractBackup(zipPath: string, targetDir: string): Promise<void> {
  // The only folders a backup may contain exist up front, so each file can be written at once.
  for (const folder of IMAGE_FOLDERS) await mkdir(join(targetDir, folder), { recursive: true })
  const writes: Array<Promise<void>> = []
  // Held in an object because it's set inside fflate's callbacks.
  const state: { current: WriteStream | null } = { current: null }
  let openEntries = 0
  let failure: Error | null = null

  const unzip = new Unzip((file) => {
    let path: string | null
    try {
      path = safeEntryPath(targetDir, file.name)
    } catch (error) {
      failure ??= error as Error
      return // never started, so its data is skipped
    }
    if (path === null) return
    const stream = createWriteStream(path)
    state.current = stream
    openEntries++
    writes.push(
      new Promise<void>((resolveFile, rejectFile) => {
        stream.on('finish', () => resolveFile())
        stream.on('error', rejectFile)
      })
    )
    file.ondata = (error, data, final) => {
      if (error) {
        failure ??= error
        stream.destroy()
        return
      }
      stream.write(data)
      if (final) {
        openEntries--
        stream.end()
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)

  try {
    for await (const chunk of createReadStream(zipPath)) {
      unzip.push(chunk as Uint8Array)
      if (failure) throw failure
      if (state.current) await waitForDrain(state.current)
    }
    unzip.push(new Uint8Array(0), true)
    if (failure) throw failure
    // A cut-off zip leaves a file without its end: close it so we don't wait forever.
    if (openEntries > 0) state.current?.end()
    await Promise.all(writes)
  } catch (error) {
    if (error instanceof BackupError) throw error
    throw new BackupError('damaged', 'This backup file is damaged and can’t be read.')
  }
  if (openEntries > 0) {
    throw new BackupError('damaged', 'This backup file is incomplete (it may have been cut off).')
  }
}

export interface BackupPreview {
  manifest: BackupManifest
  /** Counted from the backup's database itself. */
  counts: BackupManifest['counts']
}

/**
 * Extracts a backup into `stagingDir` and checks it: manifest, database integrity and schema
 * version. Throws a BackupError (and removes the staging folder) when it can't be used.
 */
export async function inspectBackup(
  zipPath: string,
  stagingDir: string,
  supportedSchemaVersion: number
): Promise<BackupPreview> {
  try {
    await ensureFreeSpace(dirname(stagingDir), (await fileSize(zipPath)) * 2)
    await rm(stagingDir, { recursive: true, force: true })
    await extractBackup(zipPath, stagingDir)

    const manifestPath = join(stagingDir, 'manifest.json')
    if (!existsSync(manifestPath) || !existsSync(join(stagingDir, DB_FILE))) {
      throw new BackupError('invalid', `This file isn’t a ${APP_NAME} backup.`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch {
      throw new BackupError('invalid', 'This backup’s description (manifest) can’t be read.')
    }
    const manifest = manifestSchema.safeParse(parsed)
    if (!manifest.success) throw new BackupError('invalid', `This file isn’t a ${APP_NAME} backup.`)
    if (manifest.data.formatVersion > BACKUP_FORMAT_VERSION) {
      throw new BackupError(
        'newer_schema',
        `This backup was made by a newer version of ${APP_NAME}. Update the app first.`
      )
    }

    let db: Database.Database | null = null
    try {
      db = new Database(join(stagingDir, DB_FILE), { readonly: true, fileMustExist: true })
      const check = db.pragma('integrity_check', { simple: true })
      if (check !== 'ok')
        throw new BackupError('damaged', 'The database inside this backup is damaged.')
      const schema = Math.max(schemaVersionOf(db), manifest.data.schemaVersion)
      if (schema > supportedSchemaVersion) {
        throw new BackupError(
          'newer_schema',
          `This backup was made by a newer version of ${APP_NAME}. Update the app first, then restore it.`
        )
      }
      return {
        manifest: manifest.data,
        counts: {
          titles: countRows(db, 'titles'),
          watchEntries: countRows(db, 'watch_entries'),
          posters: (await listFiles(join(stagingDir, 'posters'))).length,
          backdrops: (await listFiles(join(stagingDir, 'backdrops'))).length
        }
      }
    } catch (error) {
      if (error instanceof BackupError) throw error
      throw new BackupError('damaged', 'The database inside this backup is damaged.')
    } finally {
      db?.close()
    }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  }
}

/** Reopens a finished backup and checks it like a restore would (then cleans up). */
export async function verifyBackup(
  zipPath: string,
  workDir: string,
  supportedSchemaVersion: number
): Promise<BackupPreview> {
  try {
    return await inspectBackup(zipPath, workDir, supportedSchemaVersion)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

// --- restore ---

export interface RestoreOptions {
  stagingDir: string
  dataDir: string
  /** Where the current files are moved aside (inside dataDir, removed on next start). */
  asideDir: string
  closeDatabase: () => void
  /** Used to get the app working again when a restore has to roll back. */
  reopenDatabase: () => void
  /** Tests only: called after the swap, before the final check. */
  afterSwap?: () => void
}

/**
 * Swaps the staged backup in. Only the database files and image folders are moved; anything
 * else in the data folder (safety backups, staging, temp posters, settings) is never touched.
 * If any step fails, the original files are moved back.
 */
export async function restoreFromStaging(options: RestoreOptions): Promise<void> {
  const { stagingDir, dataDir, asideDir } = options
  const movedAside: string[] = []
  const placed: string[] = []
  options.closeDatabase()
  try {
    await mkdir(asideDir, { recursive: true })
    for (const item of DATA_ITEMS) {
      if (!existsSync(join(dataDir, item))) continue
      await renameWithRetry(join(dataDir, item), join(asideDir, item))
      movedAside.push(item)
    }
    for (const item of [DB_FILE, ...IMAGE_FOLDERS]) {
      if (!existsSync(join(stagingDir, item))) continue
      await renameWithRetry(join(stagingDir, item), join(dataDir, item))
      placed.push(item)
    }
    options.afterSwap?.()
    const db = new Database(join(dataDir, DB_FILE), { fileMustExist: true })
    try {
      if (db.pragma('integrity_check', { simple: true }) !== 'ok') {
        throw new Error('The restored database failed its integrity check.')
      }
    } finally {
      db.close()
    }
  } catch (error) {
    // Roll back: remove what we placed, put the originals back, reopen.
    try {
      for (const item of placed) await rm(join(dataDir, item), { recursive: true, force: true })
      for (const item of movedAside)
        await renameWithRetry(join(asideDir, item), join(dataDir, item))
      await rm(asideDir, { recursive: true, force: true })
    } finally {
      options.reopenDatabase()
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOSPC') {
      throw new BackupError(
        'not_enough_space',
        'Not enough disk space to restore. Your data was not changed.'
      )
    }
    throw new BackupError(
      'failed',
      `The restore didn’t complete, so your data was put back as it was. (${(error as Error).message})`
    )
  }
}

// --- automatic backups ---

/**
 * Keeps the newest `keep` auto-backups. Only files listed in `created` (the ones this feature
 * made) are ever deleted. Returns the updated list.
 */
export async function pruneAutoBackups(
  folder: string,
  created: string[],
  keep: number
): Promise<string[]> {
  const present = created.filter((name) => existsSync(join(folder, name)))
  const sorted = [...present].sort() // names contain the date and time, so this is oldest-first
  const remove = sorted.slice(0, Math.max(0, sorted.length - keep))
  for (const name of remove) await rm(join(folder, name), { force: true })
  return sorted.slice(remove.length)
}

/** e.g. "CineDiary-auto-2026-10-27-0930.zip" (local time). A fixed prefix, never the display name. */
export function autoBackupName(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `CineDiary-auto-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`
}

/** Writes JSON/CSV exports safely (to a temp name first). */
export async function writeTextFile(path: string, text: string): Promise<void> {
  await ensureFreeSpace(dirname(path), Buffer.byteLength(text))
  await writeFile(`${path}.partial`, text, 'utf8')
  await renameWithRetry(`${path}.partial`, path)
}
