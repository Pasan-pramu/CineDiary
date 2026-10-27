import { ipcMain } from 'electron'
import { z } from 'zod'
import { prepareDownloadedPoster } from '../services/posters'
import { findTitleByTmdb, listGenres } from '../services/titles'
import { cancelRefresh, getSyncProgress, refreshAll } from '../services/tmdbBackground'
import { linkTitle, tmdbClient as tmdb } from '../services/tmdbLibrary'
import type { TmdbPick, TmdbResult } from '../../shared/types'
import {
  titleTypeSchema,
  tmdbImagePathSchema,
  tmdbLinkInputSchema,
  tmdbSearchQuerySchema,
  tmdbTokenSchema
} from '../../shared/validation'

// The renderer never talks to TMDB and never sees the token: it asks here, and main does
// the request with Electron's network stack.

/** Search thumbnails as data URLs, kept in memory only for this session. */
const THUMBNAIL_CACHE_LIMIT = 200
const thumbnails = new Map<string, string>()

async function thumbnail(path: string): Promise<string | null> {
  const cached = thumbnails.get(path)
  if (cached) return cached
  const result = await tmdb.fetchImage('w92', path)
  if (!result.ok) return null
  const dataUrl = `data:${result.data.contentType};base64,${Buffer.from(result.data.bytes).toString('base64')}`
  if (thumbnails.size >= THUMBNAIL_CACHE_LIMIT) {
    const oldest = thumbnails.keys().next().value
    if (oldest !== undefined) thumbnails.delete(oldest)
  }
  thumbnails.set(path, dataUrl)
  return dataUrl
}

/** Details for the form plus the w500 poster in the temporary poster folder. */
async function pick(type: 'movie' | 'series', tmdbId: number): Promise<TmdbResult<TmdbPick>> {
  const existing = findTitleByTmdb(tmdbId, type)
  const details = await tmdb.getDetails(type, tmdbId, listGenres())
  if (!details.ok) return details
  const draft = { ok: true, data: details.data.draft } as const
  let poster: TmdbPick['poster'] = null
  if (draft.data.posterPath && !existing) {
    const image = await tmdb.fetchImage('w500', draft.data.posterPath)
    // A missing poster isn't fatal: the details still fill the form.
    if (image.ok) {
      try {
        poster = prepareDownloadedPoster(image.data.bytes, image.data.contentType)
      } catch {
        poster = null
      }
    }
  }
  return { ok: true, data: { draft: draft.data, poster, existingTitleId: existing?.id ?? null } }
}

export function registerTmdbHandlers(): void {
  ipcMain.handle('tmdb:search', async (_event, query: unknown) => {
    const result = await tmdb.search(tmdbSearchQuerySchema.parse(query))
    if (!result.ok) return result
    return {
      ok: true,
      data: result.data.map((item) => ({
        ...item,
        existingTitleId: findTitleByTmdb(item.tmdbId, item.type)?.id ?? null
      }))
    }
  })
  ipcMain.handle('tmdb:thumbnail', (_event, path: unknown) =>
    thumbnail(tmdbImagePathSchema.parse(path))
  )
  ipcMain.handle('tmdb:pick', (_event, type: unknown, tmdbId: unknown) =>
    pick(titleTypeSchema.parse(type), z.number().int().positive().parse(tmdbId))
  )
  ipcMain.handle('tmdb:testConnection', (_event, token: unknown) =>
    tmdb.testConnection(token === undefined ? undefined : tmdbTokenSchema.parse(token))
  )
  ipcMain.handle('tmdb:link', (_event, input: unknown) =>
    linkTitle(tmdbLinkInputSchema.parse(input))
  )
  ipcMain.handle('tmdb:refreshAll', () => refreshAll())
  ipcMain.handle('tmdb:cancelRefresh', () => cancelRefresh())
  ipcMain.handle('tmdb:syncProgress', () => getSyncProgress())
}
