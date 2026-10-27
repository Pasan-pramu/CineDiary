import { describe, expect, it, vi, type Mock } from 'vitest'
import {
  defaultLinkChoices,
  linkUpdates,
  valuesFromDraft,
  type TmdbFieldValues
} from '../../shared/tmdbFields'
import { createTmdbClient, matchGenres, retryDelayMs, type TmdbDeps } from './tmdb'
import { runSyncBatch, syncTitle, type SyncSave, type SyncStore, type SyncTitle } from './tmdbSync'

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
  poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
  backdrop_path: '/interstellar-backdrop.jpg',
  credits: {
    // 12 actors, out of order: we keep the top 10 by TMDB's billing order.
    cast: Array.from({ length: 12 }, (_, index) => ({
      name: `Actor ${11 - index}`,
      character: `Role ${11 - index}`,
      order: 11 - index
    })),
    crew: [
      { name: 'Christopher Nolan', job: 'Director' },
      { name: 'Emma Thomas', job: 'Producer' },
      { name: 'Christopher Nolan', job: 'Director' }
    ]
  }
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
  backdrop_path: '/ted-lasso-backdrop.jpg',
  external_ids: { imdb_id: 'tt10986410' },
  created_by: [{ name: 'Jason Sudeikis' }, { name: 'Bill Lawrence' }],
  aggregate_credits: {
    cast: [
      { name: 'Jason Sudeikis', order: 0, roles: [{ character: 'Ted Lasso', episode_count: 34 }] },
      {
        name: 'Guest Star',
        order: 1,
        // Main character = the role with the most episodes.
        roles: [
          { character: 'Pub Regular', episode_count: 2 },
          { character: 'Kit Man', episode_count: 20 }
        ]
      }
    ]
  }
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

