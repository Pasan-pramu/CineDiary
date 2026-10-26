import { ipcMain } from 'electron'
import { z } from 'zod'
import { listWatchEntries } from '../services/watchEntries'

const titleIdSchema = z.number().int().positive().optional()

export function registerWatchEntryHandlers(): void {
  ipcMain.handle('watchEntries:list', (_event, titleId: unknown) =>
    listWatchEntries(titleIdSchema.parse(titleId))
  )
}
