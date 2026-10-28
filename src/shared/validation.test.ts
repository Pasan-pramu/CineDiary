import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getLocalDate } from './constants'
import { isCalendarDate, lifePeriodInputSchema, watchEntryInputSchema } from './validation'

// Local-date rules, run in Colombo (UTC+5:30) around local midnight: at 00:30 there it is still
// "yesterday" in UTC, so any code that uses the UTC date instead of the local one fails here.

const originalTz = process.env['TZ']

beforeAll(() => {
  process.env['TZ'] = 'Asia/Colombo'
})
afterAll(() => {
  process.env['TZ'] = originalTz
})
afterEach(() => {
  vi.useRealTimers()
})

/** Sets the clock to a Colombo local time on 28 Oct 2026. */
function colomboTime(time: '00:30' | '23:30'): void {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`2026-10-28T${time}:00+05:30`))
}

const watch = (startedAt: string, completedAt?: string): unknown => ({
  titleId: 1,
  startedAt,
  completedAt
})

describe('the test clock really is in Colombo', () => {
  it('runs at UTC+5:30', () => {
    colomboTime('00:30')
    expect(new Date().getTimezoneOffset()).toBe(-330)
    // UTC is still on the 27th.
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-27')
  })
})

describe.each(['00:30', '23:30'] as const)('at %s local time', (time) => {
  it('today is the local date', () => {
    colomboTime(time)
    expect(getLocalDate()).toBe('2026-10-28')
  })

  it('accepts a watch started and finished today', () => {
    colomboTime(time)
    expect(watchEntryInputSchema.safeParse(watch('2026-10-28', '2026-10-28')).success).toBe(true)
  })

  it('rejects tomorrow as "in the future"', () => {
    colomboTime(time)
    const started = watchEntryInputSchema.safeParse(watch('2026-10-29'))
    expect(started.success).toBe(false)
    expect(started.error?.issues[0]?.message).toBe('Date cannot be in the future.')
    expect(watchEntryInputSchema.safeParse(watch('2026-10-27', '2026-10-29')).success).toBe(false)
  })
})

describe('watch dates', () => {
  it('needs the completed date on or after the start date', () => {
    colomboTime('23:30')
    const result = watchEntryInputSchema.safeParse(watch('2026-10-20', '2026-10-10'))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'Completed date must be on or after the start date.'
    )
    expect(watchEntryInputSchema.safeParse(watch('2026-10-10', '2026-10-10')).success).toBe(true)
  })

  it('rejects dates that do not exist', () => {
    colomboTime('23:30')
    for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-04-31']) {
      expect(watchEntryInputSchema.safeParse(watch(date)).success, date).toBe(false)
    }
  })
})

describe('isCalendarDate', () => {
  it('accepts real days, including 29 February in leap years', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-12-31')).toBe(true)
    expect(isCalendarDate('2026-01-01')).toBe(true)
  })

  it('rejects impossible days and other formats', () => {
    for (const value of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-1-5', '28/10/2026', '']) {
      expect(isCalendarDate(value), value).toBe(false)
    }
  })
})

describe('life chapters', () => {
  const chapter = (startDate: string, endDate: string | null): unknown => ({
    name: 'Final year',
    startDate,
    endDate,
    color: 'violet',
    note: null
  })

  it('may be ongoing, or end on or after the day they start', () => {
    expect(lifePeriodInputSchema.safeParse(chapter('2026-01-01', null)).success).toBe(true)
    expect(lifePeriodInputSchema.safeParse(chapter('2026-01-01', '2026-01-01')).success).toBe(true)
    expect(lifePeriodInputSchema.safeParse(chapter('2026-02-01', '2026-01-31')).success).toBe(false)
    expect(lifePeriodInputSchema.safeParse(chapter('2026-02-30', null)).success).toBe(false)
  })
})
