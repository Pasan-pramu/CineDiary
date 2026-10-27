import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../db/schema'
import type { CineDiaryDatabase } from '../db/client'
import type { DiscoverItem, DiscoverQuery } from '../../shared/types'
import { discoverIn, recommend } from './recommendations'

// Discover's ranking and grouping rules on an in-memory sample diary (no real data).

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const NOW = new Date(2026, 9, 27) // 27 Oct 2026; "6+ months ago" = before 27 Apr 2026

let sqlite: Database.Database
let db: CineDiaryDatabase

interface SampleTitle {
  id: number
  title: string
  type?: 'movie' | 'series'
  genres: string[]
  runtime: number | null
  status?: string
  rating?: number | null
  favorite?: boolean
}

interface SampleWatch {
  titleId: number
  completed: string | null
  moodBefore?: string | null
  before?: number | null
  after?: number | null
  reasons?: string[]
  thoughts?: string
}

const REASON_KEYS = [
  'sad',
  'lonely',
  'needed_an_escape',
  'wanted_to_laugh',
  'wanted_adrenaline',
  'stressed'
]

function seed(titles: SampleTitle[], watches: SampleWatch[]): void {
  const now = '2026-01-01T00:00:00.000Z'
  REASON_KEYS.forEach((key, index) =>
    sqlite.prepare('INSERT INTO reasons (id, key, label, is_custom) VALUES (?, ?, ?, 0)').run(
      index + 1,
      key,
      key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    )
  )
  const genreIds = new Map<string, number>()
  for (const title of titles) {
    sqlite
      .prepare(
        `INSERT INTO titles (id, type, title, runtime_minutes, status, rating, is_favorite, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title.id,
        title.type ?? 'movie',
        title.title,
        title.runtime,
        title.status ?? 'completed',
        title.rating ?? null,
        title.favorite ? 1 : 0,
        now,
        now
      )
    for (const genre of title.genres) {
      if (!genreIds.has(genre)) {
        genreIds.set(genre, genreIds.size + 1)
        sqlite
          .prepare('INSERT INTO genres (id, name) VALUES (?, ?)')
          .run(genreIds.get(genre), genre)
      }
      sqlite.prepare('INSERT INTO title_genres VALUES (?, ?)').run(title.id, genreIds.get(genre))
    }
  }
  watches.forEach((watch, index) => {
    const id = index + 1
    sqlite
      .prepare(
        `INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before, mood_before_score,
          mood_after_score, thoughts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        watch.titleId,
        watch.completed ?? '2026-10-20',
        watch.completed,
        watch.moodBefore ?? null,
        watch.before ?? null,
        watch.after ?? null,
        watch.thoughts ?? null,
        now,
        now
      )
    for (const reason of watch.reasons ?? []) {
      sqlite
        .prepare('INSERT INTO watch_entry_reasons VALUES (?, ?)')
        .run(id, REASON_KEYS.indexOf(reason) + 1)
    }
  })
}

