import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CineDiaryDatabase } from '../db/client'
import type { CollectionQuery, LanguageBreakdown } from '../../shared/types'
import { UNKNOWN_DATE } from '../../shared/watchDate'
import { closeMemoryDatabase, insertTitle, insertWatch, openMemoryDatabase } from '../test/memoryDb'
import { getLanguages } from './stats'
import { listLanguages, searchTitles } from './titles'

// The Languages chart (stats.getLanguages) and the Collection's language filter. Each title
// counts once, spellings of a language are grouped, and the chart follows the Insights period.
// In-memory diary, no real data.

vi.mock('../db/client', async (original) => ({
  ...(await original<typeof import('../db/client')>()),
  getDatabase: (await import('../test/memoryDb')).currentDatabase
}))

const TODAY = '2026-10-28'
let db: CineDiaryDatabase
let sqlite: Database.Database

/** [label, titles] per bar, in order. */
function bars(breakdown: LanguageBreakdown): Array<[string, number]> {
  return breakdown.bars.map((bar) => [bar.label, bar.titles])
}

beforeEach(() => {
  ;({ db, sqlite } = openMemoryDatabase())
  insertTitle({ id: 1, title: 'Parasite', language: 'ko' })
  insertTitle({ id: 2, title: 'Oldboy', language: 'Korean' })
  insertTitle({ id: 3, title: 'Squid Game', type: 'series', language: 'korean' })
  insertTitle({ id: 4, title: 'Heat', language: 'English' })
  insertTitle({ id: 5, title: 'The Office', type: 'series', language: 'en' })
  insertTitle({ id: 6, title: 'Kumbalangi Nights', language: 'ml' })
  insertTitle({ id: 7, title: 'Planned only', language: 'ja' })
  insertTitle({ id: 8, title: 'Still watching', type: 'series', language: 'fr' })
  insertTitle({ id: 9, title: 'No language yet' })
  insertTitle({ id: 10, title: 'Silent film', language: 'xx' })
  insertTitle({ id: 11, title: 'Star Trek fan film', language: 'Klingon' })
  // Parasite three times (two in 2025): still one title.
  insertWatch({ id: 1, titleId: 1, started: '2025-03-01' })
  insertWatch({ id: 2, titleId: 1, started: '2025-08-01' })
  insertWatch({ id: 3, titleId: 1, started: '2026-10-01' })
  insertWatch({ id: 4, titleId: 2, started: '2025-06-01' })
  insertWatch({ id: 5, titleId: 3, started: '2026-01-15', completed: '2026-02-01' })
  insertWatch({ id: 6, titleId: 4, started: '2026-05-01' })
  insertWatch({ id: 7, titleId: 5, started: '2024-01-01' })
  insertWatch({ id: 8, titleId: 6, started: '2026-09-01', precision: 'month' })
  insertWatch({ id: 9, titleId: 8, started: '2026-10-20', completed: null, episodes: 3 })
  insertWatch({ id: 10, titleId: 9, started: '2026-01-10' })
  insertWatch({ id: 11, titleId: 10, started: UNKNOWN_DATE, precision: 'unknown' })
  insertWatch({ id: 12, titleId: 11, started: '2026-01-01', precision: 'year' })
})
afterEach(() => closeMemoryDatabase())

