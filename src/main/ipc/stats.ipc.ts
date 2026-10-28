import { handle } from '../logs'
import { getFeelings } from '../services/feelings'
import { getInsights } from '../services/stats'
import { getChapterAnalyses } from '../services/timeline'
import { insightsPeriodSchema } from '../../shared/validation'

export function registerStatsHandlers(): void {
  handle('stats:insights', (_event, period: unknown) =>
    getInsights(insightsPeriodSchema.parse(period))
  )
  handle('stats:feelings', (_event, period: unknown) =>
    getFeelings(insightsPeriodSchema.parse(period))
  )
  handle('stats:chapters', () => getChapterAnalyses())
}
