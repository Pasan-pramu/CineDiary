import { z } from 'zod'
import { genreKey } from '../../shared/genres'
import type {
  CastMember,
  CrewMember,
  TitleType,
  TmdbDetails,
  TmdbError,
  TmdbErrorCode,
  TmdbResult,
  TmdbSearchResult,
  TmdbTitleDraft
} from '../../shared/types'

// TMDB client for the main process. It never imports Electron: the caller passes in `fetch`
// and a token getter (see ipc/tmdb.ipc.ts), which keeps it easy to test with fake responses.
// Every call returns a TmdbResult instead of throwing, so errors cross IPC with a clear code.

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const DEFAULT_TIMEOUT_MS = 10_000
/** Extra attempts after an HTTP 429 before giving up. */
const MAX_RATE_LIMIT_RETRIES = 2
const MAX_RETRY_DELAY_MS = 10_000
const SEARCH_LIMIT = 10

export type ImageSize = 'w92' | 'w500' | 'w1280'

const CAST_LIMIT = 10

export interface TmdbDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>
  /** null when no (readable) token is saved. */
  getToken: () => string | null
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
  /** Called when a request fails at the network level, e.g. to re-check connectivity. */
  onNetworkError?: () => void
}

const MESSAGES: Record<TmdbErrorCode, string> = {
  no_token: 'Add your TMDB token in Settings to search TMDB.',
  unauthorized: 'TMDB didn’t accept your token. Check it in Settings.',
  rate_limited: 'TMDB is busy right now. Try again in a moment.',
  timeout: 'TMDB didn’t respond in time. Try again.',
  offline: 'You’re offline — add the title manually.',
  not_found: 'TMDB couldn’t find that title.',
  unknown: 'Something went wrong while talking to TMDB.'
}

function failure<T>(code: TmdbErrorCode, detail?: string): TmdbResult<T> {
  const error: TmdbError = {
    code,
    message: detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]
  }
  return { ok: false, error }
}

/** Retry-After is either seconds or an HTTP date; default 1s, capped at 10s. */
export function retryDelayMs(header: string | null, now = Date.now()): number {
  if (!header) return 1000
  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now
  if (!Number.isFinite(ms) || ms < 0) return 1000
  return Math.min(ms, MAX_RETRY_DELAY_MS)
}

// --- Response shapes: only the fields we read. Unknown fields are ignored. ---

const searchSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      media_type: z.string().optional(),
      title: z.string().optional(),
      original_title: z.string().optional(),
      release_date: z.string().optional(),
      name: z.string().optional(),
      original_name: z.string().optional(),
      first_air_date: z.string().optional(),
      poster_path: z.string().nullable().optional()
    })
  )
})

const genreList = z.array(z.object({ name: z.string() })).optional()
const countryList = z.array(z.object({ iso_3166_1: z.string(), name: z.string() })).optional()

const movieSchema = z.object({
  id: z.number(),
  imdb_id: z.string().nullable().optional(),
  title: z.string(),
  original_title: z.string().optional(),
  release_date: z.string().optional(),
  overview: z.string().optional(),
  genres: genreList,
  production_countries: countryList,
  original_language: z.string().optional(),
  runtime: z.number().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  credits: z
    .object({
      cast: z
        .array(
          z.object({
            name: z.string(),
            character: z.string().nullable().optional(),
            order: z.number().optional()
          })
        )
        .optional(),
      crew: z.array(z.object({ name: z.string(), job: z.string().optional() })).optional()
    })
    .optional()
})

const episodeRuntime = z.object({ runtime: z.number().nullable().optional() }).nullable().optional()

const tvSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string().optional(),
  first_air_date: z.string().optional(),
  overview: z.string().optional(),
  genres: genreList,
  production_countries: countryList,
  origin_country: z.array(z.string()).optional(),
  original_language: z.string().optional(),
  episode_run_time: z.array(z.number()).optional(),
  last_episode_to_air: episodeRuntime,
  next_episode_to_air: episodeRuntime,
  number_of_seasons: z.number().nullable().optional(),
  number_of_episodes: z.number().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  external_ids: z.object({ imdb_id: z.string().nullable().optional() }).optional(),
  created_by: z.array(z.object({ name: z.string() })).optional(),
  // Cast across all seasons; each actor can have several roles.
  aggregate_credits: z
    .object({
      cast: z
        .array(
          z.object({
            name: z.string(),
            order: z.number().optional(),
            roles: z
              .array(
                z.object({
                  character: z.string().nullable().optional(),
                  episode_count: z.number().optional()
                })
              )
              .optional()
          })
        )
        .optional()
    })
    .optional()
})

const authenticationSchema = z.object({ success: z.boolean() })

// --- Mapping helpers (exported for tests) ---

function yearOf(date: string | undefined): number | null {
  const year = Number(date?.slice(0, 4))
  return Number.isInteger(year) && year > 1800 ? year : null
}

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function positiveOrNull(value: number | null | undefined): number | null {
  return value && value > 0 ? Math.round(value) : null
}

