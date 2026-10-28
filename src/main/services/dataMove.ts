import Database from 'better-sqlite3'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { cp, mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { DATA_ITEMS, DB_FILE, isCineDiaryItem } from './dataLocation'
import { APP_NAME } from '../../shared/app'

// Moving the data folder: check the target, copy everything, verify the copy, and (after you
// confirm) delete the old copy. No Electron imports, so it can be tested on temporary folders.

/** The folders a move copies (the database is copied separately with SQLite's backup API). */
export const COPIED_FOLDERS = DATA_ITEMS.filter((item) => !item.startsWith(DB_FILE))

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

export type TargetCheck = { ok: true; folder: string } | { ok: false; message: string }

/**
 * Can the data move to `target`? It must be a new or empty folder (the default location may
 * hold Electron's own files, but no diary), outside the current data folder, and writable.
 */
export async function checkMoveTarget(
  source: string,
  target: string,
  defaultFolder: string
): Promise<TargetCheck> {
  const from = resolve(source)
  const to = resolve(target)
  if (from.toLowerCase() === to.toLowerCase())
    return { ok: false, message: 'Your data is already in this folder.' }
  if (isInside(from, to))
    return { ok: false, message: 'Pick a folder outside the current data folder.' }
  if (existsSync(to)) {
    if (!statSync(to).isDirectory()) return { ok: false, message: 'That is a file, not a folder.' }
    const entries = readdirSync(to)
    const isDefault = to.toLowerCase() === resolve(defaultFolder).toLowerCase()
    if (entries.some(isCineDiaryItem))
      return {
        ok: false,
        message: `That folder already holds ${APP_NAME} data. Pick an empty one.`
      }
    if (entries.length > 0 && !isDefault)
      return { ok: false, message: 'Pick an empty folder (or make a new one).' }
  }
  try {
    await mkdir(to, { recursive: true })
    const probe = join(to, '.cinediary-write-test')
    await writeFile(probe, 'ok')
    await unlink(probe)
  } catch {
    return { ok: false, message: `${APP_NAME} can’t write to that folder.` }
  }
  return { ok: true, folder: to }
}

export type MoveStep = 'copying-database' | 'copying-images' | 'verifying'

/**
 * Copies the diary into `target`: the database through SQLite's backup API (a consistent copy
 * of the open database, WAL included), then the image, backup and log folders.
 */
export async function copyDataFolder(options: {
  db: Database.Database
  source: string
  target: string
  onStep?: (step: MoveStep) => void
}): Promise<void> {
  const { db, source, target, onStep } = options
  await mkdir(target, { recursive: true })
  onStep?.('copying-database')
  await db.backup(join(target, DB_FILE))
  onStep?.('copying-images')
  for (const folder of COPIED_FOLDERS) {
    const from = join(source, folder)
    if (existsSync(from)) await cp(from, join(target, folder), { recursive: true })
  }
}

interface FolderSummary {
  files: number
  bytes: number
}

async function summarize(folder: string): Promise<FolderSummary> {
  if (!existsSync(folder)) return { files: 0, bytes: 0 }
  let files = 0
  let bytes = 0
  for (const entry of await readdir(folder, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue
    files++
    bytes += (await stat(join(entry.parentPath, entry.name))).size
  }
  return { files, bytes }
}

function tableCounts(db: Database.Database): Map<string, number> {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all() as Array<{ name: string }>
  return new Map(
    tables.map(({ name }) => [
      name,
      (db.prepare(`SELECT count(*) AS n FROM "${name.replace(/"/g, '""')}"`).get() as { n: number })
        .n
    ])
  )
}

/**
 * Checks the copy against the original: the copied database opens and passes its integrity
 * check, every table has the same number of rows, and every folder the same files and bytes.
 * Returns what differs (empty = verified).
 */
export async function verifyCopy(
  db: Database.Database,
  source: string,
  target: string
): Promise<string[]> {
  const problems: string[] = []
  let copy: Database.Database | null = null
  try {
    copy = new Database(join(target, DB_FILE), { readonly: true, fileMustExist: true })
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok')
      problems.push('The copied database failed its integrity check.')
    const expected = tableCounts(db)
    const actual = tableCounts(copy)
    for (const [table, count] of expected) {
      if (actual.get(table) !== count)
        problems.push(`${table}: ${count} rows, but ${actual.get(table) ?? 'none'} in the copy`)
    }
    for (const table of actual.keys()) {
      if (!expected.has(table)) problems.push(`${table}: only in the copy`)
    }
  } catch (error) {
    problems.push(`The copied database can’t be opened (${(error as Error).message}).`)
  } finally {
    copy?.close()
  }
  for (const folder of COPIED_FOLDERS) {
    const before = await summarize(join(source, folder))
    const after = await summarize(join(target, folder))
    if (before.files !== after.files || before.bytes !== after.bytes)
      problems.push(
        `${folder}: ${before.files} files (${before.bytes} bytes), but ${after.files} (${after.bytes} bytes) in the copy`
      )
  }
  return problems
}

/**
 * Removes CineDiary's own files and folders from `folder` (after a move, or to clean up a
 * failed copy). Anything else there, such as Electron's files in the default location, is left
 * alone. Returns the names it removed.
 */
export async function removeDiaryItems(folder: string): Promise<string[]> {
  if (!existsSync(folder)) return []
  const removed: string[] = []
  for (const name of await readdir(folder)) {
    if (!isCineDiaryItem(name)) continue
    await rm(join(folder, name), { recursive: true, force: true })
    removed.push(name)
  }
  return removed.sort()
}