/** The sample diary used by most tests (prompt "I'm feeling down"). */
function seedSample(): void {
  seed(
    [
      { id: 1, title: 'Paddington 2', genres: ['Comedy'], runtime: 104, rating: 8 },
      { id: 2, title: 'Ted Lasso', type: 'series', genres: ['Comedy'], runtime: 30 },
      { id: 3, title: 'Inside Out', genres: ['Animation'], runtime: 95, status: 'watching' },
      { id: 4, title: 'Dropped Drama', genres: ['Comedy'], runtime: 100, status: 'dropped' },
      { id: 5, title: 'Heavy Drama', genres: ['Drama'], runtime: 120 },
      { id: 6, title: 'Planned Comedy', genres: ['Comedy'], runtime: 90, status: 'planned' },
      { id: 7, title: 'Planned Family Film', genres: ['Family'], runtime: null, status: 'planned' },
      { id: 8, title: 'Planned Thriller', genres: ['Thriller'], runtime: 100, status: 'planned' },
      {
        id: 9,
        title: 'Old Favorite',
        genres: ['Family'],
        runtime: 100,
        rating: 9,
        favorite: true
      },
      { id: 10, title: 'Recent Favorite', genres: ['Comedy'], runtime: 100, favorite: true },
      { id: 11, title: 'Long Comedy Epic', genres: ['Comedy'], runtime: 200, status: 'planned' },
      { id: 12, title: 'Action Flick', genres: ['Action'], runtime: 110 }
    ],
    [
      { titleId: 1, completed: '2026-01-10', moodBefore: 'sad', before: 3, after: 8 },
      {
        titleId: 1,
        completed: '2026-03-02',
        moodBefore: 'lonely',
        before: 2,
        after: 7,
        thoughts: 'Kindness wins.'
      },
      {
        titleId: 2,
        completed: '2026-08-10',
        reasons: ['sad'],
        moodBefore: 'neutral',
        before: 4,
        after: 8
      },
      {
        titleId: 2,
        completed: '2026-09-10',
        reasons: ['sad'],
        moodBefore: 'neutral',
        before: 5,
        after: 8
      },
      // Watching now (open run) and dropped: never suggested.
      { titleId: 3, completed: '2026-02-01', moodBefore: 'sad', before: 3, after: 9 },
      { titleId: 3, completed: null, moodBefore: 'sad', before: 3 },
      { titleId: 4, completed: '2026-02-01', moodBefore: 'sad', before: 2, after: 9 },
      // Made me feel worse: not a "helped" title.
      { titleId: 5, completed: '2026-04-01', moodBefore: 'sad', before: 5, after: 3 },
      { titleId: 9, completed: '2025-01-15', moodBefore: 'happy', before: 7, after: 8 },
      { titleId: 10, completed: '2026-09-01', moodBefore: 'happy', before: 7, after: 8 },
      { titleId: 12, completed: '2026-05-01', reasons: ['wanted_adrenaline'], before: 4, after: 8 }
    ]
  )
}

const query = (overrides: Partial<DiscoverQuery> = {}): DiscoverQuery => ({
  prompt: 'down',
  type: 'all',
  maxRuntime: null,
  includeRewatches: true,
  includeUnknownRuntime: false,
  ...overrides
})

const titlesOf = (items: DiscoverItem[]): string[] => items.map((item) => item.title.title)

beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS })
})
afterEach(() => sqlite.close())

