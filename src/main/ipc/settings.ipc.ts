import { dialog, ipcMain } from 'electron'
import {
  getSettings,
  removeBannerImage,
  removeTmdbToken,
  setBannerImage,
  setDisplayName,
  setTmdbToken
} from '../services/settings'
import { displayNameSchema, tmdbTokenSchema } from '../../shared/validation'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:setDisplayName', (_event, name: unknown) =>
    setDisplayName(displayNameSchema.parse(name))
  )
  ipcMain.handle('settings:pickBanner', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    return result.canceled || !result.filePaths[0]
      ? getSettings()
      : setBannerImage(result.filePaths[0])
  })
  ipcMain.handle('settings:removeBanner', () => removeBannerImage())
  ipcMain.handle('settings:setTmdbToken', (_event, token: unknown) =>
    setTmdbToken(tmdbTokenSchema.parse(token))
  )
  ipcMain.handle('settings:removeTmdbToken', () => removeTmdbToken())
}
