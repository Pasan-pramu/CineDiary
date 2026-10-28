import Database from 'better-sqlite3'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../db/schema'
import { titles, watchEntries } from '../db/schema'
import type { CineDiaryDatabase } from '../db/client'
import type { MoodKey } from '../../shared/constants'
import type { JournalQuery, LifePeriod } from '../../shared/types'
import { chapterAnalysis, feelingDistributions, getFeelings, timeBuckets } from './feelings'
import { getInsights, resolvePeriod } from './stats'
import { chapterSummary } from './timeline'
import { journalConditions } from './watchEntries'

// Feelings, reasons and life chapters (M10c) on a small hand-made diary in memory (no real data).

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const TODAY = '2026-10-28'
const NOW = '2026-01-01T00:00:00.000Z'
let sqlite: Database.Database
let db: CineDiaryDatabase

beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS })
  const reasons: Array<[string, string, number]> = [
    ['lonely', 'Lonely', 0],
    ['curious', 'Curious', 0],
    ['stressed', 'Stressed', 0],
    ['needed_an_escape', 'Needed an escape', 0],
    ['wanted_to_laugh', 'Wanted to laugh', 0],
    ['rewatch', 'Rewatch', 0],
    ['bored_custom', 'Bored', 1] // a custom reason that shares a mood's name
  ]
  reasons.forEach(([key, label, custom], index) =>
    sqlite
      .prepare('INSERT INTO reasons (id, key, label, is_custom) VALUES (?, ?, ?, ?)')
      .run(index + 1, key, label, custom)
  )
  sqlite.prepare("INSERT INTO genres (id, name) VALUES (1, 'Comedy'), (2, 'Drama')").run()
})
afterEach(() => sqlite.close())

const REASON_IDS: Record<string, number> = {
  lonely: 1,
  curious: 2,
  stressed: 3,
  needed_an_escape: 4,
  wanted_to_laugh: 5,
  rewatch: 6,
  bored_custom: 7
}

function addTitle(id: number, genreId = 1, type: 'movie' | 'series' = 'movie'): void {
  sqlite
    .prepare(
      "INSERT INTO titles (id, type, title, status, created_at, updated_at) VALUES (?, ?, ?, 'completed', ?, ?)"
    )
    .run(id, type, `Title ${id}`, NOW, NOW)
  sqlite.prepare('INSERT INTO title_genres VALUES (?, ?)').run(id, genreId)
}

interface WatchSeed {
  id: number
  titleId: number
  /** null = still in progress. */
  completed: string | null
  started?: string
  before?: MoodKey | null
  beforeScore?: number | null
  after?: MoodKey | null
  afterScore?: number | null
  reasons?: string[]
}

