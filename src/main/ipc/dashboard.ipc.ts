import { handle } from '../logs'
import { getDashboard } from '../services/dashboard'
import { discover, getRecommendationOptions, recommend } from '../services/recommendations'
import { discoverQuerySchema, recommendationQuerySchema } from '../../shared/validation'

export function registerDashboardHandlers(): void {
  handle('dashboard:get', () => getDashboard())
  handle('recommendations:options', () => getRecommendationOptions())
  handle('recommendations:get', (_event, query: unknown) =>
    recommend(recommendationQuerySchema.parse(query))
  )
  handle('recommendations:discover', (_event, query: unknown) =>
    discover(discoverQuerySchema.parse(query))
  )
}
