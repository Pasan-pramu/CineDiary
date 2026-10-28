import { z } from 'zod'
import { handle } from '../logs'
import {
  createMood,
  deleteMood,
  listMoods,
  reorderMoods,
  setMoodHidden,
  updateMood
} from '../services/moods'
import {
  createReason,
  deleteReason,
  listReasons,
  renameReason,
  reorderReasons,
  setReasonHidden
} from '../services/reasons'
import { moodInputSchema, moodLabelSchema } from '../../shared/validation'

const idSchema = z.number().int().positive()
const idsSchema = z.array(idSchema).max(1000)

/** Moods and reasons: pickers, the "+ New" forms and Settings → Moods & reasons. */
export function registerMoodHandlers(): void {
  handle('moods:list', () => listMoods())
  handle('moods:create', (_event, input: unknown) => createMood(moodInputSchema.parse(input)))
  handle('moods:update', (_event, id: unknown, input: unknown) =>
    updateMood(idSchema.parse(id), moodInputSchema.parse(input))
  )
  handle('moods:setHidden', (_event, id: unknown, hidden: unknown) =>
    setMoodHidden(idSchema.parse(id), z.boolean().parse(hidden))
  )
  handle('moods:reorder', (_event, ids: unknown) => reorderMoods(idsSchema.parse(ids)))
  handle('moods:delete', (_event, id: unknown) => deleteMood(idSchema.parse(id)))

  handle('reasons:list', () => listReasons())
  handle('reasons:create', (_event, label: unknown) => createReason(moodLabelSchema.parse(label)))
  handle('reasons:rename', (_event, id: unknown, label: unknown) =>
    renameReason(idSchema.parse(id), moodLabelSchema.parse(label))
  )
  handle('reasons:setHidden', (_event, id: unknown, hidden: unknown) =>
    setReasonHidden(idSchema.parse(id), z.boolean().parse(hidden))
  )
  handle('reasons:reorder', (_event, ids: unknown) => reorderReasons(idsSchema.parse(ids)))
  handle('reasons:delete', (_event, id: unknown) => deleteReason(idSchema.parse(id)))
}
