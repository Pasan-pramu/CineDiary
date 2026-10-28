import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { chapterColorVar } from '../../../../shared/timeline'
import type { ChapterAnalysis, DistributionItem } from '../../../../shared/types'
import MoodTitleRow from '../MoodTitleRow'
import SectionHeading from '../SectionHeading'
import SectionPanel from '../SectionPanel'
import { chapterSentence, changeColor, formatChange, formatShare } from '../insightSentences'
import { chapterDates } from '../timeline/chapterDates'

// Insights → Life chapters: one card per chapter, plus a side-by-side comparison of 2–3 (M10c).
// Chapters are their own date ranges, so this section ignores the period selector.

export const MAX_COMPARE = 3

interface ChaptersSectionProps {
  analyses: ChapterAnalysis[]
  compare: number[]
  onCompareChange: (ids: number[]) => void
  onViewChapter: (chapterId: number) => void
  /** Scroll here on load (when opened from the Timeline). */
  focus: boolean
}

function ChaptersSection({
  analyses,
  compare,
  onCompareChange,
  onViewChapter,
  focus
}: ChaptersSectionProps): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'start' })
  }, [focus])

  const compared = compare
    .map((id) => analyses.find((analysis) => analysis.chapter.id === id))
    .filter((analysis): analysis is ChapterAnalysis => analysis !== undefined)
  const toggle = (id: number): void =>
    onCompareChange(compare.includes(id) ? compare.filter((item) => item !== id) : [...compare, id])

  return (
    <section ref={ref} className="scroll-mt-24 space-y-6 pt-2">
      <div>
        <SectionHeading>Life chapters</SectionHeading>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Why you watched and how you felt in each phase of your life. Each chapter uses its own
          dates; pick 2 or 3 to compare them side by side.
        </p>
      </div>
      {compared.length >= 2 ? (
        <ChapterComparison analyses={compared} />
      ) : compare.length === 1 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Pick one or two more chapters to compare.
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        {analyses.map((analysis) => (
          <ChapterCard
            key={analysis.chapter.id}
            analysis={analysis}
            selected={compare.includes(analysis.chapter.id)}
            canSelect={compare.length < MAX_COMPARE}
            onToggle={() => toggle(analysis.chapter.id)}
            onView={() => onViewChapter(analysis.chapter.id)}
          />
        ))}
      </div>
    </section>
  )
}

