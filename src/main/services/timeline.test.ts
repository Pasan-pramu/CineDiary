import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../db/schema'
import type { CineDiaryDatabase } from '../db/client'
import { chaptersOn, computeMilestones, type MilestoneEntry } from '../../shared/timeline'
import type { TimelineQuery } from '../../shared/types'
import { chapterSummary, getTimelineOverview, getTimelinePage } from './timeline'

// Timeline rules on hand-made data and an in-memory sample diary (no real data).

describe('milestones', () => {
  const watch = (
    id: number,
    titleId: number,
    completedAt: string | null,
    startedAt = completedAt ?? '2026-10-01'
  ): MilestoneEntry => ({ id, titleId, startedAt, completedAt })

  it('labels the first watch of each year', () => {
    const milestones = computeMilestones([
      watch(1, 1, '2025-03-01'),
      watch(2, 2, '2025-01-15'),
      watch(3, 3, '2026-02-01'),
      watch(4, 4, null, '2026-01-03') // in progress: sits on its start date
    ])
    expect(milestones.get(2)).toEqual([{ kind: 'first_of_year', label: 'First watch of 2025' }])
    expect(milestones.get(4)).toEqual([{ kind: 'first_of_year', label: 'First watch of 2026' }])
    expect(milestones.has(1)).toBe(false)
    expect(milestones.has(3)).toBe(false)
  })

  it('counts different titles completed (rewatches don’t count) for the 10th/25th/50th/100th', () => {
    const entries: MilestoneEntry[] = []
    let id = 1
    const day = (n: number): string => {
      const date = new Date(2026, 0, n) // one title per day, in title order
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    for (let title = 1; title <= 100; title++) {
      entries.push(watch(id++, title, day(title)))
      // A rewatch of title 1 early on must not push the count forward.
      if (title === 3) entries.push(watch(id++, 1, day(title)))
    }
    const milestones = computeMilestones(entries)
    const labels = [...milestones.entries()]
      .flatMap(([entryId, list]) => list.map((m) => [entryId, m.label] as const))
      .filter(([, label]) => label.includes('title completed'))
    const titleOf = (entryId: number): number => entries.find((e) => e.id === entryId)!.titleId
    expect(labels.map(([entryId, label]) => [titleOf(entryId), label])).toEqual([
      [10, '10th title completed'],
      [25, '25th title completed'],
      [50, '50th title completed'],
      [100, '100th title completed']
    ])
  })

  it('labels the first rewatch of a title (its second finished watch), only once', () => {
    const milestones = computeMilestones([
      watch(1, 7, '2025-01-01'),
      watch(2, 7, '2025-06-01'),
      watch(3, 7, '2026-06-01'),
      watch(4, 7, null, '2026-09-01') // an open run isn't a finished rewatch
    ])
    expect(milestones.get(2)).toEqual([{ kind: 'first_rewatch', label: 'First rewatch' }])
    // Watch 3 is the first watch of 2026, but not another "first rewatch".
    expect(milestones.get(3)).toEqual([{ kind: 'first_of_year', label: 'First watch of 2026' }])
  })
})

describe('chapter date matching', () => {
  const chapters = [
    { id: 1, startDate: '2025-09-01', endDate: '2026-06-30' }, // final year at university
    { id: 2, startDate: '2026-01-01', endDate: '2026-03-31' }, // exam season (overlaps)
    { id: 3, startDate: '2026-07-01', endDate: null } // ongoing: new job
  ]
  const today = '2026-10-27'

  it('includes both edges and handles overlapping chapters', () => {
    expect(chaptersOn('2025-09-01', chapters, today)).toEqual([1])
    expect(chaptersOn('2026-02-14', chapters, today)).toEqual([1, 2])
    expect(chaptersOn('2026-06-30', chapters, today)).toEqual([1])
  })

  it('runs ongoing chapters up to today, and leaves other dates outside', () => {
    expect(chaptersOn('2026-10-27', chapters, today)).toEqual([3])
    expect(chaptersOn('2026-10-28', chapters, today)).toEqual([])
    expect(chaptersOn('2025-08-31', chapters, today)).toEqual([])
  })
})

// --- On a sample diary ---

const MIGRATIONS = fileURLToPath(new URL('../db/migrations', import.meta.url))
const TODAY = '2026-10-27'
let sqlite: Database.Database
let db: CineDiaryDatabase

beforeEach(() => {
  sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS })
})
afterEach(() => sqlite.close())

const query = (overrides: Partial<TimelineQuery> = {}): TimelineQuery => ({
  search: '',
  type: 'all',
  chapterId: null,
  highlightsOnly: false,
  reasonId: null,
  moodBefore: null,
  ...overrides
})

