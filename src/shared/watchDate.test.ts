import { describe, expect, it } from 'vitest'
import { chaptersOn, computeMilestones, timelineMonthKey } from './timeline'
import { fitsForSure, lastPossibleDay, storedWatchDate, UNKNOWN_DATE } from './watchDate'

const TODAY = '2026-10-28'

describe('stored watch dates', () => {
  it('keep the first day the watch could have been', () => {
    expect(storedWatchDate('2019-10-17', 'day')).toBe('2019-10-17')
    expect(storedWatchDate('2019-10-17', 'month')).toBe('2019-10-01')
    expect(storedWatchDate('2019-10-17', 'year')).toBe('2019-01-01')
    expect(storedWatchDate('2019-10-17', 'unknown')).toBe(UNKNOWN_DATE)
  })

  it('reach to the last day of their month or year, but never past today', () => {
    expect(lastPossibleDay('2024-02-01', 'month', TODAY)).toBe('2024-02-29')
    expect(lastPossibleDay('2019-01-01', 'year', TODAY)).toBe('2019-12-31')
    expect(lastPossibleDay('2026-10-01', 'month', TODAY)).toBe(TODAY)
    expect(lastPossibleDay('2026-01-01', 'year', TODAY)).toBe(TODAY)
    expect(lastPossibleDay('2026-10-05', 'day', TODAY)).toBe('2026-10-05')
    expect(lastPossibleDay(UNKNOWN_DATE, 'unknown', TODAY)).toBeNull()
  })
})

describe('fitsForSure', () => {
  it('a month or year must lie wholly inside the period', () => {
    expect(fitsForSure('2019-10-01', 'month', '2019-10-01', '2019-10-31', TODAY)).toBe(true)
    expect(fitsForSure('2019-10-01', 'month', '2019-10-02', '2019-12-31', TODAY)).toBe(false)
    expect(fitsForSure('2019-10-01', 'month', '2019-01-01', '2019-10-30', TODAY)).toBe(false)
    expect(fitsForSure('2019-01-01', 'year', '2019-01-01', null, TODAY)).toBe(true)
    expect(fitsForSure('2019-01-01', 'year', null, '2019-06-30', TODAY)).toBe(false)
  })

  it('an unknown date only fits "All time"', () => {
    expect(fitsForSure(UNKNOWN_DATE, 'unknown', null, null, TODAY)).toBe(true)
    expect(fitsForSure(UNKNOWN_DATE, 'unknown', '0001-01-01', null, TODAY)).toBe(false)
    expect(fitsForSure(UNKNOWN_DATE, 'unknown', null, '2026-12-31', TODAY)).toBe(false)
  })
})

describe('timeline groups and chapters', () => {
  it('month keys: months, then "Sometime in <year>", then not remembered', () => {
    expect(timelineMonthKey('2019-10-05', 'day')).toBe('2019-10')
    expect(timelineMonthKey('2019-10-01', 'month')).toBe('2019-10')
    expect(timelineMonthKey('2019-01-01', 'year')).toBe('2019-00')
    expect(timelineMonthKey(UNKNOWN_DATE, 'unknown')).toBe('0000-00')
    const sorted = ['2019-00', '0000-00', '2019-10', '2019-01', '2020-01'].sort().reverse()
    expect(sorted).toEqual(['2020-01', '2019-10', '2019-01', '2019-00', '0000-00'])
  })

  it('a chapter dot only when the watch is certainly inside', () => {
    const chapters = [{ id: 1, startDate: '2019-10-10', endDate: null }]
    expect(chaptersOn('2019-10-12', chapters, TODAY)).toEqual([1])
    expect(chaptersOn('2019-10-01', chapters, TODAY, 'month')).toEqual([])
    expect(chaptersOn('2020-01-01', chapters, TODAY, 'year')).toEqual([1])
    expect(chaptersOn(UNKNOWN_DATE, chapters, TODAY, 'unknown')).toEqual([])
  })

  it('milestones skip year-only and forgotten dates', () => {
    const milestones = computeMilestones([
      {
        id: 1,
        titleId: 1,
        startedAt: UNKNOWN_DATE,
        completedAt: UNKNOWN_DATE,
        datePrecision: 'unknown'
      },
      {
        id: 2,
        titleId: 2,
        startedAt: '2019-01-01',
        completedAt: '2019-01-01',
        datePrecision: 'year'
      },
      {
        id: 3,
        titleId: 3,
        startedAt: '2019-03-01',
        completedAt: '2019-03-01',
        datePrecision: 'month'
      },
      {
        id: 4,
        titleId: 1,
        startedAt: '2019-05-02',
        completedAt: '2019-05-02',
        datePrecision: 'day'
      }
    ])
    expect(milestones.get(1)).toBeUndefined()
    expect(milestones.get(2)).toBeUndefined()
    expect(milestones.get(3)).toEqual([{ kind: 'first_of_year', label: 'First watch of 2019' }])
    // Title 1's forgotten watch doesn't make this its "first rewatch".
    expect(milestones.get(4)).toBeUndefined()
  })
})
