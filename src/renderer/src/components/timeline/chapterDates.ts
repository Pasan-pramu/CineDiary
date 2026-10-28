import type { LifePeriod } from '../../../../shared/types'
import { formatShortMonth } from '../../format'

/** "Sep 2025 – Jun 2026", "Jul 2026 – ongoing", or one month when start and end match. */
export function chapterDates(chapter: LifePeriod): string {
  const start = formatShortMonth(chapter.startDate)
  const end = chapter.endDate ? formatShortMonth(chapter.endDate) : 'ongoing'
  return start === end ? start : `${start} – ${end}`
}