describe('getDetails', () => {
  it('maps movie details onto the form fields', async () => {
    const { tmdb, fetch } = client([json(movieDetails)])
    const result = await tmdb.getDetails('movie', 157336, ['Sci-Fi', 'drama'])
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.draft).toEqual({
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
    })
    expect(result.data.backdropPath).toBe('/interstellar-backdrop.jpg')
    expect(result.data.cast).toHaveLength(10)
    expect(result.data.cast[0]).toEqual({ name: 'Actor 0', character: 'Role 0', order: 0 })
    expect(result.data.cast[9].name).toBe('Actor 9')
    expect(result.data.crew).toEqual([{ name: 'Christopher Nolan', role: 'director', order: 0 }])
    expect(fetch.mock.calls[0][0]).toContain(
      '/movie/157336?language=en-US&append_to_response=credits'
    )
  })

  it('maps TV details, using a recent episode when episode_run_time is empty', async () => {
    const { tmdb, fetch } = client([json(tvDetails)])
    const result = await tmdb.getDetails('series', 97546, [])
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.draft).toEqual({
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
    })
    expect(result.data.cast).toEqual([
      { name: 'Jason Sudeikis', character: 'Ted Lasso', order: 0 },
      { name: 'Guest Star', character: 'Kit Man', order: 1 }
    ])
    expect(result.data.crew).toEqual([
      { name: 'Jason Sudeikis', role: 'creator', order: 0 },
      { name: 'Bill Lawrence', role: 'creator', order: 1 }
    ])
    expect(fetch.mock.calls[0][0]).toContain(
      '/tv/97546?language=en-US&append_to_response=external_ids%2Caggregate_credits'
    )
  })

  it('reports not_found for a missing title', async () => {
    const { tmdb } = client([json({ status_code: 34 }, 404)])
    expect(await tmdb.getDetails('movie', 1, [])).toMatchObject({
      ok: false,
      error: { code: 'not_found' }
    })
  })

  it('reports an unexpected response instead of crashing', async () => {
    const { tmdb } = client([json({ nothing: 'useful' })])
    expect(await tmdb.getDetails('movie', 1, [])).toMatchObject({
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

// --- M6b: enrichment, Link to TMDB and re-sync ---

/** An in-memory SyncStore: one title whose values/snapshot change as the sync saves. */
function fakeStore(title: SyncTitle): SyncStore & {
  title: SyncTitle
  saves: SyncSave[]
  backdrops: Uint8Array[]
} {
  const store = {
    title,
    saves: [] as SyncSave[],
    backdrops: [] as Uint8Array[],
    loadTitle: (id: number) => (id === store.title.id ? store.title : null),
    allGenres: () => ['Sci-Fi', 'Drama', 'Adventure'],
    save: (_id: number, save: SyncSave) => {
      store.saves.push(save)
      store.title = {
        ...store.title,
        values: { ...store.title.values, ...save.updates },
        snapshot: save.snapshot
      }
    },
    saveBackdrop: (_id: number, image: { bytes: Uint8Array }) => {
      store.backdrops.push(image.bytes)
      store.title = { ...store.title, hasBackdrop: true }
    },
    markChecked: vi.fn()
  }
  return store
}

/** What TMDB's Interstellar looks like after our mapping (Science Fiction → my "Sci-Fi"). */
const mappedInterstellar: TmdbFieldValues = {
  title: 'Interstellar',
  originalTitle: 'Interstellar',
  year: 2014,
  overview: 'A team of explorers travel through a wormhole in space.',
  genres: ['Adventure', 'Drama', 'Sci-Fi'],
  country: 'United States of America',
  language: 'English',
  runtimeMinutes: 169,
  totalSeasons: null,
  totalEpisodes: null,
  imdbId: 'tt0816692'
}

function interstellar(overrides: Partial<SyncTitle> = {}): SyncTitle {
  return {
    id: 1,
    type: 'movie',
    tmdbId: 157336,
    values: mappedInterstellar,
    snapshot: mappedInterstellar,
    hasBackdrop: true,
    ...overrides
  }
}

function image(bytes: number[]): Response {
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg' } })
}

describe('syncTitle', () => {
  it('downloads a missing backdrop at w1280 and stores cast & crew', async () => {
    const { tmdb, fetch } = client([json(movieDetails), image([7, 7, 7])])
    const store = fakeStore(interstellar({ hasBackdrop: false }))
    const result = await syncTitle(1, tmdb, store, 'record')
    expect(result.ok).toBe(true)
    expect(fetch.mock.calls[1][0]).toBe(
      'https://image.tmdb.org/t/p/w1280/interstellar-backdrop.jpg'
    )
    expect(store.backdrops).toEqual([new Uint8Array([7, 7, 7])])
    expect(store.saves[0].cast).toHaveLength(10)
    expect(store.saves[0].crew.map((member) => member.name)).toEqual(['Christopher Nolan'])
  })

  it('never re-downloads an existing backdrop', async () => {
    const { tmdb, fetch } = client([json(movieDetails)])
    const store = fakeStore(interstellar({ hasBackdrop: true }))
    await syncTitle(1, tmdb, store)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.backdrops).toEqual([])
  })

  it('re-syncing an unedited title changes nothing and marks nothing as mine', async () => {
    const { tmdb } = client([json(movieDetails), json(movieDetails)])
    // As saved from TMDB in Add Title: the mapped values, but no snapshot yet.
    const store = fakeStore(interstellar({ snapshot: null }))
    const first = await syncTitle(1, tmdb, store, 'record')
    const second = await syncTitle(1, tmdb, store)
    expect(first).toEqual({ ok: true, data: { updates: {}, mine: [] } })
    expect(second).toEqual({ ok: true, data: { updates: {}, mine: [] } })
    expect(store.title.values).toEqual(mappedInterstellar)
    expect(store.title.snapshot).toEqual(mappedInterstellar)
  })

  it('follows TMDB for untouched fields but keeps my edits', async () => {
    const updated = { ...movieDetails, overview: 'A new synopsis from TMDB.', runtime: 170 }
    const { tmdb } = client([json(updated)])
    const store = fakeStore(
      interstellar({
        values: {
          ...mappedInterstellar,
          title: 'Interstellar (my cut)', // my edit
          runtimeMinutes: 175, // my edit
          // Same genres in another order and case: not an edit.
          genres: ['sci-fi', 'drama', 'ADVENTURE']
        }
      })
    )
    const result = await syncTitle(1, tmdb, store)
    expect(result).toEqual({
      ok: true,
      data: {
        updates: { overview: 'A new synopsis from TMDB.' },
        mine: ['title', 'runtimeMinutes']
      }
    })
    expect(store.title.values.title).toBe('Interstellar (my cut)')
    expect(store.title.values.runtimeMinutes).toBe(175)
    expect(store.title.snapshot?.runtimeMinutes).toBe(170)
  })

  it('on a first sync without a snapshot, only fills empty fields', async () => {
    const { tmdb } = client([json(movieDetails)])
    const store = fakeStore(
      interstellar({
        snapshot: null,
        values: { ...mappedInterstellar, overview: null, country: 'USA' }
      })
    )
    const result = await syncTitle(1, tmdb, store)
    expect(result).toEqual({
      ok: true,
      data: { updates: { overview: mappedInterstellar.overview }, mine: ['country'] }
    })
  })

  it('marks a title TMDB no longer has as checked, so it waits its turn', async () => {
    const { tmdb } = client([json({ status_code: 34 }, 404)])
    const store = fakeStore(interstellar())
    const result = await syncTitle(1, tmdb, store, 'sync', () => new Date('2026-01-01T00:00:00Z'))
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } })
    expect(store.markChecked).toHaveBeenCalledWith(1, '2026-01-01T00:00:00.000Z')
  })
})

