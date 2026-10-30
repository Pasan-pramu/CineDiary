import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InsightsPeriod, JournalQuery } from '../../shared/types'
import { UNKNOWN_DATE } from '../../shared/watchDate'
import {
  closeMemoryDatabase,
  currentDatabase,
  insertReasons,
  insertTitle,
  insertWatch,
  openMemoryDatabase,
  titleStatus
} from '../test/memoryDb'
import { getDashboard } from './dashboard'
import { buildJsonExport, buildWatchesCsv } from './export'
import { getFeelings } from './feelings'
import { globalSearch } from './search'
import { getInsights } from './stats'
import { getTimelineOverview, getTimelinePage } from './timeline'
import { searchJournal } from './watchEntries'

// "I don't remember when" (v1.1.0): every date precision in the stats, periods, feelings,
// timeline, Journal, Home, search and exports. In-memory diary only; today is 28 Oct 2026.

vi.mock('../db/client', async (original) => ({
  ...(await original<typeof import('../db/client')>()),
  getDatabase: (await import('../test/memoryDb')).currentDatabase
}))

const TODAY = '2026-10-28'
let sqlite: ReturnType<typeof openMemoryDatabase>['sqlite']

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 28, 12, 0, 0))
})
afterAll(() => vi.useRealTimers())

/**
 * Six movies of 100 minutes, one watch each:
 *  1 Exact      5 Oct 2026 (day)                Drama   sad 3 → happy 8, Curious
 *  2 Month      Oct 2026 (month)                Drama   stressed 2 → calm 7, Curious
 *  3 This Year  2026 (year)                     Comedy  lonely 4 → happy 6
 *  4 Forgotten  don't remember (unknown)        Comedy  sad 3 → happy 9, Curious
 *  5 Old Year   2019 (year)                     Comedy  neutral 5 → happy 7
 *  6 Old Month  Oct 2019 (month)                Drama   sad 3 → calm 6
 */
beforeEach(() => {
  sqlite = openMemoryDatabase().sqlite
  insertReasons(['Curious'])
  const movie = (id: number, title: string, genre: string): void =>
    insertTitle({ id, title, runtime: 100, genres: [genre], status: 'completed', rating: 8 })
  movie(1, 'Exact', 'Drama')
  movie(2, 'Month', 'Drama')
  movie(3, 'This Year', 'Comedy')
  movie(4, 'Forgotten', 'Comedy')
  movie(5, 'Old Year', 'Comedy')
  movie(6, 'Old Month', 'Drama')
  const watch = (
    id: number,
    date: string,
    precision: 'day' | 'month' | 'year' | 'unknown',
    moodBefore: string,
    before: number,
    moodAfter: string,
    after: number,
    reasons: number[] = []
  ): void =>
    insertWatch({
      id,
      titleId: id,
      started: date,
      completed: date,
      precision,
      moodBefore,
      before,
      moodAfter,
      after,
      reasons,
      thoughts: `Memory of watch ${id}`
    })
  watch(1, '2026-10-05', 'day', 'sad', 3, 'happy', 8, [1])
  watch(2, '2026-10-01', 'month', 'stressed', 2, 'calm', 7, [1])
  watch(3, '2026-01-01', 'year', 'lonely', 4, 'happy', 6)
  watch(4, UNKNOWN_DATE, 'unknown', 'sad', 3, 'happy', 9, [1])
  watch(5, '2019-01-01', 'year', 'neutral', 5, 'happy', 7)
  watch(6, '2019-10-01', 'month', 'sad', 3, 'calm', 6)
})
afterEach(() => closeMemoryDatabase())

const insights = (period: InsightsPeriod): ReturnType<typeof getInsights> =>
  getInsights(period, currentDatabase(), TODAY)

function addChapter(id: number, start: string, end: string | null): void {
  sqlite
    .prepare(
      `INSERT INTO life_periods (id, name, start_date, end_date, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'violet', 'x', 'x')`
    )
    .run(id, `Chapter ${id}`, start, end)
}

describe('a watch with a partial or forgotten date is still a completed watch', () => {
  it('counts in All time: totals, hours, genres, moods and reasons', () => {
    const all = insights('all')
    expect(all.totals).toMatchObject({ watches: 6, movies: 6, hours: 10 })
    expect(all.genres.map((genre) => [genre.genre, genre.watches])).toEqual([
      ['Comedy', 3],
      ['Drama', 3]
    ])
    expect(all.mood.change.n).toBe(6)
    expect(all.topReasons).toMatchObject([{ label: 'Curious', watches: 3 }])
  })

  it('makes its title Completed', () => {
    for (const id of [1, 2, 3, 4, 5, 6]) expect(titleStatus(id)).toBe('completed')
  })
})

