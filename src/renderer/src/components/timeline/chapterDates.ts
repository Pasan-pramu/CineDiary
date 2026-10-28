import type { LifePeriod } from '../../../../shared/types'

const shortMonthFormat = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })

/** "Sep 2025 – Jun 2026", "Jul 2026 – ongoing", or one month when start and end match. */
export function chapterDates(chapter: LifePeriod): string {
  const start = shortMonthFormat.format(new Date(`${chapter.startDate}T00:00:00`))
  const end = chapter.endDate
    ? shortMonthFormat.format(new Date(`${chapter.endDate}T00:00:00`))
    : 'ongoing'
  return start === end ? start : `${start} – ${end}`
}