function displayName(code: string | undefined, type: 'language' | 'region'): string | null {
  if (!code) return null
  try {
    return (
      new Intl.DisplayNames(['en'], { type }).of(type === 'region' ? code.toUpperCase() : code) ??
      null
    )
  } catch {
    return null
  }
}

/**
 * Maps TMDB genre names onto the user's existing genres so we don't create near-duplicates.
 * TV's combined genres are split ("Action & Adventure" → Action, Adventure).
 * When several existing names match, the first one in `existing` wins.
 */
export function matchGenres(tmdbGenres: string[], existing: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const name of existing) if (!byKey.has(genreKey(name))) byKey.set(genreKey(name), name)
  const result = new Map<string, string>()
  for (const part of tmdbGenres.flatMap((genre) => genre.split('&'))) {
    const name = part.trim()
    if (!name) continue
    const key = genreKey(name)
    if (!result.has(key)) result.set(key, byKey.get(key) ?? name)
  }
  return [...result.values()]
}

export function mapSearchResults(json: unknown): TmdbSearchResult[] | null {
  const parsed = searchSchema.safeParse(json)
  if (!parsed.success) return null
  return parsed.data.results
    .flatMap((item): TmdbSearchResult[] => {
      if (item.media_type === 'movie' && item.title) {
        return [
          {
            tmdbId: item.id,
            type: 'movie',
            title: item.title,
            originalTitle: textOrNull(item.original_title),
            year: yearOf(item.release_date),
            posterPath: item.poster_path ?? null,
            existingTitleId: null
          }
        ]
      }
      if (item.media_type === 'tv' && item.name) {
        return [
          {
            tmdbId: item.id,
            type: 'series',
            title: item.name,
            originalTitle: textOrNull(item.original_name),
            year: yearOf(item.first_air_date),
            posterPath: item.poster_path ?? null,
            existingTitleId: null
          }
        ]
      }
      return [] // people and anything else
    })
    .slice(0, SEARCH_LIMIT)
}

function textList(names: string[]): CrewMember['name'][] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
}

function crewOf(names: string[], role: CrewMember['role']): CrewMember[] {
  return textList(names).map((name, order) => ({ name, role, order }))
}

function topCast(
  cast: Array<{ name: string; character: string | null; order: number }>
): CastMember[] {
  return [...cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, CAST_LIMIT)
    .map((member, order) => ({ name: member.name, character: member.character, order }))
}

export function mapMovie(json: unknown, existingGenres: string[]): TmdbDetails | null {
  const parsed = movieSchema.safeParse(json)
  if (!parsed.success) return null
  const movie = parsed.data
  return {
    backdropPath: movie.backdrop_path ?? null,
    cast: topCast(
      (movie.credits?.cast ?? []).map((member, index) => ({
        name: member.name,
        character: textOrNull(member.character),
        order: member.order ?? index
      }))
    ),
    crew: crewOf(
      (movie.credits?.crew ?? [])
        .filter((member) => member.job === 'Director')
        .map((member) => member.name),
      'director'
    ),
    draft: mapMovieDraft(movie, existingGenres)
  }
}

function mapMovieDraft(
  movie: z.infer<typeof movieSchema>,
  existingGenres: string[]
): TmdbTitleDraft {
  return {
    type: 'movie',
    tmdbId: movie.id,
    imdbId: textOrNull(movie.imdb_id),
    title: movie.title,
    originalTitle: textOrNull(movie.original_title),
    year: yearOf(movie.release_date),
    overview: textOrNull(movie.overview),
    genres: matchGenres(movie.genres?.map((genre) => genre.name) ?? [], existingGenres),
    country: movie.production_countries?.[0]?.name ?? null,
    language: displayName(movie.original_language, 'language'),
    runtimeMinutes: positiveOrNull(movie.runtime),
    totalSeasons: null,
    totalEpisodes: null,
    posterPath: movie.poster_path ?? null
  }
}

/** An actor's main character: the role with the most episodes. */
function mainCharacter(
  roles: Array<{ character?: string | null; episode_count?: number }> | undefined
): string | null {
  const best = [...(roles ?? [])].sort((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0))[0]
  return textOrNull(best?.character)
}

export function mapTv(json: unknown, existingGenres: string[]): TmdbDetails | null {
  const parsed = tvSchema.safeParse(json)
  if (!parsed.success) return null
  const tv = parsed.data
  return {
    backdropPath: tv.backdrop_path ?? null,
    cast: topCast(
      (tv.aggregate_credits?.cast ?? []).map((member, index) => ({
        name: member.name,
        character: mainCharacter(member.roles),
        order: member.order ?? index
      }))
    ),
    crew: crewOf(
      (tv.created_by ?? []).map((creator) => creator.name),
      'creator'
    ),
    draft: mapTvDraft(tv, existingGenres)
  }
}

