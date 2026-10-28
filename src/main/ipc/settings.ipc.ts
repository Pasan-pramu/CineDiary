import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import {
  getSettings,
  removeBannerImage,
  removeTmdbToken,
  setBannerImage,
  setDisplayName,
  setTmdbBackgroundSync,
  setTmdbToken
} from '../services/settings'
import { displayNameSchema, tmdbTokenSchema } from '../../shared/validation'
import { resolvedTheme, setAppearance } from '../services/theme'

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
  ipcMain.handle('settings:setAppearance', (_event, mode: unknown) => {
    setAppearance(z.enum(['system', 'light', 'dark']).parse(mode))
    return getSettings()
  })
  ipcMain.handle('theme:current', () => resolvedTheme())
  // The preload asks once, synchronously, before the page paints.
  ipcMain.on('theme:initial', (event) => {
    event.returnValue = resolvedTheme()
  })
  ipcMain.handle('settings:setTmdbBackgroundSync', (_event, on: unknown) =>
    setTmdbBackgroundSync(z.boolean().parse(on))
  )
}
