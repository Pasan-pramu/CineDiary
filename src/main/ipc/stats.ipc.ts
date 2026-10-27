import { ipcMain } from 'electron'
import { getInsights } from '../services/stats'
import { insightsPeriodSchema } from '../../shared/validation'

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:insights', (_event, period: unknown) =>
    getInsights(insightsPeriodSchema.parse(period))
  )
}
