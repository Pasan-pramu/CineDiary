import { sql, type SQL } from 'drizzle-orm'
import { getLocalDate } from '../../shared/constants'
import type { DateRange } from '../../shared/types'

// The SQL side of shared/watchDate.ts: a stored watch date is the FIRST day it could be, and
// date_precision says how far it may reach. Pass the columns as SQL (qualified or not).

/**
 * SQL: the last day the watch could be on; NULL when the date is unknown. A finished watch can't
 * be later than today, so "this month" or "this year" ends today (exact days are never changed).
 */
export function lastPossibleDaySql(date: SQL, precision: SQL, today = getLocalDate()): SQL {
  return sql`(CASE ${precision}
    WHEN 'month' THEN min(date(${date}, '+1 month', '-1 day'), ${today})
    WHEN 'year' THEN min(date(${date}, '+1 year', '-1 day'), ${today})
    WHEN 'unknown' THEN NULL
    ELSE ${date} END)`
}

/**
 * SQL condition: the watch certainly lies inside the range. "All time" (no ends) takes every
 * watch; any other period never takes an unknown date.
 */
export function fitsForSureSql(date: SQL, precision: SQL, range: DateRange): SQL {
  if (range.from === null && range.to === null) return sql`1`
  return sql`(${precision} != 'unknown'
    ${range.from ? sql`AND ${date} >= ${range.from}` : sql``}
    ${range.to ? sql`AND ${lastPossibleDaySql(date, precision)} <= ${range.to}` : sql``})`
}

/** SQL condition: the watch certainly ended before `day` (unknown dates never do). */
export function endedBeforeSql(date: SQL, precision: SQL, day: string): SQL {
  return sql`(${precision} != 'unknown' AND ${lastPossibleDaySql(date, precision)} < ${day})`
}

/** SQL: precisions whose month is known (monthly charts), and whose year is known. */
export const MONTH_KNOWN = sql.raw(`('day', 'month')`)
export const YEAR_KNOWN = sql.raw(`('day', 'month', 'year')`)
