import type { InsightsPeriod, InsightsPreset, LifePeriod } from '../../../../shared/types'
import { formatDay } from '../../format'

// The Insights period lives in the URL: ?period=month|six_months|year|all,
// ?period=chapter&chapter=3, or ?period=custom&from=2025-01-01&to=2025-06-30.

const PRESETS: InsightsPreset[] = ['month', 'six_months', 'year', 'all']
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function periodFromParams(params: URLSearchParams): InsightsPeriod {
  const value = params.get('period')
  if (value === 'chapter') {
    const chapterId = Number(params.get('chapter'))
    if (Number.isInteger(chapterId) && chapterId > 0) return { kind: 'chapter', chapterId }
  }
  if (value === 'custom') {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    if (DATE.test(from) && DATE.test(to) && from <= to) return { kind: 'range', from, to }
  }
  return PRESETS.find((preset) => preset === value) ?? 'month'
}

/** The URL for a period, keeping unrelated params (e.g. the chapter comparison). */
export function periodParams(period: InsightsPeriod, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of ['period', 'chapter', 'from', 'to']) next.delete(key)
  if (typeof period === 'string') next.set('period', period)
  else if (period.kind === 'chapter') {
    next.set('period', 'chapter')
    next.set('chapter', String(period.chapterId))
  } else {
    next.set('period', 'custom')
    next.set('from', period.from)
    next.set('to', period.to)
  }
  return next
}

/** A stable key for comparing periods. */
export function periodKey(period: InsightsPeriod): string {
  return JSON.stringify(period)
}

const PRESET_PHRASES: Record<InsightsPreset, string> = {
  month: 'this month',
  six_months: 'in the last 6 months',
  year: 'this year',
  all: 'yet'
}

/** "this month", "during Final year at university", "between 1 Jan 2025 and 30 Jun 2025". */
export function periodPhrase(period: InsightsPeriod, chapters: LifePeriod[]): string {
  if (typeof period === 'string') return PRESET_PHRASES[period]
  if (period.kind === 'chapter') {
    const chapter = chapters.find((item) => item.id === period.chapterId)
    return chapter ? `during ${chapter.name}` : 'in this chapter'
  }
  return `between ${formatDay(period.from)} and ${formatDay(period.to)}`
}
