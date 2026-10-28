import { app, dialog, shell } from 'electron'
import { handle } from '../logs'
import { join } from 'node:path'
import { z } from 'zod'
import { getSqlite } from '../db/client'
import { BackupError, writeTextFile } from '../services/backup'
import {
  backupNow,
  cancelRestore,
  getBackupStatus,
  getDataFolder,
  performRestore,
  prepareRestore,
  setAutoBackup,
  snoozeBackupReminder
} from '../services/backupManager'
import { buildJsonExport, buildWatchesCsv } from '../services/export'
import { getLocalDate } from '../../shared/constants'
import type { BackupOutcome } from '../../shared/types'
import { APP_NAME } from '../../shared/app'

const autoSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  everyDays: z
    .union([z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)])
    .optional()
})

function documents(name: string): string {
  return join(app.getPath('documents'), name)
}

async function saveTextExport(
  defaultName: string,
  filter: Electron.FileFilter,
  build: () => string
): Promise<BackupOutcome<string>> {
  const result = await dialog.showSaveDialog({
    defaultPath: documents(defaultName),
    filters: [filter]
  })
  if (result.canceled || !result.filePath) return { ok: false, canceled: true, message: '' }
  try {
    await writeTextFile(result.filePath, build())
    return { ok: true, data: result.filePath }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BackupError
          ? error.message
          : `The export couldn’t be saved: ${(error as Error).message}`
    }
  }
}

export function registerBackupHandlers(): void {
  handle('backup:status', () => getBackupStatus())

  handle('backup:create', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: documents(`${APP_NAME}-backup-${getLocalDate()}.zip`),
      filters: [{ name: `${APP_NAME} backup`, extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true, message: '' }
    return backupNow(result.filePath)
  })

  handle('backup:chooseAutoFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for automatic backups',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return getBackupStatus()
    return setAutoBackup({ folder: result.filePaths[0], enabled: true })
  })

  handle('backup:setAuto', (_event, options: unknown) =>
    setAutoBackup(autoSettingsSchema.parse(options))
  )
  handle('backup:snoozeReminder', () => snoozeBackupReminder())

  handle('backup:pickRestore', async () => {
    const result = await dialog.showOpenDialog({
      title: `Choose a ${APP_NAME} backup`,
      defaultPath: app.getPath('documents'),
      properties: ['openFile'],
      filters: [{ name: `${APP_NAME} backup`, extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true, message: '' }
    return prepareRestore(result.filePaths[0])
  })
  handle('backup:cancelRestore', () => cancelRestore())
  handle('backup:restore', () => performRestore())

  handle('export:json', () =>
    saveTextExport(
      `${APP_NAME}-export-${getLocalDate()}.json`,
      { name: 'JSON', extensions: ['json'] },
      () => JSON.stringify(buildJsonExport(getSqlite(), app.getVersion()), null, 2)
    )
  )
  handle('export:csv', () =>
    saveTextExport(
      `${APP_NAME}-watches-${getLocalDate()}.csv`,
      { name: 'CSV', extensions: ['csv'] },
      () => buildWatchesCsv(getSqlite())
    )
  )

  handle('backup:openDataFolder', async () => {
    const error = await shell.openPath(getDataFolder())
    return error ? { ok: false, message: error } : { ok: true, data: null }
  })
  handle('backup:openBackupsFolder', async () => {
    const folder = getBackupStatus().autoFolder
    if (!folder) return { ok: false, message: 'Choose a folder for automatic backups first.' }
    const error = await shell.openPath(folder)
    return error ? { ok: false, message: error } : { ok: true, data: null }
  })
}
