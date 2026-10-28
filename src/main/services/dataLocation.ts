import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

// Where CineDiary keeps its data. Electron's userData folder (on C:) always holds Chromium's own
// files, window-state.json and this pointer file; the data itself (database, images, backups,
// logs) lives in the "data folder", which is userData unless the pointer says otherwise.
// No Electron imports, so it can be tested; main/dataFolder.ts supplies userData.

export const POINTER_FILE = 'data-location.json'
export const DB_FILE = 'cinediary.db'

/** Everything that belongs to a diary in its data folder (what a move copies). */
export const DATA_ITEMS = [
  DB_FILE,
  `${DB_FILE}-wal`,
  `${DB_FILE}-shm`,
  'posters',
  'backdrops',
  'banners',
  'safety-backups',
  'logs'
] as const

/** Temporary folders CineDiary makes in its data folder (never copied, removed with the rest). */
const TEMP_PREFIXES = ['posters-temp', 'restore-staging', 'restore-previous-', 'backup-verify-']

/** True for a file or folder name that CineDiary owns inside a data folder. */
export function isCineDiaryItem(name: string): boolean {
  return (
    (DATA_ITEMS as readonly string[]).includes(name) ||
    TEMP_PREFIXES.some((prefix) => name.startsWith(prefix))
  )
}

export interface DataPointer {
  /** The chosen data folder (absolute). */
  folder: string
  /** The folder the data was moved from, until you delete or keep it. */
  previous?: string | null
  /** You've answered "delete the old copy?" (Keep for now); Settings still offers it. */
  previousAnswered?: boolean
}

export type StartupLocation =
  | { state: 'ok'; folder: string; pointer: DataPointer | null }
  /** The pointer names a folder without a diary in it (drive unplugged, folder renamed…). */
  | { state: 'missing'; folder: string }
  /** The pointer file can't be read; we don't guess. */
  | { state: 'unreadable'; folder: null }

function isPointer(value: unknown): value is DataPointer {
  if (!value || typeof value !== 'object') return false
  const pointer = value as Record<string, unknown>
  return (
    typeof pointer['folder'] === 'string' &&
    isAbsolute(pointer['folder']) &&
    (pointer['previous'] === undefined ||
      pointer['previous'] === null ||
      (typeof pointer['previous'] === 'string' && isAbsolute(pointer['previous']))) &&
    (pointer['previousAnswered'] === undefined || typeof pointer['previousAnswered'] === 'boolean')
  )
}

/** The pointer, null when there is none, or "unreadable" when it's damaged. */
export function readPointer(userData: string): DataPointer | null | 'unreadable' {
  const file = join(userData, POINTER_FILE)
  if (!existsSync(file)) return null
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return isPointer(value) ? value : 'unreadable'
  } catch {
    return 'unreadable'
  }
}

/** Writes the pointer in one step (temp file + rename), so it's never half-written. */
export function writePointer(userData: string, pointer: DataPointer): void {
  const file = join(userData, POINTER_FILE)
  const temp = `${file}.tmp`
  writeFileSync(temp, JSON.stringify(pointer, null, 2), 'utf8')
  renameSync(temp, file)
}

/** Back to the default location (userData). */
export function removePointer(userData: string): void {
  rmSync(join(userData, POINTER_FILE), { force: true })
}

/** True when `folder` is a folder holding a CineDiary database. */
export function holdsDiary(folder: string): boolean {
  try {
    return statSync(folder).isDirectory() && statSync(join(folder, DB_FILE)).isFile()
  } catch {
    return false
  }
}

/**
 * Decides where the data is at startup. No pointer: the default folder, exactly as before.
 * A pointer to a folder without a diary is "missing": the app shows a screen instead of
 * quietly creating an empty database there.
 */
export function resolveStartup(userData: string): StartupLocation {
  const pointer = readPointer(userData)
  if (pointer === null) return { state: 'ok', folder: userData, pointer: null }
  if (pointer === 'unreadable') return { state: 'unreadable', folder: null }
  if (!holdsDiary(pointer.folder)) return { state: 'missing', folder: pointer.folder }
  return { state: 'ok', folder: pointer.folder, pointer }
}