describe('periods only take watches that certainly fit', () => {
  const watchesIn = (period: InsightsPeriod): number => insights(period).totals.watches

  it('This month: the exact day and "October 2026" (a month in progress ends today)', () => {
    expect(watchesIn('month')).toBe(2)
  })

  it('This year: also "2026"; never a forgotten date', () => {
    expect(watchesIn('year')).toBe(3)
    expect(watchesIn('six_months')).toBe(2)
  })

  it('custom ranges: a month or year must lie wholly inside', () => {
    expect(watchesIn({ kind: 'range', from: '2026-10-01', to: '2026-10-15' })).toBe(1)
    expect(watchesIn({ kind: 'range', from: '2026-10-01', to: TODAY })).toBe(2)
    expect(watchesIn({ kind: 'range', from: '2019-01-01', to: '2019-12-31' })).toBe(2)
    expect(watchesIn({ kind: 'range', from: '2019-06-01', to: '2019-12-31' })).toBe(1)
    expect(watchesIn({ kind: 'range', from: '2019-10-15', to: '2019-12-31' })).toBe(0)
  })

  it('chapters: same rule, an ongoing chapter runs to today', () => {
    addChapter(1, '2026-09-01', null)
    addChapter(2, '2019-10-10', '2019-12-31')
    expect(watchesIn({ kind: 'chapter', chapterId: 1 })).toBe(2)
    expect(watchesIn({ kind: 'chapter', chapterId: 2 })).toBe(0)
  })
})

describe('charts over time', () => {
  it('watches per month: exact and month dates only', () => {
    const months = new Map(insights('all').watchesPerMonth.map((m) => [m.month, m.movies]))
    expect(months.get('2026-10')).toBe(2)
    expect(months.get('2026-01')).toBe(0) // "2026" is not January
  })

  it('feelings by month (This year): exact and month dates; the totals keep everything', () => {
    const feelings = getFeelings('year', currentDatabase(), TODAY)
    expect(feelings.watchesOverTime.bucket).toBe('month')
    const byKey = new Map(feelings.watchesOverTime.items.map((item) => [item.key, item.movies]))
    expect(byKey.get('2026-10')).toBe(2)
    expect(byKey.get('2026-01')).toBe(0)
    expect(feelings.moodBefore.total).toBe(3)
  })

  it('feelings by year (All time): year dates too; starts at the first remembered date', () => {
    const feelings = getFeelings('all', currentDatabase(), TODAY)
    expect(feelings.watchesOverTime.bucket).toBe('year')
    expect(feelings.watchesOverTime.items[0].key).toBe('2019') // not year 1
    const byKey = new Map(feelings.watchesOverTime.items.map((item) => [item.key, item.movies]))
    expect(byKey.get('2019')).toBe(2)
    expect(byKey.get('2026')).toBe(3)
    expect(feelings.moodBefore.total).toBe(6)
  })
})

describe('timeline', () => {
  const query = {
    search: '',
    type: 'all' as const,
    chapterId: null,
    highlightsOnly: false,
    reasonId: null,
    moodBefore: null
  }

  it('groups: months, "Sometime in <year>" after that year, "date not remembered" last', () => {
    const page = getTimelinePage(query, null, currentDatabase(), TODAY)
    expect(page.months.map((month) => [month.month, month.entries.map((e) => e.id)])).toEqual([
      ['2026-10', [1, 2]],
      ['2026-00', [3]],
      ['2019-10', [6]],
      ['2019-00', [5]],
      ['0000-00', [4]]
    ])
    expect(page.months[4].entries[0]).toMatchObject({ datePrecision: 'unknown', completed: true })
  })

  it('the year list has the not-remembered group last', () => {
    const overview = getTimelineOverview(query, currentDatabase(), TODAY)
    expect(overview.years).toEqual([
      { year: '2026', count: 3 },
      { year: '2019', count: 2 },
      { year: '0000', count: 1 }
    ])
  })

  it('chapter dots and the chapter filter only for watches certainly inside', () => {
    addChapter(1, '2026-09-01', null)
    const page = getTimelinePage(query, null, currentDatabase(), TODAY)
    const chapters = new Map(
      page.months.flatMap((month) => month.entries).map((entry) => [entry.id, entry.chapterIds])
    )
    expect(chapters.get(1)).toEqual([1])
    expect(chapters.get(2)).toEqual([1])
    expect(chapters.get(3)).toEqual([]) // "2026" may be before September
    expect(chapters.get(4)).toEqual([])
    const filtered = getTimelinePage({ ...query, chapterId: 1 }, null, currentDatabase(), TODAY)
    expect(filtered.months.flatMap((month) => month.entries.map((e) => e.id))).toEqual([1, 2])
  })

  it('milestones only use exact and month dates', () => {
    const page = getTimelinePage(query, null, currentDatabase(), TODAY)
    const milestones = new Map(
      page.months
        .flatMap((month) => month.entries)
        .map((entry) => [entry.id, entry.milestones.map((m) => m.label)])
    )
    expect(milestones.get(6)).toEqual(['First watch of 2019'])
    expect(milestones.get(2)).toEqual(['First watch of 2026'])
    for (const id of [3, 4, 5]) expect(milestones.get(id), String(id)).toEqual([])
  })
})

