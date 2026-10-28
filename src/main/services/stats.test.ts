import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CineDiaryDatabase } from '../db/client'
import { closeMemoryDatabase, insertTitle, insertWatch, openMemoryDatabase } from '../test/memoryDb'
import { getInsights } from './stats'

// Stats rules that must never break: missing scores and ratings are left out of averages
// (never counted as 0), and hours follow the runtime rules. In-memory diary, no real data.

const TODAY = '2026-10-28'
let db: CineDiaryDatabase

beforeEach(() => {
  db = openMemoryDatabase().db
  insertTitle({ id: 1, title: 'Paddington 2', runtime: 100, rating: 8, genres: ['Comedy'] })
  insertTitle({ id: 2, title: 'Heat', runtime: 170, rating: null, genres: ['Crime'] })
  insertTitle({
    id: 3,
    title: 'Ted Lasso',
    type: 'series',
    runtime: 30,
    rating: 10,
    genres: ['Comedy']
  })
  insertTitle({ id: 4, title: 'Planned only', runtime: 90, rating: 2 })
  // Both scores.
  insertWatch({ id: 1, titleId: 1, started: '2026-10-01', before: 3, after: 8 })
  insertWatch({ id: 2, titleId: 1, started: '2026-10-05', before: 5, after: 6 })
  // Only a "before" score.
  insertWatch({ id: 3, titleId: 2, started: '2026-10-07', before: 4 })
  // No scores at all.
  insertWatch({ id: 4, titleId: 2, started: '2026-10-09' })
  // Series: finished run of 10 episodes, and an open run with 4 episodes so far.
  insertWatch({ id: 5, titleId: 3, started: '2026-09-01', completed: '2026-10-10', episodes: 10 })
  insertWatch({ id: 6, titleId: 3, started: '2026-10-20', completed: null, episodes: 4, before: 1 })
})
afterEach(() => closeMemoryDatabase())

describe('mood averages', () => {
  it('average only the watches that have that score', () => {
    const { mood } = getInsights('all', db, TODAY)
    // Before: 3, 5, 4 (the open run's 1 isn't a finished watch). After: 8, 6.
    expect(mood.before).toEqual({ average: 4, n: 3 })
    expect(mood.after).toEqual({ average: 7, n: 2 })
  })

  it('mood change needs both scores on the same watch', () => {
    const { mood } = getInsights('all', db, TODAY)
    // +5 and +1 only.
    expect(mood.change).toEqual({ average: 3, n: 2 })
  })

  it('are empty (not 0) when nothing was scored', () => {
    const { mood } = getInsights({ kind: 'range', from: '2026-10-09', to: '2026-10-09' }, db, TODAY)
    expect(mood.before).toEqual({ average: null, n: 0 })
    expect(mood.change).toEqual({ average: null, n: 0 })
  })

  it('need at least 2 scored watches per genre', () => {
    const { moodByGenre } = getInsights('all', db, TODAY)
    expect(moodByGenre.items.map((item) => [item.label, item.averageChange, item.n])).toEqual([
      ['Comedy', 3, 2]
    ])
  })
})

describe('totals', () => {
  it('average rating ignores unrated titles and titles never watched', () => {
    const { totals } = getInsights('all', db, TODAY)
    // Paddington 8 and Ted Lasso 10; Heat has no rating, "Planned only" was never watched.
    expect(totals.averageRating).toBe(9)
    expect(totals.ratedTitles).toBe(2)
  })

  it('hours: movie runtime per finished watch plus episodes × episode runtime', () => {
    const { totals } = getInsights('all', db, TODAY)
    // Movies: 100 + 100 + 170 + 170 minutes. Series: (10 + 4) × 30 minutes, open run included.
    expect(totals.hours).toBeCloseTo((540 + 420) / 60)
    expect(totals.episodes).toBe(14)
  })

  it('counts finished watches and different titles', () => {
    const { totals } = getInsights('all', db, TODAY)
    expect(totals.watches).toBe(5)
    expect(totals.movies).toBe(2)
    expect(totals.series).toBe(1)
  })
})
