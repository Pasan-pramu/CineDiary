import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerToTitle, getLocalDate } from '../../shared/constants'
import type { CreateTitleInput } from '../../shared/types'
import { UNKNOWN_DATE } from '../../shared/watchDate'
import { closeMemoryDatabase, openMemoryDatabase, titleStatus } from '../test/memoryDb'
import { createTitle, getTitle, updateTitle } from './titles'
import { listWatchEntries, logFirstWatch } from './watchEntries'

// Saving titles: the edit form, and "Have you watched it?" when adding (in-memory diary only).

vi.mock('../db/client', async (original) => ({
  ...(await original<typeof import('../db/client')>()),
  getDatabase: (await import('../test/memoryDb')).currentDatabase
}))

beforeEach(() => {
  openMemoryDatabase()
})
afterEach(() => closeMemoryDatabase())

const series: CreateTitleInput = {
  type: 'series',
  title: 'Severance',
  originalTitle: 'Severance (US)',
  tmdbId: 95396,
  imdbId: 'tt11280740',
  year: 2022,
  genres: ['Drama'],
  overview: 'Work and home, split.',
  country: 'US',
  language: 'English',
  runtimeMinutes: 50,
  totalSeasons: 2,
  totalEpisodes: 19,
  status: 'planned',
  rating: 8,
  isFavorite: false
}

describe('editing a title', () => {
  it('saves a field you emptied as empty, not the old value', () => {
    const created = createTitle(series)
    // The edit form leaves out what you cleared (and never sends the TMDB link).
    const edited = updateTitle({
      id: created.id,
      type: 'movie',
      title: 'Severance',
      genres: [],
      status: 'planned',
      isFavorite: false
    })
    expect(edited).toMatchObject({
      originalTitle: null,
      year: null,
      overview: null,
      country: null,
      language: null,
      runtimeMinutes: null,
      totalSeasons: null,
      totalEpisodes: null,
      rating: null,
      genres: []
    })
    // Not part of the form, so untouched.
    expect(edited).toMatchObject({ tmdbId: 95396, imdbId: 'tt11280740' })
  })

  it('keeps what you didn’t change', () => {
    const created = createTitle(series)
    const edited = updateTitle({ ...series, id: created.id, title: 'Severance!' })
    expect(edited).toMatchObject({ title: 'Severance!', year: 2022, overview: series.overview })
  })
})

describe('"Have you watched it?" when adding a title', () => {
  /** What titles:create does: the title, then the watch the answer asks for. */
  function add(answer: Parameters<typeof answerToTitle>[0]): number {
    const { status, firstWatch } = answerToTitle(answer)
    const title = createTitle({ ...series, tmdbId: undefined, status })
    if (firstWatch) logFirstWatch(title.id, firstWatch)
    return title.id
  }

  it('Not yet → planned (watchlist), no watch', () => {
    const id = add('not_yet')
    expect(titleStatus(id)).toBe('planned')
    expect(listWatchEntries(id)).toEqual([])
  })

  it('Dropped → dropped, no watch', () => {
    const id = add('dropped')
    expect(titleStatus(id)).toBe('dropped')
    expect(listWatchEntries(id)).toEqual([])
  })

  it('Watching now → a watch started today, with no feelings yet', () => {
    const id = add('watching')
    expect(titleStatus(id)).toBe('watching')
    const [watch] = listWatchEntries(id)
    expect(watch).toMatchObject({
      startedAt: getLocalDate(),
      completedAt: null,
      isRewatch: false,
      moodBefore: null,
      moodBeforeScore: null,
      reasons: []
    })
  })

  it('Already watched → a finished watch, date not remembered, with no feelings yet', () => {
    const id = add('watched')
    expect(titleStatus(id)).toBe('completed')
    const watches = listWatchEntries(id)
    expect(watches).toHaveLength(1)
    expect(watches[0]).toMatchObject({
      startedAt: UNKNOWN_DATE,
      completedAt: UNKNOWN_DATE,
      datePrecision: 'unknown',
      isRewatch: false,
      moodBefore: null,
      moodAfter: null,
      moodAfterScore: null
    })
    // The rating chosen in the add form stays.
    expect(getTitle(id)?.rating).toBe(8)
  })
})
