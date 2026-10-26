import { z } from 'zod'

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
