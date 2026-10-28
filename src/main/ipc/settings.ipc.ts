import { dialog, ipcMain } from 'electron'
import { handle } from '../logs'
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
  handle('settings:get', () => getSettings())
  handle('settings:setDisplayName', (_event, name: unknown) =>
    setDisplayName(displayNameSchema.parse(name))
  )
  handle('settings:pickBanner', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    return result.canceled || !result.filePaths[0]
      ? getSettings()
      : setBannerImage(result.filePaths[0])
  })
  handle('settings:removeBanner', () => removeBannerImage())
  handle('settings:setTmdbToken', (_event, token: unknown) =>
    setTmdbToken(tmdbTokenSchema.parse(token))
  )
  handle('settings:removeTmdbToken', () => removeTmdbToken())
  handle('settings:setAppearance', (_event, mode: unknown) => {
    setAppearance(z.enum(['system', 'light', 'dark']).parse(mode))
    return getSettings()
  })
  handle('theme:current', () => resolvedTheme())
  // The preload asks once, synchronously, before the page paints.
  ipcMain.on('theme:initial', (event) => {
    event.returnValue = resolvedTheme()
  })
  handle('settings:setTmdbBackgroundSync', (_event, on: unknown) =>
    setTmdbBackgroundSync(z.boolean().parse(on))
  )
}
