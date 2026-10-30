// How well a finished watch's date is known ("I don't remember when").
//
// A finished watch stores the FIRST day its date could be: an exact day as is, a month as its
// 1st (Oct 2019 → 2019-10-01), a year as 1 January, and "I don't remember" as UNKNOWN_DATE.
// For anything but an exact day, started_at holds the same value. Such a watch is still a
// completed watch (it counts in totals, moods, reasons, …); only date questions treat it with
// care: a watch belongs to a period only when its whole day / month / year lies inside it, and
// an unknown date belongs to no period (only "All time").

export type DatePrecision = 'day' | 'month' | 'year' | 'unknown'

export const DATE_PRECISIONS: readonly DatePrecision[] = ['day', 'month', 'year', 'unknown']

/** Stored for "I don't remember". Never shown; sorts before every real date. */
export const UNKNOWN_DATE = '0001-01-01'

/** The date to store for a finished watch: the first day it could have been. */
export function storedWatchDate(date: string, precision: DatePrecision): string {
  switch (precision) {
    case 'day':
      return date
    case 'month':
      return `${date.slice(0, 7)}-01`
    case 'year':
      return `${date.slice(0, 4)}-01-01`
    case 'unknown':
      return UNKNOWN_DATE
  }
}

/**
 * The last day a stored watch date could be on, or null when the date is unknown. A finished
 * watch can't be later than today, so "this month" or "this year" ends today.
 */
export function lastPossibleDay(
  date: string,
  precision: DatePrecision,
  today: string
): string | null {
  const capped = (last: string): string => (last < today ? last : today)
  switch (precision) {
    case 'day':
      return date
    case 'month': {
      const [year, month] = date.split('-').map(Number)
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
      return capped(`${date.slice(0, 7)}-${String(last).padStart(2, '0')}`)
    }
    case 'year':
      return capped(`${date.slice(0, 4)}-12-31`)
    case 'unknown':
      return null
  }
}

/** True when the watch certainly lies within from…to (null = open end; both null = all time). */
export function fitsForSure(
  date: string,
  precision: DatePrecision,
  from: string | null,
  to: string | null,
  today: string
): boolean {
  const last = lastPossibleDay(date, precision, today)
  if (last === null) return from === null && to === null
  return (from === null || date >= from) && (to === null || last <= to)
}
