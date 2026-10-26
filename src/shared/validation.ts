import { z } from 'zod'
import { MOODS, type MoodKey } from './constants'

export const titleTypeSchema = z.enum(['movie', 'series'])
export const titleStatusSchema = z.enum([
  'planned',
  'watching',
  'completed',
  'dropped',
  'rewatching'
])

export const createTitleSchema = z
  .object({
    type: titleTypeSchema,
    title: z.string().trim().min(1, 'Enter a title.'),
    year: z
      .number()
      .int()
      .min(1888)
      .max(new Date().getFullYear() + 10)
      .optional(),
    genres: z.array(z.string().trim().min(1)).max(20),
    overview: z.string().trim().max(5000).optional(),
    country: z.string().trim().max(100).optional(),
    language: z.string().trim().max(100).optional(),
    runtimeMinutes: z.number().int().positive().max(1000).optional(),
    totalSeasons: z.number().int().positive().max(1000).optional(),
    totalEpisodes: z.number().int().positive().max(100000).optional(),
    status: titleStatusSchema,
    rating: z.number().int().min(1).max(10).optional(),
    isFavorite: z.boolean(),
    tempPosterFile: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.type === 'series') {
      for (const field of ['totalSeasons', 'totalEpisodes', 'runtimeMinutes'] as const) {
        if (value[field] === undefined) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: 'Required for TV series.'
          })
        }
      }
    }
  })

export type CreateTitleInput = z.infer<typeof createTitleSchema>

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
const moodSchema = z.enum(MOODS.map((mood) => mood.key) as [MoodKey, ...MoodKey[]])
const optionalScoreSchema = z.number().int().min(1).max(10).optional()

export const watchEntryInputSchema = z
  .object({
    titleId: z.number().int().positive(),
    startedAt: dateSchema,
    completedAt: dateSchema.optional(),
    isRewatch: z.boolean().optional(),
    episodesWatched: z.number().int().min(0).optional(),
    moodBefore: moodSchema.optional(),
    moodBeforeScore: optionalScoreSchema,
    reasonIds: z.array(z.number().int().positive()).max(50).optional(),
    reasonNote: z.string().trim().max(2000).optional(),
    moodAfter: moodSchema.optional(),
    moodAfterScore: optionalScoreSchema,
    thoughts: z.string().trim().max(5000).optional(),
    lessons: z.string().trim().max(5000).optional(),
    favoriteCharacter: z.string().trim().max(300).optional(),
    favoriteScene: z.string().trim().max(1000).optional(),
    favoriteQuote: z.string().trim().max(1000).optional(),
    wouldRewatch: z.boolean().optional(),
    wouldRecommend: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
    rating: z.number().int().min(1).max(10).optional()
  })
  .superRefine((value, context) => {
    const today = new Date()
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (value.startedAt > localToday)
      context.addIssue({
        code: 'custom',
        path: ['startedAt'],
        message: 'Date cannot be in the future.'
      })
    if (value.completedAt && value.completedAt > localToday)
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'Date cannot be in the future.'
      })
    if (value.completedAt && value.completedAt < value.startedAt)
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'Completed date must be on or after the start date.'
      })
  })

export type WatchEntryInput = z.infer<typeof watchEntryInputSchema>

export const journalQuerySchema = z.object({
  search: z.string().max(200),
  type: z.enum(['all', 'movie', 'series']),
  reasonId: z.number().int().positive().nullable(),
  moodBefore: moodSchema.nullable(),
  moodImproved: z.boolean(),
  hasReflection: z.boolean()
})

export type JournalQuery = z.infer<typeof journalQuerySchema>