describe('Link to TMDB choices', () => {
  const mine: TmdbFieldValues = {
    ...mappedInterstellar,
    title: 'Interstellar',
    overview: null,
    genres: [],
    country: 'USA',
    runtimeMinutes: null,
    imdbId: null
  }

  it('keeps my values when I have them and fills empty ones from TMDB', () => {
    const choices = defaultLinkChoices(mine, mappedInterstellar, { mine: true, tmdb: true })
    expect(choices).toMatchObject({
      title: 'mine',
      overview: 'tmdb',
      genres: 'tmdb',
      country: 'mine',
      runtimeMinutes: 'tmdb',
      poster: 'mine'
    })
    expect(defaultLinkChoices(mine, mappedInterstellar, { mine: false, tmdb: true }).poster).toBe(
      'tmdb'
    )
  })

  it('applies only the fields chosen as "Use TMDB" (plus the IMDb id)', () => {
    const updates = linkUpdates(mappedInterstellar, {
      title: 'mine',
      overview: 'tmdb',
      country: 'mine'
    })
    expect(updates).toEqual({ overview: mappedInterstellar.overview, imdbId: 'tt0816692' })
  })

  it('maps TMDB details to the same values the snapshot compares against', async () => {
    const { tmdb } = client([json(movieDetails)])
    const result = await tmdb.getDetails('movie', 157336, ['Sci-Fi', 'Drama', 'Adventure'])
    if (!result.ok) throw new Error(result.error.message)
    expect(valuesFromDraft(result.data.draft)).toEqual(mappedInterstellar)
  })
})

describe('runSyncBatch', () => {
  function multiStore(): SyncStore & { saved: number[] } {
    const store = {
      saved: [] as number[],
      loadTitle: (id: number) => interstellar({ id }),
      allGenres: () => [],
      save: (id: number) => store.saved.push(id),
      saveBackdrop: () => undefined,
      markChecked: () => undefined
    }
    return store
  }

  it('pauses the whole batch on a rate limit instead of hammering TMDB', async () => {
    const { tmdb, fetch } = client([
      json(movieDetails),
      json({}, 429),
      json({}, 429),
      json({}, 429)
    ])
    const store = multiStore()
    const progress = vi.fn()
    const result = await runSyncBatch([1, 2, 3], tmdb, store, {
      delayMs: 0,
      sleep: async () => undefined,
      shouldStop: () => false,
      onProgress: progress
    })
    expect(result).toMatchObject({ done: 1, total: 3, stopped: { code: 'rate_limited' } })
    expect(store.saved).toEqual([1])
    expect(fetch).toHaveBeenCalledTimes(4) // title 1, then title 2 with its retries; never title 3
    expect(progress).toHaveBeenCalledWith(1, 3)
  })

  it('stops when cancelled', async () => {
    const { tmdb } = client([json(movieDetails)])
    let cancel = false
    const result = await runSyncBatch([1, 2], tmdb, multiStore(), {
      delayMs: 0,
      sleep: async () => {
        cancel = true
      },
      shouldStop: () => cancel
    })
    expect(result).toEqual({ done: 1, total: 2, stopped: 'cancelled' })
  })
})
