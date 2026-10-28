import { BrowserWindow, nativeTheme } from 'electron'
import { THEME_BACKGROUND, type AppearanceMode, type ResolvedTheme } from '../../shared/theme'
import { getAppearance, saveAppearance } from './settings'

// Light / dark / system. nativeTheme.themeSource makes Windows' title bar and native menus
// follow too; "system" then tracks Windows' setting live.

export function resolvedTheme(): ResolvedTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

/** Pushes the current theme to every window (page + window background). */
function broadcast(): void {
  const theme = resolvedTheme()
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(THEME_BACKGROUND[theme])
    window.webContents.send('theme:changed', theme)
  }
}

/** Applies the saved appearance; call once before creating the first window. */
export function initTheme(): void {
  nativeTheme.themeSource = getAppearance()
  nativeTheme.on('updated', broadcast)
}

export function setAppearance(mode: AppearanceMode): void {
  saveAppearance(mode)
  nativeTheme.themeSource = mode
  broadcast()
}
