import { app } from 'electron'
import { join } from 'node:path'
import { resolveStartup, type StartupLocation } from './services/dataLocation'
import { DATA_FOLDER_NAME, DEV_DATA_FOLDER_NAME } from '../shared/app'

// The one place that knows where CineDiary's data lives. Every path to the database, images,
// backups and logs goes through dataFolder(). Electron's userData keeps Chromium's files,
// window-state.json and the pointer file (data-location.json).

let startup: StartupLocation | null = null

/**
 * Fixes Electron's userData folder so it never depends on the display name:
 * %APPDATA%\cinediary for the installed app, %APPDATA%\cinediary-dev when not packaged
 * (`npm run dev`, `npm start`), so development never touches the real diary.
 * A --user-data-dir switch (perf check, upgrade tests) wins. Runs before the app is ready.
 */
export function setUserDataFolder(): void {
  if (app.commandLine.hasSwitch('user-data-dir')) return
  const name = app.isPackaged ? DATA_FOLDER_NAME : DEV_DATA_FOLDER_NAME
  app.setPath('userData', join(app.getPath('appData'), name))
}

/** Reads the pointer once, at startup (before the database opens). */
export function initDataLocation(): StartupLocation {
  startup = resolveStartup(app.getPath('userData'))
  return startup
}

export function startupLocation(): StartupLocation {
  return startup ?? initDataLocation()
}

/** The default data folder: Electron's userData, where everything lived before M11b. */
export function defaultDataFolder(): string {
  return app.getPath('userData')
}

/**
 * The data folder. While the chosen folder is missing (the "Can't find your diary" screen), it
 * falls back to userData, which only the error log uses then.
 */
export function dataFolder(): string {
  const location = startupLocation()
  return location.state === 'ok' ? location.folder : defaultDataFolder()
}
