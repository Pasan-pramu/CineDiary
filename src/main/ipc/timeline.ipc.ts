import { handle } from '../logs'
import { z } from 'zod'
import {
  createLifePeriod,
  deleteLifePeriod,
  getTimelineOverview,
  getTimelinePage,
  listLifePeriods,
  updateLifePeriod
} from '../services/timeline'
import { lifePeriodInputSchema, monthSchema, timelineQuerySchema } from '../../shared/validation'

const idSchema = z.number().int().positive()

export function registerTimelineHandlers(): void {
  handle('timeline:page', (_event, query: unknown, before: unknown) =>
    getTimelinePage(timelineQuerySchema.parse(query), monthSchema.nullable().parse(before))
  )
  handle('timeline:overview', (_event, query: unknown) =>
    getTimelineOverview(timelineQuerySchema.parse(query))
  )
  handle('timeline:chapters', () => listLifePeriods())
  handle('timeline:createChapter', (_event, input: unknown) =>
    createLifePeriod(lifePeriodInputSchema.parse(input))
  )
  handle('timeline:updateChapter', (_event, id: unknown, input: unknown) =>
    updateLifePeriod(idSchema.parse(id), lifePeriodInputSchema.parse(input))
  )
  handle('timeline:deleteChapter', (_event, id: unknown) => {
    deleteLifePeriod(idSchema.parse(id))
  })
}