/** `count` watches spread over months, newest in Oct 2026; some highlighted, one series. */
function seedDiary(count: number): void {
  const now = '2026-01-01T00:00:00.000Z'
  sqlite.prepare("INSERT INTO genres (id, name) VALUES (1, 'Comedy'), (2, 'Drama')").run()
  for (let id = 1; id <= count; id++) {
    sqlite
      .prepare(
        "INSERT INTO titles (id, type, title, status, created_at, updated_at) VALUES (?, ?, ?, 'completed', ?, ?)"
      )
      .run(
        id,
        id === 1 ? 'series' : 'movie',
        id === 1 ? 'The Long Series' : `Movie ${id}`,
        now,
        now
      )
    sqlite.prepare('INSERT INTO title_genres VALUES (?, ?)').run(id, id % 3 === 0 ? 2 : 1)
    // Three watches per month, going back in time.
    const monthsBack = Math.floor((id - 1) / 3)
    const date = new Date(2026, 9 - monthsBack, 10 + ((id - 1) % 3))
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    sqlite
      .prepare(
        `INSERT INTO watch_entries (id, title_id, started_at, completed_at, mood_before_score, mood_after_score,
          is_highlight, created_at, updated_at) VALUES (?, ?, ?, ?, 4, ?, ?, ?, ?)`
      )
      .run(id, id, iso, iso, 4 + (id % 4), id % 5 === 0 ? 1 : 0, now, now)
  }
}

describe('timeline pages', () => {
  it('loads whole months, newest first, without duplicates across pages', () => {
    seedDiary(200) // ~67 months
    const seen = new Set<number>()
    const months: string[] = []
    let before: string | null = null
    let pages = 0
    do {
      const page = getTimelinePage(query(), before, db, TODAY)
      for (const month of page.months) {
        months.push(month.month)
        for (const entry of month.entries) {
          expect(seen.has(entry.id)).toBe(false)
          expect(entry.date.startsWith(month.month)).toBe(true)
          seen.add(entry.id)
        }
      }
      before = page.nextBefore
      pages++
    } while (before && pages < 20)
    expect(seen.size).toBe(200)
    expect(pages).toBeGreaterThan(2) // not everything at once
    expect([...months].sort().reverse()).toEqual(months)
    expect(months[0]).toBe('2026-10')
  })

  it('filters by highlights and chapter, and keeps milestones from the whole diary', () => {
    seedDiary(30)
    sqlite
      .prepare(
        "INSERT INTO life_periods (id, name, start_date, end_date, color, created_at, updated_at) VALUES (1, 'Summer', '2026-06-01', '2026-08-31', 'amber', 'x', 'x')"
      )
      .run()

    const highlights = getTimelinePage(query({ highlightsOnly: true }), null, db, TODAY)
    const highlightIds = highlights.months.flatMap((month) =>
      month.entries.map((entry) => entry.id)
    )
    expect(highlightIds.length).toBeGreaterThan(0)
    expect(highlightIds.every((id) => id % 5 === 0)).toBe(true)

    const summer = getTimelinePage(query({ chapterId: 1 }), null, db, TODAY)
    expect(summer.months.map((month) => month.month)).toEqual(['2026-08', '2026-07', '2026-06'])
    expect(summer.months[0].entries.every((entry) => entry.chapterIds.includes(1))).toBe(true)

    // The 10th title completed keeps its label even when filtered down to one entry.
    const all = getTimelinePage(query(), null, db, TODAY)
    const tenth = all.months
      .flatMap((month) => month.entries)
      .find((entry) => entry.milestones.some((m) => m.label === '10th title completed'))
    expect(tenth).toBeDefined()
    const searched = getTimelinePage(query({ search: tenth!.title.title }), null, db, TODAY)
    const found = searched.months.flatMap((month) => month.entries).find((e) => e.id === tenth!.id)
    expect(found?.milestones).toEqual(tenth!.milestones)
  })

  it('filters by type using the Journal’s own conditions', () => {
    seedDiary(12)
    const series = getTimelinePage(query({ type: 'series' }), null, db, TODAY)
    expect(series.months.flatMap((m) => m.entries.map((e) => e.title.title))).toEqual([
      'The Long Series'
    ])
  })
})

describe('chapter summary and overview', () => {
  it('counts watches, average mood change and top genre inside a chapter', () => {
    seedDiary(12) // Oct 2026 back to Jul 2026, three per month
    const summary = chapterSummary(
      { id: 1, name: 'Autumn', startDate: '2026-09-01', endDate: null, color: 'teal', note: null },
      db,
      TODAY
    )
    // Watches 1–6 (Oct and Sep): changes 1,2,3,0,1,2 → 9/6.
    // No moods or reasons were logged in this sample, so there's no top reason or feeling.
    expect(summary).toEqual({
      watches: 6,
      averageMoodChange: 1.5,
      moodN: 6,
      topGenre: 'Comedy',
      topReason: null,
      topFeeling: null
    })
  })

  it('lists years with counts for the jump list', () => {
    seedDiary(40) // Oct 2026 back into 2025
    const overview = getTimelineOverview(query(), db, TODAY)
    expect(overview.total).toBe(40)
    expect(overview.years.map((year) => year.year)).toEqual(['2026', '2025'])
    expect(overview.years.reduce((sum, year) => sum + year.count, 0)).toBe(40)
  })
})
