import { app } from 'electron'
import { existsSync } from 'node:fs'
import { getSqlite } from '../db/client'
import { dataFolder, defaultDataFolder, startupLocation } from '../dataFolder'
import { logError } from '../logs'
import { beginDataMove, endDataMove, getBackupStatus, isInsideDataFolder } from './backupManager'
import { readPointer, writePointer, type DataPointer } from './dataLocation'
import { checkMoveTarget, copyDataFolder, removeDiaryItems, verifyCopy } from './dataMove'
import { resumeTmdbSync, suspendTmdbSync } from './tmdbBackground'
import type {
  BackupOutcome,
  DataLocationStatus,
  DataMoveStep,
  DataMoveTarget
} from '../../shared/types'

// "Change data folder…": pause everything, back up, freeze the database, copy, verify, switch
// the pointer, restart. If anything fails, the copy is removed and nothing changes.

let moving = false

export function isMovingData(): boolean {
  return moving
}

function userData(): string {
  return app.getPath('userData')
}

function currentPointer(): DataPointer | null {
  const location = startupLocation()
  return location.state === 'ok' ? location.pointer : null
}

export function getDataLocationStatus(): DataLocationStatus {
  const folder = dataFolder()
  const pointer = currentPointer()
  const previous = pointer?.previous && existsSync(pointer.previous) ? pointer.previous : null
  return {
    folder,
    defaultFolder: defaultDataFolder(),
    isDefault: folder === defaultDataFolder(),
    previous,
    previousAnswered: Boolean(pointer?.previousAnswered)
  }
}

/** Checks a picked folder and lists anything you should know before moving. */
export async function prepareMoveTarget(folder: string): Promise<BackupOutcome<DataMoveTarget>> {
  const check = await checkMoveTarget(dataFolder(), folder, defaultDataFolder())
  if (!check.ok) return { ok: false, message: check.message }
  const warnings: string[] = []
  const backups = getBackupStatus()
  if (backups.autoFolder && isInsideDataFolder(backups.autoFolder))
    warnings.push(
      `Automatic backups go to ${backups.autoFolder}, inside the current data folder. That folder isn’t moved; choose a new backup folder afterwards.`
    )
  return { ok: true, data: { folder: check.folder, warnings } }
}

/**
 * Moves the data to `target` and restarts. From the moment the copy starts until the restart,
 * the database is read-only (SQLite's query_only), TMDB sync is paused and backups are held,
 * so nothing can change between the copy and the switch.
 */
export async function moveDataFolder(
  target: string,
  onStep: (step: DataMoveStep) => void
): Promise<BackupOutcome> {
  if (moving) return { ok: false, message: 'Your data is already being moved.' }
  const source = dataFolder()
  const check = await checkMoveTarget(source, target, defaultDataFolder())
  if (!check.ok) return { ok: false, message: check.message }

  moving = true
  onStep('pausing')
  await suspendTmdbSync()
  onStep('safety-backup')
  const begun = await beginDataMove()
  if (!begun.ok) {
    resumeTmdbSync()
    moving = false
    return begun
  }

  const db = getSqlite()
  // From here until the restart, nothing can write to the diary.
  db.pragma('query_only = ON')
  try {
    await copyDataFolder({ db, source, target: check.folder, onStep })
    onStep('verifying')
    const problems = await verifyCopy(db, source, check.folder)
    if (problems.length) throw new Error(`The copy didn’t match: ${problems.join('; ')}`)

    writePointer(userData(), { folder: check.folder, previous: source })
    onStep('restarting')
    // A moment for the window to show "Restarting…"; the database stays frozen meanwhile.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 800)
    return { ok: true, data: null }
  } catch (error) {
    logError('dataLocation:move', error)
    // The target held no diary before (checked), so everything of ours there is the copy.
    await removeDiaryItems(check.folder).catch(() => [])
    db.pragma('query_only = OFF')
    endDataMove()
    resumeTmdbSync()
    moving = false
    return {
      ok: false,
      message: `Your data wasn’t moved and nothing changed. (${(error as Error).message})`
    }
  }
}

/** Deletes the old copy after a move: only CineDiary's own files, never anything else there. */
export async function deleteOldCopy(): Promise<BackupOutcome<string[]>> {
  const pointer = readPointer(userData())
  if (!pointer || pointer === 'unreadable' || !pointer.previous)
    return { ok: false, message: 'There is no old copy to delete.' }
  if (pointer.previous === pointer.folder)
    return { ok: false, message: 'That is your current data folder.' }
  const removed = await removeDiaryItems(pointer.previous)
  writePointer(userData(), { folder: pointer.folder })
  const location = startupLocation()
  if (location.state === 'ok') location.pointer = { folder: pointer.folder }
  return { ok: true, data: removed }
}

/** "Keep for now": don't ask again at startup (Settings → About still offers to delete it). */
export function keepOldCopy(): void {
  const pointer = readPointer(userData())
  if (!pointer || pointer === 'unreadable') return
  writePointer(userData(), { ...pointer, previousAnswered: true })
  const location = startupLocation()
  if (location.state === 'ok' && location.pointer) location.pointer.previousAnswered = true
}
