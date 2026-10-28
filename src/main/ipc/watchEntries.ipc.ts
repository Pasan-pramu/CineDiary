import { handle } from '../logs'
import { listWatchEntries, searchJournal } from '../services/watchEntries'
import {
  createPastWatch,
  deleteWatch,
  finishWatch,
  incrementEpisodes,
  startWatch,
  updateWatch,
  setHighlight
} from '../services/watchEntries'
import { journalQuerySchema, watchEntryInputSchema } from '../../shared/validation'
import { z } from 'zod'

const titleIdSchema = z.number().int().positive().optional()

export function registerWatchEntryHandlers(): void {
  handle('watchEntries:list', (_event, titleId: unknown) =>
    listWatchEntries(titleIdSchema.parse(titleId))
  )
  handle('watchEntries:journal', (_event, query: unknown) =>
    searchJournal(journalQuerySchema.parse(query))
  )
  handle('watchEntries:start', (_event, input: unknown) =>
    startWatch(watchEntryInputSchema.parse(input))
  )
  handle('watchEntries:finish', (_event, input: unknown) =>
    finishWatch(watchEntryInputSchema.extend({ id: z.number().int().positive() }).parse(input))
  )
  handle('watchEntries:create', (_event, input: unknown) =>
    createPastWatch(watchEntryInputSchema.parse(input))
  )
  handle('watchEntries:update', (_event, input: unknown) =>
    updateWatch(watchEntryInputSchema.extend({ id: z.number().int().positive() }).parse(input))
  )
  handle('watchEntries:delete', (_event, id: unknown) =>
    deleteWatch(z.number().int().positive().parse(id))
  )
  handle('watchEntries:incrementEpisodes', (_event, id: unknown) =>
    incrementEpisodes(z.number().int().positive().parse(id))
  )
  handle('watchEntries:setHighlight', (_event, id: unknown, on: unknown) =>
    setHighlight(z.number().int().positive().parse(id), z.boolean().parse(on))
  )
}