describe('languages chart', () => {
  it('counts each finished title once and groups codes with names', () => {
    const { all } = getLanguages('all', db, TODAY)
    // Not "Planned only" (never watched) or "Still watching" (no finished watch).
    expect(all.total).toBe(9)
    expect(bars(all)).toEqual([
      ['Korean', 3],
      ['English', 2],
      ['Klingon', 1],
      ['Malayalam', 1],
      ['No spoken language', 1],
      ['Not recorded', 1]
    ])
    expect(all.bars[0]).toMatchObject({ key: 'ko', share: 3 / 9, members: [] })
  })

  it('leaves "Not recorded" and "No spoken language" out of the language count', () => {
    const { all } = getLanguages('all', db, TODAY)
    expect(all.languageCount).toBe(4)
    expect(all.top).toEqual({ key: 'ko', label: 'Korean', titles: 3, share: 3 / 9 })
  })

  it('splits movies and series', () => {
    const { movie, series } = getLanguages('all', db, TODAY)
    expect(bars(movie)).toEqual([
      ['Korean', 2],
      ['English', 1],
      ['Klingon', 1],
      ['Malayalam', 1],
      ['No spoken language', 1],
      ['Not recorded', 1]
    ])
    expect(bars(series)).toEqual([
      ['English', 1],
      ['Korean', 1]
    ])
    expect(series.total).toBe(2)
  })

  it('groups everything after the top 6 as "Other", before "Not recorded"', () => {
    const extra = ['French', 'de', 'es', 'it', 'Japanese', 'hi']
    extra.forEach((language, index) => {
      insertTitle({ id: 20 + index, language })
      insertWatch({ id: 20 + index, titleId: 20 + index, started: '2026-03-01' })
    })
    const { all } = getLanguages('all', db, TODAY)
    expect(all.total).toBe(15)
    expect(bars(all)).toEqual([
      ['Korean', 3],
      ['English', 2],
      ['French', 1],
      ['German', 1],
      ['Hindi', 1],
      ['Italian', 1],
      ['Other', 5],
      ['Not recorded', 1]
    ])
    const other = all.bars[6]
    expect(other.key).toBe('other')
    expect(other.members.map((member) => member.label)).toEqual([
      'Japanese',
      'Klingon',
      'Malayalam',
      'No spoken language',
      'Spanish'
    ])
    expect(all.languageCount).toBe(10)
    // Shares include "Not recorded", so they add up to 100%.
    expect(all.bars.reduce((sum, bar) => sum + bar.share, 0)).toBeCloseTo(1)
  })

  it('follows the period: this year', () => {
    const { all } = getLanguages('year', db, TODAY)
    // The year-only watch counts: 2026 is in progress. The unknown date is only in All time.
    expect(bars(all)).toEqual([
      ['Korean', 2],
      ['English', 1],
      ['Klingon', 1],
      ['Malayalam', 1],
      ['Not recorded', 1]
    ])
  })

  it('follows the period: a custom range counts a title once', () => {
    const { all } = getLanguages({ kind: 'range', from: '2025-01-01', to: '2025-12-31' }, db, TODAY)
    expect(bars(all)).toEqual([['Korean', 2]])
    expect(all.languageCount).toBe(1)
  })

  it('follows the period: a life chapter', () => {
    sqlite
      .prepare(
        `INSERT INTO life_periods (id, name, start_date, end_date, color, created_at, updated_at)
         VALUES (1, 'First half', '2026-01-01', '2026-06-30', 'teal', ?, ?)`
      )
      .run(TODAY, TODAY)
    const { all } = getLanguages({ kind: 'chapter', chapterId: 1 }, db, TODAY)
    // A whole-year date doesn't fit inside half a year.
    expect(bars(all)).toEqual([
      ['English', 1],
      ['Korean', 1],
      ['Not recorded', 1]
    ])
  })

  it('is empty when nothing was finished', () => {
    const { all } = getLanguages('month', db, '2027-05-10')
    expect(all).toEqual({ total: 0, languageCount: 0, top: null, bars: [] })
  })
})

describe('collection language filter', () => {
  const query = (language: string, type: CollectionQuery['type'] = 'all'): number[] =>
    searchTitles({
      search: '',
      type,
      status: 'all',
      genre: '',
      language,
      favorite: false,
      minimumRating: null,
      sort: 'title',
      direction: 'asc'
    }).titles.map((title) => title.id)

  it('matches every spelling of a language, watched or not', () => {
    expect(query('ko').sort()).toEqual([1, 2, 3])
    expect(query('ko', 'series')).toEqual([3])
    expect(query('ja')).toEqual([7])
    expect(query('text:klingon')).toEqual([11])
    expect(query('xx')).toEqual([10])
    expect(query('de')).toEqual([])
  })

  it('"none" finds titles without a language', () => {
    expect(query('none')).toEqual([9])
  })

  it('lists each language once, by name', () => {
    expect(listLanguages()).toEqual([
      { key: 'en', label: 'English' },
      { key: 'fr', label: 'French' },
      { key: 'ja', label: 'Japanese' },
      { key: 'text:klingon', label: 'Klingon' },
      { key: 'ko', label: 'Korean' },
      { key: 'ml', label: 'Malayalam' },
      { key: 'xx', label: 'No spoken language' }
    ])
  })
})