function addWatch(watch: WatchSeed): void {
  sqlite
    .prepare(
      `INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before,
        mood_before_score, mood_after, mood_after_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      watch.id,
      watch.titleId,
      watch.started ?? watch.completed ?? TODAY,
      watch.completed,
      watch.before ?? null,
      watch.beforeScore ?? null,
      watch.after ?? null,
      watch.afterScore ?? null,
      NOW,
      NOW
    )
  for (const key of watch.reasons ?? []) {
    sqlite.prepare('INSERT INTO watch_entry_reasons VALUES (?, ?)').run(watch.id, REASON_IDS[key])
  }
}

function chapter(id: number, startDate: string, endDate: string | null): LifePeriod {
  sqlite
    .prepare(
      "INSERT INTO life_periods (id, name, start_date, end_date, color, created_at, updated_at) VALUES (?, ?, ?, ?, 'teal', ?, ?)"
    )
    .run(id, `Chapter ${id}`, startDate, endDate, NOW, NOW)
  return { id, name: `Chapter ${id}`, startDate, endDate, color: 'teal', note: null }
}

/** Five finished watches in Oct 2026 and one in progress. */
function seedOctober(): void {
  for (let id = 1; id <= 5; id++) addTitle(id, id <= 3 ? 1 : 2)
  addTitle(6, 1, 'series')
  addWatch({
    id: 1,
    titleId: 1,
    completed: '2026-10-02',
    before: 'lonely',
    beforeScore: 3,
    after: 'calm',
    afterScore: 6,
    reasons: ['lonely', 'curious']
  })
  addWatch({
    id: 2,
    titleId: 2,
    completed: '2026-10-05',
    before: 'lonely',
    beforeScore: 4,
    after: 'happy',
    afterScore: 5,
    reasons: ['lonely']
  })
  addWatch({ id: 3, titleId: 3, completed: '2026-10-09', before: 'stressed', reasons: ['curious'] })
  addWatch({ id: 4, titleId: 4, completed: '2026-10-12' }) // nothing recorded
  addWatch({ id: 5, titleId: 5, completed: '2026-10-20', after: 'calm', afterScore: 7 })
  // In progress: not a finished watch, so never part of any distribution.
  addWatch({ id: 6, titleId: 6, completed: null, started: '2026-10-25', before: 'lonely' })
}

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' }

describe('distributions', () => {
  it('counts mood before with "Not recorded" last, so shares are of every finished watch', () => {
    seedOctober()
    const { moodBefore } = feelingDistributions(OCTOBER, db)
    expect(moodBefore.total).toBe(5)
    expect(
      moodBefore.items.map((item) => [item.key, item.label, item.watches, item.share])
    ).toEqual([
      ['lonely', 'Lonely', 2, 0.4],
      ['stressed', 'Stressed', 1, 0.2],
      [null, 'Not recorded', 2, 0.4]
    ])
    // Nothing is dropped: the rows add up to all watches, and shares to 100%.
    expect(moodBefore.items.reduce((sum, item) => sum + item.watches, 0)).toBe(5)
    expect(moodBefore.items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1)
  })

  it('counts mood after the same way', () => {
    seedOctober()
    const { moodAfter } = feelingDistributions(OCTOBER, db)
    expect(moodAfter.items.map((item) => [item.label, item.watches])).toEqual([
      ['Calm', 2],
      ['Happy', 1],
      ['Not recorded', 2]
    ])
  })

  it('counts every reason of a watch, and watches without a reason as "Not recorded"', () => {
    seedOctober()
    const { reasons } = feelingDistributions(OCTOBER, db)
    expect(
      reasons.items.map((item) => [item.key, item.watches, item.share, item.reasonId])
    ).toEqual([
      ['curious', 2, 0.4, 2],
      ['lonely', 2, 0.4, 1],
      [null, 2, 0.4, null]
    ])
    // Watch 1 has two reasons, so reason shares may add up to more than 100%.
    expect(reasons.items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1.2)
  })

  it('gives a group its mood change only with at least 2 watches that have both scores', () => {
    seedOctober()
    const { moodBefore, reasons } = feelingDistributions(OCTOBER, db)
    const lonely = moodBefore.items.find((item) => item.key === 'lonely')
    expect(lonely).toMatchObject({ averageChange: 2, changeN: 2 }) // (3 + 1) / 2
    const stressed = moodBefore.items.find((item) => item.key === 'stressed')
    expect(stressed).toMatchObject({ averageChange: null, changeN: 0 })
    const curious = reasons.items.find((item) => item.key === 'curious')
    expect(curious).toMatchObject({ averageChange: null, changeN: 1 }) // one paired watch only
  })

  it('returns empty distributions for an empty range', () => {
    seedOctober()
    const { moodBefore, reasons } = feelingDistributions(
      { from: '2020-01-01', to: '2020-12-31' },
      db
    )
    expect(moodBefore).toEqual({ total: 0, items: [] })
    expect(reasons).toEqual({ total: 0, items: [] })
  })
})

describe('periods', () => {
  it('resolves presets, custom ranges and chapters (ongoing ones run to today)', () => {
    chapter(1, '2026-09-01', null)
    chapter(2, '2025-09-01', '2026-06-30')
    expect(resolvePeriod('month', TODAY, db)).toEqual({ from: '2026-10-01', to: null })
    expect(resolvePeriod('all', TODAY, db)).toEqual({ from: null, to: null })
    expect(
      resolvePeriod({ kind: 'range', from: '2026-01-01', to: '2026-02-01' }, TODAY, db)
    ).toEqual({ from: '2026-01-01', to: '2026-02-01' })
    expect(resolvePeriod({ kind: 'chapter', chapterId: 1 }, TODAY, db)).toEqual({
      from: '2026-09-01',
      to: TODAY
    })
    expect(resolvePeriod({ kind: 'chapter', chapterId: 2 }, TODAY, db)).toEqual({
      from: '2025-09-01',
      to: '2026-06-30'
    })
  })

  it('makes every Insights stat follow a chapter or custom range (both ends inclusive)', () => {
    seedOctober()
    chapter(1, '2026-10-05', '2026-10-12')
    const byChapter = getInsights({ kind: 'chapter', chapterId: 1 }, db, TODAY)
    expect(byChapter.totals.watches).toBe(3) // watches 2, 3 and 4
    expect(byChapter.from).toBe('2026-10-05')
    expect(byChapter.to).toBe('2026-10-12')
    const byRange = getInsights({ kind: 'range', from: '2026-10-02', to: '2026-10-02' }, db, TODAY)
    expect(byRange.totals.watches).toBe(1)
    // A chapter that was deleted shows nothing rather than everything.
    expect(getInsights({ kind: 'chapter', chapterId: 99 }, db, TODAY).totals.watches).toBe(0)
  })
})

describe('over time', () => {
  it('uses zero-filled months, or years for ranges longer than 24 months', () => {
    expect(timeBuckets('2026-08-15', '2026-10-28')).toEqual({
      bucket: 'month',
      buckets: ['2026-08', '2026-09', '2026-10']
    })
    expect(timeBuckets('2024-11-01', '2026-10-28').bucket).toBe('month') // exactly 24 months
    expect(timeBuckets('2024-10-01', '2026-10-28')).toEqual({
      bucket: 'year',
      buckets: ['2024', '2025', '2026']
    })
    expect(timeBuckets(null, TODAY)).toEqual({ bucket: 'month', buckets: [] })
  })

  it('follows the top 5 recorded values and counts "Not recorded" aside', () => {
    const moods: MoodKey[] = [
      'lonely',
      'lonely',
      'lonely',
      'sad',
      'sad',
      'calm',
      'bored',
      'happy',
      'neutral'
    ]
    moods.forEach((mood, index) => {
      addTitle(index + 1)
      addWatch({
        id: index + 1,
        titleId: index + 1,
        completed: index < 4 ? '2026-08-10' : '2026-10-10',
        before: mood
      })
    })
    addTitle(20)
    addWatch({ id: 20, titleId: 20, completed: '2026-09-10' }) // no mood
    const feelings = getFeelings({ kind: 'range', from: '2026-08-01', to: '2026-10-31' }, db, TODAY)
    const over = feelings.feelingsOverTime
    expect(over.buckets).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(over.series.map((series) => series.key)).toEqual([
      'lonely',
      'sad',
      'bored',
      'calm',
      'happy'
    ])
    expect(over.series[0].counts).toEqual([3, 0, 0])
    expect(over.series[1].counts).toEqual([1, 0, 1])
    expect(over.notRecorded).toBe(1)
    expect(feelings.watchesOverTime.items.map((item) => item.movies)).toEqual([4, 1, 5])
  })

  it('starts "All time" at the first finished watch', () => {
    addTitle(1)
    addWatch({ id: 1, titleId: 1, completed: '2026-09-03', before: 'calm' })
    const feelings = getFeelings('all', db, TODAY)
    expect(feelings.watchesOverTime.items.map((item) => item.key)).toEqual(['2026-09', '2026-10'])
  })
})

describe('life chapters', () => {
  it('breaks down overlapping and ongoing chapters independently', () => {
    seedOctober()
    // Watches after today never count for an ongoing chapter.
    addTitle(9)
    addWatch({ id: 9, titleId: 9, completed: '2026-11-15', before: 'lonely' })
    const autumn = chapter(1, '2026-10-01', null) // ongoing: Oct 1 → today
    const midOctober = chapter(2, '2026-10-05', '2026-10-12') // overlaps autumn

    const a = chapterAnalysis(autumn, db, TODAY)
    expect(a.to).toBe(TODAY)
    expect(a.watches).toBe(5)
    expect(a.topFeelings.map((item) => [item.key, item.share])).toEqual([
      ['lonely', 0.4],
      ['stressed', 0.2]
    ])
    expect(a.topReasons.map((item) => item.key)).toEqual(['curious', 'lonely'])
    expect(a.mood.change).toEqual({ average: 2, n: 2 })
    expect(a.topGenres.map((genre) => genre.genre)).toEqual(['Comedy', 'Drama'])
    expect(a.helpedMost.enoughData).toBe(true)
    expect(a.helpedMost.items.map((item) => item.titleId)).toEqual([1, 2])

    const b = chapterAnalysis(midOctober, db, TODAY)
    expect(b.watches).toBe(3) // watches 2, 3, 4 are in both chapters
    expect(b.topFeelings.map((item) => [item.key, item.watches])).toEqual([
      ['lonely', 1],
      ['stressed', 1]
    ])
    // Only one watch with both scores: "what helped most" waits for the 2-watch minimum.
    expect(b.helpedMost).toEqual({ items: [], n: 1, enoughData: false })
  })

  it('adds the top reason and feeling to the Timeline chapter summary', () => {
    seedOctober()
    const summary = chapterSummary(chapter(1, '2026-10-01', null), db, TODAY)
    expect(summary.watches).toBe(5)
    expect(summary.topFeeling).toMatchObject({ key: 'lonely', share: 0.4 })
    expect(summary.topReason).toMatchObject({ key: 'curious', share: 0.4 })
  })
})

describe('journal filters', () => {
  const baseQuery: JournalQuery = {
    search: '',
    type: 'all',
    reasonId: null,
    moodBefore: null,
    moodImproved: false,
    hasReflection: false,
    chapterId: null,
    feelingOrReason: null
  }
  const matching = (overrides: Partial<JournalQuery>): number[] =>
    db
      .select({ id: watchEntries.id })
      .from(watchEntries)
      .innerJoin(titles, eq(watchEntries.titleId, titles.id))
      .where(and(...journalConditions({ ...baseQuery, ...overrides }, TODAY)))
      .orderBy(watchEntries.id)
      .all()
      .map((row) => row.id)

  it('matches a feeling OR the reason with the same name, each watch once', () => {
    for (let id = 1; id <= 5; id++) addTitle(id)
    addWatch({ id: 1, titleId: 1, completed: '2026-10-01', before: 'lonely' }) // feeling only
    addWatch({ id: 2, titleId: 2, completed: '2026-10-02', reasons: ['lonely'] }) // reason only
    addWatch({ id: 3, titleId: 3, completed: '2026-10-03', before: 'lonely', reasons: ['lonely'] }) // both
    addWatch({ id: 4, titleId: 4, completed: '2026-10-04', before: 'sad', reasons: ['curious'] }) // neither
    addWatch({ id: 5, titleId: 5, completed: '2026-10-05', after: 'lonely' }) // mood after doesn't count
    expect(matching({ feelingOrReason: 'lonely' })).toEqual([1, 2, 3])
  })

  it('matches a custom reason by its label', () => {
    addTitle(1)
    addTitle(2)
    addWatch({ id: 1, titleId: 1, completed: '2026-10-01', reasons: ['bored_custom'] })
    addWatch({ id: 2, titleId: 2, completed: '2026-10-02', before: 'bored' })
    expect(matching({ feelingOrReason: 'bored' })).toEqual([1, 2])
  })

  it('filters by chapter, including open watches and ongoing chapters', () => {
    seedOctober()
    chapter(1, '2026-10-05', '2026-10-12')
    chapter(2, '2026-10-20', null)
    expect(matching({ chapterId: 1 })).toEqual([2, 3, 4])
    expect(matching({ chapterId: 2 })).toEqual([5, 6]) // 6 is in progress, dated by its start
    expect(matching({ chapterId: 99 })).toEqual([])
    expect(matching({ chapterId: 1, feelingOrReason: 'lonely' })).toEqual([2])
  })
})
