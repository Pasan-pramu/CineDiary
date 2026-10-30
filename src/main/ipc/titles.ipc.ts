import { dialog } from 'electron'
import { handle } from '../logs'
import { z } from 'zod'
import {
  createTitle,
  deleteTitle,
  getTitle,
  listGenres,
  listLanguages,
  listTitles,
  searchTitles,
  setTitleStatus,
  toggleFavorite,
  updateTitle
} from '../services/titles'
import { preparePoster } from '../services/posters'
import { enrichNewTitle, getTitleCredits } from '../services/tmdbLibrary'
import { logFirstWatch } from '../services/watchEntries'
import { addTitleSchema, createTitleSchema } from '../../shared/validation'

const idSchema = z.number().int().positive()
const collectionQuerySchema = z.object({
  search: z.string(),
  type: z.enum(['all', 'movie', 'series']),
  status: z.enum(['all', 'planned', 'watching', 'completed', 'dropped', 'rewatching']),
  genre: z.string(),
  language: z.string().max(200),
  favorite: z.boolean(),
  minimumRating: z.number().int().min(1).max(10).nullable(),
  sort: z.enum(['recent', 'title', 'rating', 'year']),
  direction: z.enum(['asc', 'desc'])
})

export function registerTitleHandlers(): void {
  handle('titles:list', () => listTitles())
  handle('titles:get', (_event, id: unknown) => getTitle(idSchema.parse(id)) ?? null)
  handle('titles:delete', (_event, id: unknown) => {
    deleteTitle(idSchema.parse(id))
  })
  handle('titles:listGenres', () => listGenres())
  handle('titles:listLanguages', () => listLanguages())
  handle('titles:create', (_event, input: unknown) => {
    const { firstWatch, ...details } = addTitleSchema.parse(input)
    // With a first watch the title starts planned and the watch sets its status.
    const title = createTitle(firstWatch ? { ...details, status: 'planned' } : details)
    if (firstWatch) logFirstWatch(title.id, firstWatch)
    // Saved from TMDB: fetch cast, crew and backdrop in the background (nothing else changes).
    if (title.tmdbId !== null) void enrichNewTitle(title.id)
    return title
  })
  handle('titles:credits', (_event, id: unknown) => getTitleCredits(idSchema.parse(id)))
  handle('titles:update', (_event, input: unknown) =>
    updateTitle(
      createTitleSchema.extend({ id: idSchema, removePoster: z.boolean().optional() }).parse(input)
    )
  )
  handle('titles:setStatus', (_event, id: unknown, status: unknown) =>
    setTitleStatus(idSchema.parse(id), z.enum(['dropped', 'watching', 'rewatching']).parse(status))
  )
  handle('titles:toggleFavorite', (_event, id: unknown) => toggleFavorite(idSchema.parse(id)))
  handle('titles:collection', (_event, query: unknown) =>
    searchTitles(collectionQuerySchema.parse(query))
  )
  handle('posters:pick', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })
    return result.canceled || !result.filePaths[0] ? null : preparePoster(result.filePaths[0])
  })
  handle('posters:prepare', (_event, filePath: unknown) =>
    preparePoster(z.string().min(1).parse(filePath))
  )
}
