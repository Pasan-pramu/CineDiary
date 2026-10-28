import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { defaultDataFolder, startupLocation } from '../dataFolder'
import { handle } from '../logs'
import { holdsDiary, removePointer, writePointer } from '../services/dataLocation'
import {
  deleteOldCopy,
  getDataLocationStatus,
  keepOldCopy,
  moveDataFolder,
  prepareMoveTarget
} from '../services/dataMoveManager'
import { resolvedTheme } from '../services/theme'
import type { BackupOutcome, DataStartup } from '../../shared/types'

function restart(): void {
  app.relaunch()
  app.exit(0)
}

function startupState(): DataStartup {
  const location = startupLocation()
  if (location.state === 'ok') return { state: 'ok' }
  if (location.state === 'missing')
    return { state: 'missing', folder: location.folder, defaultFolder: defaultDataFolder() }
  return { state: 'unreadable', defaultFolder: defaultDataFolder() }
}

/**
 * Registered in every mode, including the "Can't find your diary" screen (no database open).
 */
export function registerDataStartupHandlers(withoutDatabase: boolean): void {
  // Synchronous: the preload needs it before the page renders.
  ipcMain.on('dataLocation:startup', (event) => {
    event.returnValue = startupState()
  })
  if (withoutDatabase) {
    // The settings handlers aren't registered without a database; the theme follows Windows.
    ipcMain.on('theme:initial', (event) => {
      event.returnValue = resolvedTheme()
    })
  }
  handle('dataLocation:retry', () => restart())
  handle('dataLocation:useDefault', () => {
    removePointer(app.getPath('userData'))
    restart()
  })
  // Only a folder that already holds a diary (e.g. the drive came back as another letter).
  handle('dataLocation:chooseExisting', async (event): Promise<BackupOutcome> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Find your CineDiary data folder',
      properties: ['openDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return { ok: false, canceled: true, message: '' }
    if (!holdsDiary(folder))
      return {
        ok: false,
        message: 'That folder doesn’t hold a CineDiary diary (no cinediary.db in it).'
      }
    writePointer(app.getPath('userData'), { folder })
    restart()
    return { ok: true, data: null }
  })
}

/** "Change data folder…" and the old copy after a move (needs the database). */
export function registerDataLocationHandlers(): void {
  handle('dataLocation:status', () => getDataLocationStatus())
  handle('dataLocation:chooseTarget', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a new, empty folder for your CineDiary data',
      properties: ['openDirectory', 'createDirectory', 'promptToCreate']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const folder = result.filePaths[0]
    if (result.canceled || !folder) return { ok: false, canceled: true, message: '' }
    return prepareMoveTarget(folder)
  })
  handle('dataLocation:move', (event, folder: unknown) =>
    moveDataFolder(z.string().min(1).max(1000).parse(folder), (step) => {
      if (!event.sender.isDestroyed()) event.sender.send('dataLocation:progress', step)
    })
  )
  handle('dataLocation:deleteOld', () => deleteOldCopy())
  handle('dataLocation:keepOld', () => keepOldCopy())
}
