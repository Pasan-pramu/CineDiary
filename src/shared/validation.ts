import { z } from 'zod'
import { getLocalDate } from './constants'
import { CHAPTER_COLORS } from './timeline'

/** Mood scores and the personal rating: a whole number from 1 to 10 (the database checks it too). */
export const scoreSchema = z.number().int().min(1).max(10)

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
    originalTitle: z.string().trim().max(300).optional(),
    tmdbId: z.number().int().positive().optional(),
    imdbId: z
      .string()
      .regex(/^tt\d+$/)
      .optional(),
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
    rating: scoreSchema.optional(),
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

/** A new title plus, from "Have you watched it?", the watch saved with it. */
export const addTitleSchema = createTitleSchema.extend({
  firstWatch: z.enum(['watching', 'watched']).optional()
})

/** A real calendar date as YYYY-MM-DD: 2026-02-30 or 2026-13-01 are rejected. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export const dateSchema = z.string().refine(isCalendarDate, 'Use a valid date.')
/** A mood key; the main process checks it exists in the moods table (moods can be custom). */
const moodSchema = z.string().trim().min(1).max(80)

/** True for a single visible character, e.g. one emoji (even one made of several code points). */
export function isOneCharacter(value: string): boolean {
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length === 1
}

export const moodLabelSchema = z
  .string()
  .trim()
  .min(1, 'Give it a name.')
  .max(40, 'Keep the name under 40 characters.')

export const moodInputSchema = z.object({
  label: moodLabelSchema,
  emoji: z.string().trim().min(1, 'Pick an emoji.').max(16).refine(isOneCharacter, 'Use one emoji.')
})
const optionalScoreSchema = scoreSchema.optional()

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
    rating: scoreSchema.nullable().optional()
  })
  .superRefine((value, context) => {
    // "Today" is the local calendar day (getLocalDate), never the UTC one.
    const localToday = getLocalDate()
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
  hasReflection: z.boolean(),
  chapterId: z.number().int().positive().nullable(),
  feelingOrReason: moodSchema.nullable()
})

export type JournalQuery = z.infer<typeof journalQuerySchema>

export const insightsPeriodSchema = z.union([
  z.enum(['month', 'six_months', 'year', 'all']),
  z.object({ kind: z.literal('chapter'), chapterId: z.number().int().positive() }),
  z
    .object({ kind: z.literal('range'), from: dateSchema, to: dateSchema })
    .refine((range) => range.from <= range.to, { message: 'The start must be before the end.' })
])

export const recommendationQuerySchema = z
  .object({
    mood: moodSchema.nullable(),
    reasonKey: z.string().min(1).max(200).nullable(),
    type: z.enum(['all', 'movie', 'series'])
  })
  .refine((query) => (query.mood === null) !== (query.reasonKey === null), {
    message: 'Pick either a mood or a reason.'
  })

export const displayNameSchema = z.string().trim().max(60)

/** A TMDB "API Read Access Token" (a long JWT-like string, no spaces). */
export const tmdbTokenSchema = z
  .string()
  .trim()
  .min(20, 'That looks too short for an API Read Access Token.')
  .max(2000)
  .regex(/^\S+$/, 'The token should not contain spaces.')

export const tmdbSearchQuerySchema = z.string().trim().min(2).max(200)

/** TMDB image paths look like "/kqjL17yufvn9OVLyXYpvtyrFfak.jpg". */
export const tmdbImagePathSchema = z.string().regex(/^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/)

export const tmdbLinkInputSchema = z.object({
  titleId: z.number().int().positive(),
  tmdbId: z.number().int().positive(),
  choices: z.record(z.string(), z.enum(['mine', 'tmdb'])),
  tempPosterFile: z
    .string()
    .regex(/^[\w-]+\.(jpg|jpeg|png|webp)$/)
    .optional()
})

export const discoverQuerySchema = z.object({
  prompt: z.string().min(1).max(50),
  type: z.enum(['all', 'movie', 'series']),
  maxRuntime: z.number().int().positive().max(1000).nullable(),
  includeRewatches: z.boolean(),
  includeUnknownRuntime: z.boolean()
})

export const timelineQuerySchema = z.object({
  search: z.string().max(200),
  type: z.enum(['all', 'movie', 'series']),
  chapterId: z.number().int().positive().nullable(),
  highlightsOnly: z.boolean(),
  reasonId: z.number().int().positive().nullable(),
  moodBefore: moodSchema.nullable()
})

/** A month cursor, YYYY-MM. */
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)

export const lifePeriodInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the chapter a name.').max(80),
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
    color: z.enum(CHAPTER_COLORS),
    note: z.string().trim().max(500).nullable()
  })
  .refine((value) => value.endDate === null || value.endDate >= value.startDate, {
    message: 'The end date must be on or after the start date.',
    path: ['endDate']
  })