describe('journal', () => {
  const query: JournalQuery = {
    search: '',
    type: 'all',
    reasonId: null,
    moodBefore: null,
    moodImproved: false,
    hasReflection: false,
    chapterId: null,
    feelingOrReason: null
  }

  it('newest first, forgotten dates last; "this month" counts exact and month dates', () => {
    const result = searchJournal(query)
    expect(result.entries.map((entry) => entry.id)).toEqual([1, 2, 3, 6, 5, 4])
    expect(result.summary.entriesThisMonth).toBe(2)
  })

  it('the chapter filter takes only watches certainly inside the chapter', () => {
    addChapter(1, '2026-01-01', null)
    expect(searchJournal({ ...query, chapterId: 1 }).entries.map((entry) => entry.id)).toEqual([
      1, 2, 3
    ])
  })
})

describe('Home', () => {
  it('Recently watched, the mini timeline and the mood trend leave forgotten dates out', () => {
    const home = getDashboard()
    expect(home.recentlyWatched.map((watch) => watch.title.title)).toEqual([
      'Exact',
      'Month',
      'This Year',
      'Old Month',
      'Old Year'
    ])
    expect(home.recentlyWatched[1].datePrecision).toBe('month')
    expect(home.timeline.map((item) => item.entryId)).not.toContain(4)
    expect(home.moodTrend.map((point) => point.entryId)).not.toContain(4)
    expect(home.moodTrend.map((point) => point.entryId)).toContain(5)
  })

  it('"From your past" never picks a forgotten date or a month that might be recent', () => {
    // Over the next days only the 2019 watches are certainly 30+ days old.
    for (let day = 1; day <= 6; day++) {
      vi.setSystemTime(new Date(2026, 9, 28 + day, 12))
      const memory = getDashboard().memory
      expect([5, 6]).toContain(memory?.entryId)
    }
    vi.setSystemTime(new Date(2026, 9, 28, 12))
  })

  it('"On this day" needs an exact date', () => {
    // 1 Oct: "Oct 2019" is stored as 2019-10-01 but isn't known to be the 1st.
    vi.setSystemTime(new Date(2027, 9, 1, 12))
    expect(getDashboard().memory?.kind).not.toBe('on_this_day')
    vi.setSystemTime(new Date(2027, 9, 5, 12))
    expect(getDashboard().memory).toMatchObject({ kind: 'on_this_day', entryId: 1 })
    vi.setSystemTime(new Date(2026, 9, 28, 12))
  })

  it('new titles this month: only those certainly first finished this month', () => {
    expect(getDashboard().newThisMonth).toEqual({ movies: 2, series: 0 })
  })
})

describe('search', () => {
  it('shows each watch with its precision, forgotten dates last', () => {
    const hits = globalSearch('Memory of watch', currentDatabase()).journal
    expect(hits.total).toBe(6)
    expect(hits.items.map((hit) => [hit.entryId, hit.datePrecision])).toEqual([
      [1, 'day'],
      [2, 'month'],
      [3, 'year'],
      [6, 'month'],
      [5, 'year']
    ])
  })
})

describe('exports', () => {
  it('JSON: dates as far as they are known, plus the precision', () => {
    const json = buildJsonExport(sqlite, '1.1.0') as {
      titles: Array<{ title: string; watches: Array<Record<string, unknown>> }>
    }
    const watchOf = (title: string): Record<string, unknown> | undefined =>
      json.titles.find((item) => item.title === title)?.watches[0]
    expect(watchOf('Exact')).toMatchObject({
      startedAt: '2026-10-05',
      completedAt: '2026-10-05',
      datePrecision: 'day'
    })
    expect(watchOf('Month')).toMatchObject({ completedAt: '2026-10', datePrecision: 'month' })
    expect(watchOf('Old Year')).toMatchObject({ completedAt: '2019', datePrecision: 'year' })
    expect(watchOf('Forgotten')).toMatchObject({
      startedAt: null,
      completedAt: null,
      datePrecision: 'unknown'
    })
    expect(JSON.stringify(json)).not.toContain(UNKNOWN_DATE)
  })

  it('CSV: a "Date precision" column, oldest first and forgotten dates last', () => {
    const lines = buildWatchesCsv(sqlite).slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toContain('Started,Completed,Date precision,')
    expect(lines.slice(1).map((line) => line.split(',').slice(0, 6).join(','))).toEqual([
      'Old Year,Movie,,2019,2019,year',
      'Old Month,Movie,,2019-10,2019-10,month',
      'This Year,Movie,,2026,2026,year',
      'Month,Movie,,2026-10,2026-10,month',
      'Exact,Movie,,2026-10-05,2026-10-05,day',
      'Forgotten,Movie,,,,unknown'
    ])
  })
})