function ShareList({
  items,
  empty
}: {
  items: DistributionItem[]
  empty: string
}): React.JSX.Element {
  if (items.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">{empty}</p>
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key} className="flex justify-between gap-3 text-sm">
          <span className="truncate text-[var(--color-text-secondary)]">{item.label}</span>
          <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
            {formatShare(item.share)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function MoodNumbers({ mood }: { mood: ChapterAnalysis['mood'] }): React.JSX.Element {
  const value = (average: number | null): string => (average === null ? '–' : average.toFixed(1))
  const change = mood.change.average
  return (
    <p className="text-sm tabular-nums text-[var(--color-text-secondary)]">
      {value(mood.before.average)} → {value(mood.after.average)}
      {change !== null ? (
        <span className="ml-2 font-semibold" style={{ color: changeColor(change) }}>
          {formatChange(change)}
        </span>
      ) : null}
    </p>
  )
}

function HelpedMost({ analysis }: { analysis: ChapterAnalysis }): React.JSX.Element {
  const navigate = useNavigate()
  const boosters = analysis.helpedMost.items.filter((item) => item.averageChange > 0)
  if (!analysis.helpedMost.enoughData) {
    return (
      <p className="text-xs leading-5 text-[var(--color-text-muted)]">
        Not enough data yet: this needs at least 2 watches with a mood before and after.
      </p>
    )
  }
  if (boosters.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        Nothing lifted your mood in this chapter.
      </p>
    )
  }
  return (
    <div className="-mx-2">
      {boosters.map((item) => (
        <MoodTitleRow
          key={item.titleId}
          item={item}
          onClick={() => void navigate(`/title/${item.titleId}`)}
        />
      ))}
    </div>
  )
}

const label = 'eyebrow mb-1.5'

function ChapterCard({
  analysis,
  selected,
  canSelect,
  onToggle,
  onView
}: {
  analysis: ChapterAnalysis
  selected: boolean
  canSelect: boolean
  onToggle: () => void
  onView: () => void
}): React.JSX.Element {
  const { chapter } = analysis
  return (
    <article
      className={`relative overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-panel)] p-6 pl-7 ${selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: chapterColorVar(chapter.color) }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-semibold leading-tight text-[var(--color-text-primary)]">
            {chapter.name}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {chapterDates(chapter)} · {analysis.watches.toLocaleString()}{' '}
            {analysis.watches === 1 ? 'watch' : 'watches'}
          </p>
        </div>
        <label
          className={`flex shrink-0 items-center gap-2 text-xs ${selected || canSelect ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)] opacity-60'}`}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={!selected && !canSelect}
            onChange={onToggle}
          />
          Compare
        </label>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
        {chapterSentence(analysis)}
      </p>
      {analysis.watches > 0 ? (
        <>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className={label}>Why you watched</p>
              <ShareList items={analysis.topReasons} empty="No reasons recorded." />
            </div>
            <div>
              <p className={label}>How you felt before</p>
              <ShareList items={analysis.topFeelings} empty="No feelings recorded." />
            </div>
            <div>
              <p className={label}>Mood before → after</p>
              <MoodNumbers mood={analysis.mood} />
            </div>
            <div>
              <p className={label}>Top genres</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {analysis.topGenres.map((genre) => genre.genre).join(' · ') || '–'}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <p className={label}>What helped most</p>
            <HelpedMost analysis={analysis} />
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={onView}
        className="mt-4 text-xs font-semibold text-[var(--color-accent-light)] hover:underline"
      >
        Show all insights for this chapter
      </button>
    </article>
  )
}

/** 2–3 chapters side by side: one column each. */
function ChapterComparison({ analyses }: { analyses: ChapterAnalysis[] }): React.JSX.Element {
  const rows: Array<{ label: string; cell: (analysis: ChapterAnalysis) => React.ReactNode }> = [
    { label: 'Dates', cell: (a) => chapterDates(a.chapter) },
    { label: 'Watches', cell: (a) => a.watches.toLocaleString() },
    {
      label: 'Why you watched',
      cell: (a) => <ShareList items={a.topReasons} empty="None recorded" />
    },
    {
      label: 'How you felt before',
      cell: (a) => <ShareList items={a.topFeelings} empty="None recorded" />
    },
    { label: 'Mood before → after', cell: (a) => <MoodNumbers mood={a.mood} /> },
    {
      label: 'Top genres',
      cell: (a) => a.topGenres.map((genre) => genre.genre).join(' · ') || '–'
    },
    {
      label: 'What helped most',
      cell: (a) =>
        a.helpedMost.items
          .filter((item) => item.averageChange > 0)
          .map((item) => item.title)
          .join(', ') || '–'
    }
  ]
  return (
    <SectionPanel title="Side by side">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] table-fixed text-sm">
          <thead>
            <tr>
              <th className="w-40" />
              {analyses.map((analysis) => (
                <th key={analysis.chapter.id} className="px-3 pb-3 text-left align-bottom">
                  <span className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: chapterColorVar(analysis.chapter.color) }}
                    />
                    <span className="truncate">{analysis.chapter.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-[var(--color-border)]">
                <th className="py-3 pr-3 text-left align-top text-xs font-semibold text-[var(--color-text-muted)]">
                  {row.label}
                </th>
                {analyses.map((analysis) => (
                  <td
                    key={analysis.chapter.id}
                    className="px-3 py-3 align-top text-[var(--color-text-secondary)]"
                  >
                    {row.cell(analysis)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  )
}

export default ChaptersSection
