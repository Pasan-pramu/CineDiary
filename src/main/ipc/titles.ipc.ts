import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { createTitle, deleteTitle, getTitle, listGenres, listTitles } from '../services/titles'
import { preparePoster } from '../services/posters'
import { createTitleSchema } from '../../shared/validation'

const idSchema = z.number().int().positive()

export function registerTitleHandlers(): void {
  ipcMain.handle('titles:list', () => listTitles())
  ipcMain.handle('titles:get', (_event, id: unknown) => getTitle(idSchema.parse(id)) ?? null)
  ipcMain.handle('titles:delete', (_event, id: unknown) => {
    deleteTitle(idSchema.parse(id))
  })
  ipcMain.handle('titles:listGenres', () => listGenres())
  ipcMain.handle('titles:create', (_event, input: unknown) =>
    createTitle(createTitleSchema.parse(input))
  )
  ipcMain.handle('posters:pick', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    return result.canceled || !result.filePaths[0] ? null : preparePoster(result.filePaths[0])
  })
  ipcMain.handle('posters:prepare', (_event, filePath: unknown) =>
    preparePoster(z.string().min(1).parse(filePath))
  )
}
