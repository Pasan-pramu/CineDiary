import { ipcMain } from 'electron'
import { z } from 'zod'
import { deleteTitle, getTitle, listTitles } from '../services/titles'

const idSchema = z.number().int().positive()

export function registerTitleHandlers(): void {
  ipcMain.handle('titles:list', () => listTitles())
  ipcMain.handle('titles:get', (_event, id: unknown) => getTitle(idSchema.parse(id)) ?? null)
  ipcMain.handle('titles:delete', (_event, id: unknown) => {
    deleteTitle(idSchema.parse(id))
  })
}
