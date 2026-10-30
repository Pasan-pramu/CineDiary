// Date formatting for the UI. Dates are stored as ISO strings (CLAUDE.md) and only formatted here.
// A plain YYYY-MM-DD is a local calendar day, so it's read as local midnight, never as UTC.

import { NOT_REMEMBERED_MONTH, SOMETIME_IN_MONTH } from '../../shared/timeline'
import type { DatePrecision } from '../../shared/watchDate'

/** A finished watch whose date isn't remembered, on cards, in the Journal and in search. */
export const NOT_REMEMBERED = 'Don’t remember when'
/** The Timeline and Journal section for those watches. */
export const NOT_REMEMBERED_SECTION = 'Watched, date not remembered'

const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})
const shortDayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const shortMonthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** "2026-10-27" (or "2026-10") as a local Date. */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

/** "27 Oct 2026" */
export function formatDay(date: string): string {
  return dayFormat.format(parseLocalDate(date))
}

/** "27 Oct" */
export function formatShortDay(date: string): string {
  return shortDayFormat.format(parseLocalDate(date))
}

/** "October 2026" (takes a day or a "2026-10" month). */
export function formatMonth(date: string): string {
  return monthFormat.format(parseLocalDate(date))
}

/** "Oct 2026" */
export function formatShortMonth(date: string): string {
  return shortMonthFormat.format(parseLocalDate(date))
}

/** A full ISO timestamp, e.g. "27 Oct 2026, 14:05". */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

/**
 * A watch date as far as it's known: "27 Oct 2026" (or "27 Oct" when `short`), "Oct 2019",
 * "2019", or "Don’t remember when".
 */
export function formatWatchDate(date: string, precision: DatePrecision, short = false): string {
  switch (precision) {
    case 'day':
      return short ? formatShortDay(date) : formatDay(date)
    case 'month':
      return formatShortMonth(date)
    case 'year':
      return date.slice(0, 4)
    case 'unknown':
      return NOT_REMEMBERED
  }
}

/** A Timeline / Journal group heading: "October 2026", "Sometime in 2019", or the section. */
export function formatMonthGroup(month: string): string {
  if (month === NOT_REMEMBERED_MONTH) return NOT_REMEMBERED_SECTION
  if (month.endsWith(`-${SOMETIME_IN_MONTH}`)) return `Sometime in ${month.slice(0, 4)}`
  return formatMonth(month)
}

/**
 * A watch's dates: "27 Oct 2026", "12 Oct → 27 Oct 2026", "Started 12 Oct 2026", or for a
 * partial date only that ("Oct 2019", "2019", "Don’t remember when").
 */
export function formatWatchDates(
  startedAt: string,
  completedAt: string | null,
  precision: DatePrecision = 'day'
): string {
  if (!completedAt) return `Started ${formatDay(startedAt)}`
  if (precision !== 'day') return formatWatchDate(completedAt, precision)
  if (startedAt === completedAt) return formatDay(completedAt)
  const sameYear = startedAt.slice(0, 4) === completedAt.slice(0, 4)
  return `${sameYear ? formatShortDay(startedAt) : formatDay(startedAt)} → ${formatDay(completedAt)}`
}
