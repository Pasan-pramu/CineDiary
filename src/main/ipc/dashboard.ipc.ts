import { ipcMain } from 'electron'
import { getDashboard } from '../services/dashboard'
import { discover, getRecommendationOptions, recommend } from '../services/recommendations'
import { discoverQuerySchema, recommendationQuerySchema } from '../../shared/validation'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:get', () => getDashboard())
  ipcMain.handle('recommendations:options', () => getRecommendationOptions())
  ipcMain.handle('recommendations:get', (_event, query: unknown) =>
    recommend(recommendationQuerySchema.parse(query))
  )
  ipcMain.handle('recommendations:discover', (_event, query: unknown) =>
    discover(discoverQuerySchema.parse(query))
  )
}
