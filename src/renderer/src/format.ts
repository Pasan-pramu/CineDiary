// Date formatting for the UI. Dates are stored as ISO strings (CLAUDE.md) and only formatted here.
// A plain YYYY-MM-DD is a local calendar day, so it's read as local midnight, never as UTC.

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

/** A watch's dates: "27 Oct 2026", "12 Oct → 27 Oct 2026", or "Started 12 Oct 2026". */
export function formatWatchDates(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return `Started ${formatDay(startedAt)}`
  if (startedAt === completedAt) return formatDay(completedAt)
  const sameYear = startedAt.slice(0, 4) === completedAt.slice(0, 4)
  return `${sameYear ? formatShortDay(startedAt) : formatDay(startedAt)} → ${formatDay(completedAt)}`
}
