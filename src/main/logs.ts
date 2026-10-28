import { ipcMain } from 'electron'
import { join } from 'node:path'
import { writeErrorLog } from './services/errorLog'
import { dataFolder } from './dataFolder'

/** <data folder>/logs: where the error log lives (Settings → About opens it). */
export function logsFolder(): string {
  return join(dataFolder(), 'logs')
}

/** Writes an error to the local log. Logging must never throw, so failures go to the console. */
export function logError(source: string, error: unknown): void {
  try {
    writeErrorLog(logsFolder(), source, error)
  } catch (failure) {
    console.error('Could not write the error log', failure)
  }
  console.error(`[${source}]`, error instanceof Error ? error.message : error)
}

/**
 * ipcMain.handle with logging: a failing handler is written to the error log (channel, message,
 * stack; never its arguments) and the error still reaches the renderer, which shows a toast.
 */
export function handle(
  channel: string,
  // Handlers take whatever the renderer sent and validate it with zod themselves.
  listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      return await listener(event, ...args)
    } catch (error) {
      logError(channel, error)
      throw error
    }
  })
}
