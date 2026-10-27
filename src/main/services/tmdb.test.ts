import { describe, expect, it, vi, type Mock } from 'vitest'
import { createTmdbClient, matchGenres, retryDelayMs, type TmdbDeps } from './tmdb'

// All TMDB traffic here is fake: each test hands the client a `fetch` that returns canned
// responses, so no token or network is needed.

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

function client(
  responses: Array<Response | (() => Promise<Response>)>,
  overrides: Partial<TmdbDeps> = {}
): {
  tmdb: ReturnType<typeof createTmdbClient>
  fetch: Mock<TmdbDeps['fetch']>
  sleep: Mock<(ms: number) => Promise<void>>
} {
  const queue = [...responses]
  const fetch = vi.fn<TmdbDeps['fetch']>(async () => {
    const next = queue.shift()
    if (!next) throw new Error('No more fake responses')
    return typeof next === 'function' ? next() : next
  })
  const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined)
  const tmdb = createTmdbClient({ fetch, sleep, getToken: () => 'test-token', ...overrides })
  return { tmdb, fetch, sleep }
}

const movieDetails = {
  id: 157336,
  imdb_id: 'tt0816692',
  title: 'Interstellar',
  original_title: 'Interstellar',
  release_date: '2014-11-05',
  overview: 'A team of explorers travel through a wormhole in space.',
  genres: [{ name: 'Adventure' }, { name: 'Drama' }, { name: 'Science Fiction' }],
  production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
  original_language: 'en',
  runtime: 169,
  poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
}

const tvDetails = {
  id: 97546,
  name: 'Ted Lasso',
  original_name: 'Ted Lasso',
  first_air_date: '2020-08-14',
  overview: 'An American football coach takes over an English soccer team.',
  genres: [{ name: 'Comedy' }, { name: 'Drama' }, { name: 'Action & Adventure' }],
  production_countries: [],
  origin_country: ['US'],
  original_language: 'en',
  episode_run_time: [],
  last_episode_to_air: { runtime: 46 },
  number_of_seasons: 3,
  number_of_episodes: 34,
  poster_path: '/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg',
  external_ids: { imdb_id: 'tt10986410' }
}

