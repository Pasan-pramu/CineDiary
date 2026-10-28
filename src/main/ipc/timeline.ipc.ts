import { ipcMain } from 'electron'
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
  ipcMain.handle('timeline:page', (_event, query: unknown, before: unknown) =>
    getTimelinePage(timelineQuerySchema.parse(query), monthSchema.nullable().parse(before))
  )
  ipcMain.handle('timeline:overview', (_event, query: unknown) =>
    getTimelineOverview(timelineQuerySchema.parse(query))
  )
  ipcMain.handle('timeline:chapters', () => listLifePeriods())
  ipcMain.handle('timeline:createChapter', (_event, input: unknown) =>
    createLifePeriod(lifePeriodInputSchema.parse(input))
  )
  ipcMain.handle('timeline:updateChapter', (_event, id: unknown, input: unknown) =>
    updateLifePeriod(idSchema.parse(id), lifePeriodInputSchema.parse(input))
  )
  ipcMain.handle('timeline:deleteChapter', (_event, id: unknown) => {
    deleteLifePeriod(idSchema.parse(id))
  })
}