describe('discover', () => {
  it('fills the three groups in priority order, each title only once', () => {
    seedSample()
    const result = discoverIn(db, query(), NOW)

    expect(titlesOf(result.helped.items)).toEqual(['Paddington 2', 'Ted Lasso'])
    // Paddington 2 is also an 8+ title not watched since March, but it's already above.
    expect(titlesOf(result.watchlist)).toEqual([
      'Long Comedy Epic',
      'Planned Comedy',
      'Planned Family Film'
    ])
    expect(titlesOf(result.revisit.items)).toEqual(['Old Favorite'])

    const all = [...result.helped.items, ...result.watchlist, ...result.revisit.items]
    expect(new Set(all.map((item) => item.title.id)).size).toBe(all.length)
  })

  it('never suggests titles I’m watching now or dropped', () => {
    seedSample()
    const result = discoverIn(db, query(), NOW)
    const all = titlesOf([...result.helped.items, ...result.watchlist, ...result.revisit.items])
    expect(all).not.toContain('Inside Out')
    expect(all).not.toContain('Dropped Drama')
    expect(all).not.toContain('Heavy Drama') // made me feel worse
    expect(all).not.toContain('Recent Favorite') // watched less than 6 months ago
  })

  it('explains each suggestion', () => {
    seedSample()
    const result = discoverIn(db, query(), NOW)
    expect(result.helped.items[0].why).toEqual({
      kind: 'history',
      label: 'Felt lonely',
      before: 2,
      after: 7,
      averageChange: 5,
      n: 2,
      note: 'Kindness wins.'
    })
    expect(result.helped.items[1].why).toMatchObject({ label: 'Sad', n: 2 }) // matched by reason
    // Comedy, when I felt down: Paddington 2 (+5, +5), Ted Lasso (+4, +3) and the dropped title's
    // finished watch (+7) — genre evidence counts every finished watch with both scores.
    expect(result.watchlist[0].why).toMatchObject({ kind: 'genre', genre: 'Comedy', n: 5 })
    expect(
      result.watchlist[0].why.kind === 'genre' && result.watchlist[0].why.averageChange
    ).toBeCloseTo(4.8)
    // Family isn't proven by my history, so it's the prompt's own genre (labeled fallback).
    expect(result.watchlist[2].why).toEqual({ kind: 'genreFallback', genre: 'Family' })
    expect(result.revisit.items[0].why).toMatchObject({
      kind: 'revisit',
      favorite: true,
      rating: 9,
      lastWatched: '2025-01-15',
      genre: 'Family',
      history: null
    })
  })

  it('ranks the prompt’s own genres (fallback) below history-proven ones', () => {
    seed(
      [
        { id: 1, title: 'Comfort Comedy', genres: ['Comedy'], runtime: 90 },
        {
          id: 2,
          title: 'A Planned Animation',
          genres: ['Animation'],
          runtime: 90,
          status: 'planned'
        },
        { id: 3, title: 'Z Planned Comedy', genres: ['Comedy'], runtime: 90, status: 'planned' }
      ],
      [
        { titleId: 1, completed: '2026-01-01', moodBefore: 'sad', before: 3, after: 7 },
        { titleId: 1, completed: '2026-02-01', moodBefore: 'sad', before: 4, after: 7 }
      ]
    )
    const { watchlist } = discoverIn(db, query(), NOW)
    expect(titlesOf(watchlist)).toEqual(['Z Planned Comedy', 'A Planned Animation'])
    expect(watchlist[0].why.kind).toBe('genre')
    expect(watchlist[1].why).toEqual({ kind: 'genreFallback', genre: 'Animation' })
  })

  it('needs at least 2 matching watches before "Helped you before" shows anything', () => {
    seedSample()
    const result = discoverIn(db, query({ prompt: 'adrenaline' }), NOW)
    expect(result.helped).toMatchObject({ items: [], n: 1, enoughData: false })
  })

  it('applies the runtime filter (episode runtime for series) and counts unknown runtimes', () => {
    seedSample()
    const result = discoverIn(db, query({ maxRuntime: 60 }), NOW)
    expect(titlesOf(result.helped.items)).toEqual(['Ted Lasso']) // 30-minute episodes
    expect(titlesOf(result.watchlist)).toEqual([])
    expect(result.hiddenUnknownRuntime).toBe(1) // Planned Family Film

    const anyway = discoverIn(db, query({ maxRuntime: 60, includeUnknownRuntime: true }), NOW)
    expect(titlesOf(anyway.watchlist)).toEqual(['Planned Family Film'])
    expect(anyway.hiddenUnknownRuntime).toBe(0)
  })

  it('filters by type', () => {
    seedSample()
    const result = discoverIn(db, query({ type: 'series' }), NOW)
    expect(titlesOf(result.helped.items)).toEqual(['Ted Lasso'])
    expect(result.watchlist).toEqual([])
    expect(result.revisit.items).toEqual([])
  })

  it('without rewatches, only unwatched titles are suggested', () => {
    seedSample()
    const result = discoverIn(db, query({ includeRewatches: false }), NOW)
    expect(result.helped).toMatchObject({ items: [], hidden: true })
    expect(result.revisit).toEqual({ items: [], hidden: true })
    expect(titlesOf(result.watchlist)).toEqual([
      'Long Comedy Epic',
      'Planned Comedy',
      'Planned Family Film'
    ])
  })
})

describe('recommend (Home) still works the same', () => {
  it('ranks titles that lifted a mood, excluding ones I’m watching', () => {
    seedSample()
    const result = recommend({ mood: 'sad', reasonKey: null, type: 'all' }, db)
    // Sad watches: Paddington (+5), Ted Lasso via the "sad" reason (+4, +3), Dropped Drama (+7),
    // Heavy Drama (−2); Inside Out is being watched, so it's left out.
    expect(result.n).toBe(5)
    expect(result.items.map((item) => [item.title.title, item.averageChange, item.n])).toEqual([
      ['Dropped Drama', 7, 1],
      ['Paddington 2', 5, 1],
      ['Ted Lasso', 3.5, 2]
    ])
  })
})
