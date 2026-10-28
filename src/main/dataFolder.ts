import { app } from 'electron'
import { resolveStartup, type StartupLocation } from './services/dataLocation'

// The one place that knows where CineDiary's data lives. Every path to the database, images,
// backups and logs goes through dataFolder(). Electron's userData keeps Chromium's files,
// window-state.json and the pointer file (data-location.json).

let startup: StartupLocation | null = null

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
