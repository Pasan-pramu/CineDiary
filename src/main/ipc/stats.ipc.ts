import { ipcMain } from 'electron'
import { getStats } from '../services/stats'

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:get', () => getStats())
}
