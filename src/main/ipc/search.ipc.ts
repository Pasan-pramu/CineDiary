import { app, ipcMain } from 'electron'
import { z } from 'zod'
import { globalSearch } from '../services/search'
import type { AppInfo } from '../../shared/types'

export function registerSearchHandlers(): void {
  ipcMain.handle('search:global', (_event, text: unknown) =>
    globalSearch(z.string().max(200).parse(text))
  )
  ipcMain.handle('app:info', (): AppInfo => ({
    version: app.getVersion(),
    dataFolder: app.getPath('userData')
  }))
}