describe('search', () => {
  it('maps movies and series, skips people, and sends the token as a Bearer header', async () => {
    const { tmdb, fetch } = client([
      json({
        results: [
          {
            id: 1,
            media_type: 'movie',
            title: 'Dune',
            original_title: 'Dune',
            release_date: '2021-09-15',
            poster_path: '/dune.jpg'
          },
          { id: 2, media_type: 'person', name: 'Zendaya' },
          {
            id: 3,
            media_type: 'tv',
            name: 'Dune: Prophecy',
            original_name: 'Dune: Prophecy',
            first_air_date: '2024-11-17',
            poster_path: null
          },
          { id: 4, media_type: 'movie', title: 'Dune (1984)', release_date: '' }
        ]
      })
    ])
    const result = await tmdb.search('dune')
    expect(result).toEqual({
      ok: true,
      data: [
        {
          tmdbId: 1,
          type: 'movie',
          title: 'Dune',
          originalTitle: 'Dune',
          year: 2021,
          posterPath: '/dune.jpg',
          existingTitleId: null
        },
        {
          tmdbId: 3,
          type: 'series',
          title: 'Dune: Prophecy',
          originalTitle: 'Dune: Prophecy',
          year: 2024,
          posterPath: null,
          existingTitleId: null
        },
        {
          tmdbId: 4,
          type: 'movie',
          title: 'Dune (1984)',
          originalTitle: null,
          year: null,
          posterPath: null,
          existingTitleId: null
        }
      ]
    })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toContain('https://api.themoviedb.org/3/search/multi?query=dune')
    expect(url).toContain('include_adult=false')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('returns no_token without calling TMDB when no token is saved', async () => {
    const { tmdb, fetch } = client([], { getToken: () => null })
    const result = await tmdb.search('dune')
    expect(result).toMatchObject({ ok: false, error: { code: 'no_token' } })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('getDraft', () => {
  it('maps movie details onto the form fields', async () => {
    const { tmdb, fetch } = client([json(movieDetails)])
    const result = await tmdb.getDraft('movie', 157336, ['Sci-Fi', 'drama'])
    expect(result).toEqual({
      ok: true,
      data: {
        type: 'movie',
        tmdbId: 157336,
        imdbId: 'tt0816692',
        title: 'Interstellar',
        originalTitle: 'Interstellar',
        year: 2014,
        overview: 'A team of explorers travel through a wormhole in space.',
        // Matched to the existing "Sci-Fi" and "drama" instead of creating near-duplicates.
        genres: ['Adventure', 'drama', 'Sci-Fi'],
        country: 'United States of America',
        language: 'English',
        runtimeMinutes: 169,
        totalSeasons: null,
        totalEpisodes: null,
        posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
      }
    })
    expect(fetch.mock.calls[0][0]).toContain('/movie/157336?language=en-US')
  })

  it('maps TV details, using a recent episode when episode_run_time is empty', async () => {
    const { tmdb, fetch } = client([json(tvDetails)])
    const result = await tmdb.getDraft('series', 97546, [])
    expect(result).toEqual({
      ok: true,
      data: {
        type: 'series',
        tmdbId: 97546,
        imdbId: 'tt10986410',
        title: 'Ted Lasso',
        originalTitle: 'Ted Lasso',
        year: 2020,
        overview: 'An American football coach takes over an English soccer team.',
        genres: ['Comedy', 'Drama', 'Action', 'Adventure'],
        country: 'United States',
        language: 'English',
        runtimeMinutes: 46,
        totalSeasons: 3,
        totalEpisodes: 34,
        posterPath: '/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg'
      }
    })
    expect(fetch.mock.calls[0][0]).toContain(
      '/tv/97546?language=en-US&append_to_response=external_ids'
    )
  })

  it('reports not_found for a missing title', async () => {
    const { tmdb } = client([json({ status_code: 34 }, 404)])
    expect(await tmdb.getDraft('movie', 1, [])).toMatchObject({
      ok: false,
      error: { code: 'not_found' }
    })
  })

  it('reports an unexpected response instead of crashing', async () => {
    const { tmdb } = client([json({ nothing: 'useful' })])
    expect(await tmdb.getDraft('movie', 1, [])).toMatchObject({
      ok: false,
      error: { code: 'unknown' }
    })
  })
})

describe('errors', () => {
  it('reports an invalid token (401) as unauthorized', async () => {
    const { tmdb } = client([json({ status_code: 7, status_message: 'Invalid API key' }, 401)])
    const result = await tmdb.search('dune')
    expect(result).toMatchObject({ ok: false, error: { code: 'unauthorized' } })
    if (!result.ok) expect(result.error.message).toMatch(/Settings/)
  })

  it('waits Retry-After and retries after a 429, then succeeds', async () => {
    const { tmdb, fetch, sleep } = client([
      json({}, 429, { 'Retry-After': '2' }),
      json({ results: [] })
    ])
    expect(await tmdb.search('dune')).toEqual({ ok: true, data: [] })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('gives up with rate_limited after repeated 429s', async () => {
    const { tmdb, fetch } = client([json({}, 429), json({}, 429), json({}, 429)])
    expect(await tmdb.search('dune')).toMatchObject({ ok: false, error: { code: 'rate_limited' } })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('times out a request that never answers', async () => {
    const hang = (_url: string, init: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    const tmdb = createTmdbClient({ fetch: hang, getToken: () => 'test-token', timeoutMs: 20 })
    expect(await tmdb.search('dune')).toMatchObject({ ok: false, error: { code: 'timeout' } })
  })

  it('reports offline when the network is down and tells the caller', async () => {
    const onNetworkError = vi.fn()
    const { tmdb } = client([() => Promise.reject(new TypeError('fetch failed'))], {
      onNetworkError
    })
    expect(await tmdb.search('dune')).toMatchObject({ ok: false, error: { code: 'offline' } })
    expect(onNetworkError).toHaveBeenCalledOnce()
  })
})

describe('testConnection', () => {
  it('accepts a working token', async () => {
    const { tmdb, fetch } = client([json({ success: true })])
    expect(await tmdb.testConnection('new-token')).toEqual({ ok: true, data: true })
    expect((fetch.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer new-token'
    )
  })
})

describe('fetchImage', () => {
  it('downloads an image without sending the token', async () => {
    const { tmdb, fetch } = client([
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })
    ])
    const result = await tmdb.fetchImage('w92', '/dune.jpg')
    expect(result).toEqual({
      ok: true,
      data: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' }
    })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://image.tmdb.org/t/p/w92/dune.jpg')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('rejects a response that is not an image', async () => {
    const { tmdb } = client([new Response('<html>', { headers: { 'Content-Type': 'text/html' } })])
    expect(await tmdb.fetchImage('w500', '/x.jpg')).toMatchObject({
      ok: false,
      error: { code: 'unknown' }
    })
  })
})

describe('helpers', () => {
  it('matchGenres splits combined TV genres and reuses existing names', () => {
    expect(
      matchGenres(['Sci-Fi & Fantasy', 'War & Politics', 'Fantasy'], ['Science Fiction'])
    ).toEqual(['Science Fiction', 'Fantasy', 'War', 'Politics'])
  })

  it('retryDelayMs reads seconds or a date, and caps the wait', () => {
    expect(retryDelayMs('3')).toBe(3000)
    expect(retryDelayMs('120')).toBe(10_000)
    expect(retryDelayMs(null)).toBe(1000)
    expect(retryDelayMs(new Date(5_000).toUTCString(), 1_000)).toBe(4000)
  })
})
