// Timeline rules shared by main and renderer: where a watch sits on the timeline, which life
// chapters a date belongs to, and the automatic milestone labels.

/** Chapter colors are keys; each maps to a CSS token (--color-chapter-<key>) in index.css. */
export const CHAPTER_COLORS = ['violet', 'blue', 'green', 'amber', 'rose', 'teal'] as const
export type ChapterColor = (typeof CHAPTER_COLORS)[number]

/** The CSS variable for a chapter color, so it follows the theme. */
export function chapterColorVar(color: ChapterColor): string {
  return `var(--color-chapter-${color})`
}

/** Chapter color for text (chips, "Chapter begins"): nudged toward the text color so it stays
 *  readable (WCAG AA) on its own tint in both themes. */
export function chapterTextColor(color: ChapterColor): string {
  return `color-mix(in srgb, ${chapterColorVar(color)} 80%, var(--color-text-primary))`
}

/** A watch sits on its completed date, or its start date while still in progress. */
export function timelineDate(entry: { completedAt: string | null; startedAt: string }): string {
  return entry.completedAt ?? entry.startedAt
}

export interface ChapterRange {
  id: number
  startDate: string
  /** null = ongoing (runs up to today). */
  endDate: string | null
}

/** Every chapter a date belongs to (chapters may overlap). Dates are YYYY-MM-DD. */
export function chaptersOn(date: string, chapters: ChapterRange[], today: string): number[] {
  return chapters
    .filter((chapter) => chapter.startDate <= date && date <= (chapter.endDate ?? today))
    .map((chapter) => chapter.id)
}

export type MilestoneKind = 'first_of_year' | 'titles_completed' | 'first_rewatch'

export interface Milestone {
  kind: MilestoneKind
  label: string
}

/** "Nth title completed" milestones. Extend freely, e.g. 250, 500, 1000. */
export const TITLE_MILESTONES = [10, 25, 50, 100]

function ordinal(n: number): string {
  const tens = n % 100
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')
  return `${n}${suffix}`
}

export interface MilestoneEntry {
  id: number
  titleId: number
  startedAt: string
  completedAt: string | null
}

/**
 * Milestones over the WHOLE diary (so filters never move them):
 * - the first watch of each year (earliest timeline date in that year);
 * - the watch that first completes my 10th / 25th / 50th / 100th different title;
 * - the first rewatch of a title: its second finished watch, by date.
 */
export function computeMilestones(entries: MilestoneEntry[]): Map<number, Milestone[]> {
  const result = new Map<number, Milestone[]>()
  const add = (id: number, milestone: Milestone): void => {
    result.set(id, [...(result.get(id) ?? []), milestone])
  }
  const byDate = (a: { date: string; id: number }, b: { date: string; id: number }): number =>
    a.date.localeCompare(b.date) || a.id - b.id

  const dated = entries.map((entry) => ({ ...entry, date: timelineDate(entry) })).sort(byDate)
  const seenYears = new Set<string>()
  for (const entry of dated) {
    const year = entry.date.slice(0, 4)
    if (!seenYears.has(year)) {
      seenYears.add(year)
      add(entry.id, { kind: 'first_of_year', label: `First watch of ${year}` })
    }
  }

  const completed = entries
    .filter(
      (entry): entry is MilestoneEntry & { completedAt: string } => entry.completedAt !== null
    )
    .map((entry) => ({ ...entry, date: entry.completedAt }))
    .sort(byDate)
  const timesCompleted = new Map<number, number>()
  for (const entry of completed) {
    const times = (timesCompleted.get(entry.titleId) ?? 0) + 1
    timesCompleted.set(entry.titleId, times)
    if (times === 1 && TITLE_MILESTONES.includes(timesCompleted.size)) {
      add(entry.id, {
        kind: 'titles_completed',
        label: `${ordinal(timesCompleted.size)} title completed`
      })
    }
    if (times === 2) add(entry.id, { kind: 'first_rewatch', label: 'First rewatch' })
  }
  return result
}
