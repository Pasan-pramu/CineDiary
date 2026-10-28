import { app, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { z } from 'zod'
import { handle, logError, logsFolder } from '../logs'
import type { AppInfo } from '../../shared/types'

// A renderer error as the renderer reports it: message and stack only (see services/errorLog.ts).
const rendererErrorSchema = z.object({
  source: z.string().max(60),
  message: z.string().max(2000),
  stack: z.string().max(8000).nullable()
})

export function registerAppHandlers(): void {
  handle('app:info', (): AppInfo => ({
    version: app.getVersion(),
    dataFolder: app.getPath('userData')
  }))
  handle('app:openLogs', async () => {
    mkdirSync(logsFolder(), { recursive: true })
    const error = await shell.openPath(logsFolder())
    return error ? { ok: false, message: error } : { ok: true, data: null }
  })
  // Fire-and-forget from the renderer (error boundary, unexpected errors).
  ipcMain.on('app:logError', (_event, payload: unknown) => {
    const parsed = rendererErrorSchema.safeParse(payload)
    if (!parsed.success) return
    const error = new Error(parsed.data.message)
    error.stack = `Error: ${parsed.data.message}\n${parsed.data.stack ?? ''}`
    logError(parsed.data.source, error)
  })
}
