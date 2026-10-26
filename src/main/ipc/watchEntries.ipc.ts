import { ipcMain } from 'electron'
import { listWatchEntries } from '../services/watchEntries'
import {
  createPastWatch,
  createReason,
  deleteWatch,
  finishWatch,
  incrementEpisodes,
  startWatch,
  updateWatch,
  listReasons
} from '../services/watchEntries'
import { watchEntryInputSchema } from '../../shared/validation'
import { z } from 'zod'

const titleIdSchema = z.number().int().positive().optional()

export function registerWatchEntryHandlers(): void {
  ipcMain.handle('watchEntries:list', (_event, titleId: unknown) =>
    listWatchEntries(titleIdSchema.parse(titleId))
  )
  ipcMain.handle('watchEntries:start', (_event, input: unknown) =>
    startWatch(watchEntryInputSchema.parse(input))
  )
  ipcMain.handle('watchEntries:finish', (_event, input: unknown) =>
    finishWatch(watchEntryInputSchema.extend({ id: z.number().int().positive() }).parse(input))
  )
  ipcMain.handle('watchEntries:create', (_event, input: unknown) =>
    createPastWatch(watchEntryInputSchema.parse(input))
  )
  ipcMain.handle('watchEntries:update', (_event, input: unknown) =>
    updateWatch(watchEntryInputSchema.extend({ id: z.number().int().positive() }).parse(input))
  )
  ipcMain.handle('watchEntries:delete', (_event, id: unknown) =>
    deleteWatch(z.number().int().positive().parse(id))
  )
  ipcMain.handle('watchEntries:incrementEpisodes', (_event, id: unknown) =>
    incrementEpisodes(z.number().int().positive().parse(id))
  )
  ipcMain.handle('reasons:list', () => listReasons())
  ipcMain.handle('reasons:create', (_event, label: unknown) =>
    createReason(z.string().trim().min(1).parse(label))
  )
}