function mapTvDraft(tv: z.infer<typeof tvSchema>, existingGenres: string[]): TmdbTitleDraft {
  // episode_run_time is often empty for newer shows; fall back to a recent episode.
  const runtime =
    tv.episode_run_time?.find((minutes) => minutes > 0) ??
    tv.last_episode_to_air?.runtime ??
    tv.next_episode_to_air?.runtime
  return {
    type: 'series',
    tmdbId: tv.id,
    imdbId: textOrNull(tv.external_ids?.imdb_id),
    title: tv.name,
    originalTitle: textOrNull(tv.original_name),
    year: yearOf(tv.first_air_date),
    overview: textOrNull(tv.overview),
    genres: matchGenres(tv.genres?.map((genre) => genre.name) ?? [], existingGenres),
    country: tv.production_countries?.[0]?.name ?? displayName(tv.origin_country?.[0], 'region'),
    language: displayName(tv.original_language, 'language'),
    runtimeMinutes: positiveOrNull(runtime),
    totalSeasons: positiveOrNull(tv.number_of_seasons),
    totalEpisodes: positiveOrNull(tv.number_of_episodes),
    posterPath: tv.poster_path ?? null
  }
}

// --- Client ---

export interface TmdbImage {
  bytes: Uint8Array
  contentType: string
}

export interface TmdbClient {
  search: (query: string) => Promise<TmdbResult<TmdbSearchResult[]>>
  /** Form fields plus backdrop path, top cast and directors/creators, in one request. */
  getDetails: (
    type: TitleType,
    tmdbId: number,
    existingGenres: string[]
  ) => Promise<TmdbResult<TmdbDetails>>
  /** Checks a token (the saved one when omitted) against /authentication. */
  testConnection: (token?: string) => Promise<TmdbResult<true>>
  fetchImage: (size: ImageSize, path: string) => Promise<TmdbResult<TmdbImage>>
}

export function createTmdbClient(deps: TmdbDeps): TmdbClient {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  /**
   * One GET with a timeout (covering the body too) and 429 retries.
   * `read` turns a successful response into data.
   */
  async function get<T>(
    url: string,
    token: string | null,
    read: (response: Response) => Promise<TmdbResult<T>>
  ): Promise<TmdbResult<T>> {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let received = false
      try {
        const response = await deps.fetch(url, {
          headers: token
            ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
            : { Accept: '*/*' },
          signal: controller.signal
        })
        received = true
        if (response.status === 429) {
          if (attempt >= MAX_RATE_LIMIT_RETRIES) return failure('rate_limited')
          clearTimeout(timer)
          await sleep(retryDelayMs(response.headers.get('Retry-After')))
          continue
        }
        if (response.status === 401) return failure('unauthorized')
        if (response.status === 404) return failure('not_found')
        if (!response.ok) return failure('unknown', `HTTP ${response.status}`)
        return await read(response)
      } catch {
        if (controller.signal.aborted) return failure('timeout')
        // Failing after a response arrived means a bad body, not a network problem.
        if (received) return failure('unknown', 'unexpected response')
        deps.onNetworkError?.()
        return failure('offline')
      } finally {
        clearTimeout(timer)
      }
    }
  }

  async function getJson<T>(
    path: string,
    params: Record<string, string>,
    map: (json: unknown) => T | null,
    token = deps.getToken()
  ): Promise<TmdbResult<T>> {
    if (!token) return failure('no_token')
    const url = `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
    return get(url, token, async (response) => {
      const data = map(await response.json())
      return data === null ? failure('unknown', 'unexpected response') : { ok: true, data }
    })
  }

  return {
    search: (query) =>
      getJson(
        '/search/multi',
        { query, include_adult: 'false', language: 'en-US', page: '1' },
        mapSearchResults
      ),

    getDetails: (type, tmdbId, existingGenres) =>
      type === 'movie'
        ? getJson(
            `/movie/${tmdbId}`,
            { language: 'en-US', append_to_response: 'credits' },
            (json) => mapMovie(json, existingGenres)
          )
        : getJson(
            `/tv/${tmdbId}`,
            { language: 'en-US', append_to_response: 'external_ids,aggregate_credits' },
            (json) => mapTv(json, existingGenres)
          ),

    testConnection: (token) =>
      getJson(
        '/authentication',
        {},
        (json) => (authenticationSchema.safeParse(json).data?.success ? true : null),
        token ?? deps.getToken()
      ),

    // Images live on a separate host and need no token.
    fetchImage: (size, path) =>
      get(`${IMAGE_BASE}/${size}${path}`, null, async (response) => {
        const contentType = response.headers.get('Content-Type') ?? ''
        if (!contentType.startsWith('image/')) return failure('unknown', 'not an image')
        return {
          ok: true,
          data: { bytes: new Uint8Array(await response.arrayBuffer()), contentType }
        }
      })
  }
}
