import {
  ArrowRight,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import { formatChange, formatShare, watchCount } from '../components/insightSentences'
import ChapterDialog from '../components/timeline/ChapterDialog'
import TimelineItem from '../components/timeline/TimelineItem'
import { chapterDates } from '../components/timeline/chapterDates'
import { MOODS } from '../../../shared/constants'
import { chapterColorVar, chapterTextColor } from '../../../shared/timeline'
import type {
  ChapterSummary,
  LifePeriod,
  Reason,
  TimelineEntry,
  TimelineMonth,
  TimelineOverview,
  TimelineQuery
} from '../../../shared/types'
import { formatMonth } from '../format'
import { ListSkeleton } from '../components/Skeleton'

// My Timeline: remembering, not searching (that's the Journal). Newest first, grouped by year
// and month, loaded a page of months at a time as you scroll.

function summaryLine(summary: ChapterSummary): string {
  if (summary.watches === 0) return 'No watches in this chapter yet'
  const parts = [watchCount(summary.watches)]
  if (summary.averageMoodChange !== null)
    parts.push(`${formatChange(summary.averageMoodChange)} mood`)
  if (summary.topGenre) parts.push(`mostly ${summary.topGenre}`)
  return parts.join(' · ')
}

/** "Felt lonely 38% · Reason: Needed an escape 30%" */
function feelingLine(summary: ChapterSummary): string | null {
  const parts: string[] = []
  if (summary.topFeeling) {
    parts.push(
      `Felt ${summary.topFeeling.label.toLowerCase()} ${formatShare(summary.topFeeling.share)}`
    )
  }
  if (summary.topReason) {
    parts.push(`Reason: ${summary.topReason.label} ${formatShare(summary.topReason.share)}`)
  }
  return parts.length ? parts.join(' · ') : null
}

function queryFromParams(params: URLSearchParams): TimelineQuery {
  const type = params.get('type')
  const chapter = Number(params.get('chapter'))
  const reason = Number(params.get('reason'))
  const mood = MOODS.find((item) => item.key === params.get('mood'))?.key ?? null
  return {
    search: params.get('q') ?? '',
    type: type === 'movie' || type === 'series' ? type : 'all',
    chapterId: Number.isInteger(chapter) && chapter > 0 ? chapter : null,
    highlightsOnly: params.get('highlights') === '1',
    reasonId: Number.isInteger(reason) && reason > 0 ? reason : null,
    moodBefore: mood
  }
}

type Row =
  | { kind: 'entry'; date: string; entry: TimelineEntry }
  | { kind: 'begins' | 'ends'; date: string; chapter: LifePeriod }

/**
 * A month's entries plus "chapter begins / ends" dividers at their dates. Newest first: an end
 * divider sits above that day's watches (they're still inside), a begin divider below them.
 */
function monthRows(month: TimelineMonth, chapters: LifePeriod[]): Row[] {
  const rows: Row[] = month.entries.map((entry) => ({ kind: 'entry', date: entry.date, entry }))
  for (const chapter of chapters) {
    if (chapter.startDate.startsWith(month.month))
      rows.push({ kind: 'begins', date: chapter.startDate, chapter })
    if (chapter.endDate?.startsWith(month.month))
      rows.push({ kind: 'ends', date: chapter.endDate, chapter })
  }
  const order = { ends: 0, entry: 1, begins: 2 }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || order[a.kind] - order[b.kind])
}

function ChapterDivider({
  row
}: {
  row: Extract<Row, { kind: 'begins' | 'ends' }>
}): React.JSX.Element {
  const color = chapterColorVar(row.chapter.color)
  return (
    <li
      className="flex items-center gap-3 py-1 pl-24 text-xs font-semibold"
      style={{ color: chapterTextColor(row.chapter.color) }}
    >
      <span className="h-px flex-1" style={{ background: color }} />
      {row.kind === 'begins' ? 'Chapter begins' : 'Chapter ends'}: {row.chapter.name}
      <span className="h-px flex-1" style={{ background: color }} />
    </li>
  )
}

function Timeline(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const query = queryFromParams(params)
  const queryKey = JSON.stringify(query)
  const [searchText, setSearchText] = useState(query.search)
  const [overview, setOverview] = useState<{ key: string; value: TimelineOverview } | null>(null)
  const [feed, setFeed] = useState<{
    key: string
    months: TimelineMonth[]
    next: string | null
  } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [dialog, setDialog] = useState<{ chapter?: LifePeriod } | null>(null)
  const [reasons, setReasons] = useState<Reason[]>([])
  const loading = useRef(false)
  const pendingYear = useRef<string | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const update = useCallback(
    (changes: Record<string, string | null>): void => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: true }
      )
    },
    [setParams]
  )

  useEffect(() => {
    void window.api.watchEntries
      .listReasons()
      .then(setReasons)
      .catch(() => undefined)
  }, [])

  // Typing searches after a short pause.
  useEffect(() => {
    if (searchText === query.search) return
    const timer = window.setTimeout(() => update({ q: searchText.trim() || null }), 300)
    return () => window.clearTimeout(timer)
  }, [searchText, query.search, update])

  // First page and the overview whenever the filters change (or a chapter was edited).
  useEffect(() => {
    let cancelled = false
    const parsed = JSON.parse(queryKey) as TimelineQuery
    void Promise.all([
      window.api.timeline.overview(parsed),
      window.api.timeline.page(parsed, null)
    ]).then(([nextOverview, page]) => {
      if (cancelled) return
      setOverview({ key: queryKey, value: nextOverview })
      setFeed({ key: queryKey, months: page.months, next: page.nextBefore })
    })
    return () => {
      cancelled = true
    }
  }, [queryKey, refresh])

  const current = feed?.key === queryKey ? feed : null
  const loadMore = useCallback((): void => {
    if (!current?.next || loading.current) return
    loading.current = true
    const key = current.key
    void window.api.timeline
      .page(JSON.parse(key) as TimelineQuery, current.next)
      .then((page) =>
        setFeed((previous) =>
          previous && previous.key === key
            ? { key, months: [...previous.months, ...page.months], next: page.nextBefore }
            : previous
        )
      )
      .finally(() => {
        loading.current = false
      })
  }, [current])

  // Load older months when the bottom of the list comes into view.
  useEffect(() => {
    const element = sentinel.current
    if (!element || !current?.next) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [current, loadMore])

  // Year jump: keep loading until the year is on the page, then scroll to it.
  useEffect(() => {
    const year = pendingYear.current
    if (!year || !current) return
    const target = document.getElementById(`year-${year}`)
    if (target) {
      pendingYear.current = null
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (current.next) {
      loadMore()
    } else {
      pendingYear.current = null
    }
  }, [current, loadMore])

  const jumpTo = (year: string): void => {
    const target = document.getElementById(`year-${year}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else {
      pendingYear.current = year
      loadMore()
    }
  }

  const toggleHighlight = (entry: TimelineEntry): void => {
    void window.api.watchEntries.setHighlight(entry.id, !entry.isHighlight).then((saved) =>
      setFeed((previous) =>
        previous
          ? {
              ...previous,
              months: previous.months.map((month) => ({
                ...month,
                entries: month.entries.map((item) =>
                  item.id === saved.id ? { ...item, isHighlight: saved.isHighlight } : item
                )
              }))
            }
          : previous
      )
    )
  }

  const info = overview?.key === queryKey ? overview.value : null
  const chapters = useMemo(() => info?.chapters ?? [], [info])
  const chapterMap = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters]
  )
  const filtered =
    query.search !== '' ||
    query.type !== 'all' ||
    query.chapterId !== null ||
    query.highlightsOnly ||
    query.reasonId !== null ||
    query.moodBefore !== null

  return (
    <div className="page-reading">
      <PageTitle description="Your life story through the films and series that were there for it.">
        My Timeline
      </PageTitle>

      {/* Life chapters */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading text-[var(--color-text-primary)]">Life chapters</h2>
          <div className="flex items-center gap-5">
            {chapters.length ? (
              <Link to="/insights?period=all&section=chapters" className="link">
                Compare in Insights <ArrowRight size={15} />
              </Link>
            ) : null}
            <button type="button" onClick={() => setDialog({})} className="link">
              <Plus size={15} /> New chapter
            </button>
          </div>
        </div>
        {info && chapters.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] p-5 text-sm leading-6 text-[var(--color-text-muted)]">
            Chapters mark periods of your life, like <em>Final year at university</em> or{' '}
            <em>Summer in Lisbon</em>. Add one to see what you watched during it and how it made you
            feel.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((chapter) => {
              const active = query.chapterId === chapter.id
              return (
                <article
                  key={chapter.id}
                  className={`relative overflow-hidden rounded-[var(--radius-card)] border bg-[var(--color-panel)] p-4 pl-5 ${active ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ background: chapterColorVar(chapter.color) }}
                  />
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-[var(--color-text-primary)]">
                        {chapter.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {chapterDates(chapter)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialog({ chapter })}
                      aria-label={`Edit ${chapter.name}`}
                      title="Edit chapter"
                      className="btn btn-ghost btn-icon btn-sm -mr-2 -mt-2"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  {chapter.note ? (
                    <p className="mt-2 line-clamp-2 text-xs italic text-[var(--color-text-secondary)]">
                      {chapter.note}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    {summaryLine(chapter.summary)}
                  </p>
                  {feelingLine(chapter.summary) ? (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {feelingLine(chapter.summary)}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => update({ chapter: active ? null : String(chapter.id) })}
                    className="link mt-3"
                  >
                    {active ? 'Show everything' : 'Show on timeline'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Search and filters: search and type on the first row, the rest below. */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search titles and notes…"
              aria-label="Search the timeline"
              className="field w-full pl-9"
            />
          </label>
          <div className="segmented" role="group" aria-label="Type">
            {(['all', 'movie', 'series'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={query.type === type}
                onClick={() => update({ type: type === 'all' ? null : type })}
                className="segment"
              >
                {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={query.chapterId ?? ''}
            onChange={(event) => update({ chapter: event.target.value || null })}
            aria-label="Chapter"
            className="field max-w-56"
          >
            <option value="">All chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
          <select
            value={query.moodBefore ?? ''}
            onChange={(event) => update({ mood: event.target.value || null })}
            aria-label="Feeling before watching"
            className="field"
          >
            <option value="">Any feeling</option>
            {MOODS.map((mood) => (
              <option key={mood.key} value={mood.key}>
                {mood.emoji} {mood.label}
              </option>
            ))}
          </select>
          <select
            value={query.reasonId ?? ''}
            onChange={(event) => update({ reason: event.target.value || null })}
            aria-label="Reason"
            className="field max-w-56"
          >
            <option value="">Any reason</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={query.highlightsOnly}
            onClick={() => update({ highlights: query.highlightsOnly ? null : '1' })}
            className={`chip h-11 px-4 ${
              query.highlightsOnly
                ? '!border-[var(--color-highlight)] !bg-[var(--color-highlight-glow)] !text-[var(--color-highlight)]'
                : ''
            }`}
          >
            <Star size={13} fill={query.highlightsOnly ? 'var(--color-highlight-icon)' : 'none'} />{' '}
            Highlights only
          </button>
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setSearchText('')
                setParams(new URLSearchParams(), { replace: true })
              }}
              className="link px-2"
            >
              <SlidersHorizontal size={15} /> Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {!info || !current ? (
        <ListSkeleton label="Loading your timeline" />
      ) : info.total === 0 ? (
        filtered ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No watches match these filters"
            description="Try another search, chapter or type."
          />
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Your timeline starts with your first watch"
            description="Log a watch from any title, and it will appear here as part of your story."
            action={
              <Link to="/collection" className="btn btn-primary">
                Open My Collection
              </Link>
            }
          />
        )
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_120px]">
          <div>
            {current.months.map((month, index) => {
              const year = month.month.slice(0, 4)
              const newYear = year !== current.months[index - 1]?.month.slice(0, 4)
              const monthChapters = [
                ...new Set(month.entries.flatMap((entry) => entry.chapterIds))
              ].flatMap((id) => chapterMap.get(id) ?? [])
              return (
                <section key={month.month} className="mb-6">
                  {newYear ? (
                    <h2
                      id={`year-${year}`}
                      className="scroll-mt-24 pb-2 pt-4 text-3xl font-semibold tabular-nums text-[var(--color-text-primary)]"
                    >
                      {year}
                    </h2>
                  ) : null}
                  <header className="sticky top-20 z-[5] mb-3 flex flex-wrap items-center gap-2 bg-[var(--color-background)] py-2">
                    <h3 className="section-heading text-[var(--color-text-primary)]">
                      {formatMonth(month.month)}
                    </h3>
                    {monthChapters.map((chapter) => (
                      <span
                        key={chapter.id}
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          color: chapterTextColor(chapter.color),
                          background: `color-mix(in srgb, ${chapterColorVar(chapter.color)} 16%, transparent)`
                        }}
                      >
                        {chapter.name}
                      </span>
                    ))}
                  </header>
                  <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[80px] before:top-2 before:w-0.5 before:bg-[var(--color-panel-elevated)]">
                    {monthRows(month, chapters).map((row) =>
                      row.kind === 'entry' ? (
                        <TimelineItem
                          key={row.entry.id}
                          entry={row.entry}
                          chapters={chapterMap}
                          onToggleHighlight={() => toggleHighlight(row.entry)}
                        />
                      ) : (
                        <ChapterDivider key={`${row.kind}-${row.chapter.id}`} row={row} />
                      )
                    )}
                  </ol>
                </section>
              )
            })}
            <div ref={sentinel} aria-hidden="true" className="h-px" />
            {current.next ? (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                Loading earlier memories…
              </p>
            ) : (
              <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                {filtered ? 'That’s everything that matches.' : 'This is where your story begins.'}
              </p>
            )}
          </div>
          <nav aria-label="Jump to year" className="hidden xl:block">
            <ul className="sticky top-24 space-y-1 text-sm">
              {info.years.map((year) => (
                <li key={year.year}>
                  <button
                    type="button"
                    onClick={() => jumpTo(year.year)}
                    className="flex w-full items-center justify-between rounded-[var(--radius-control)] px-2 py-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-panel)] hover:text-[var(--color-text-primary)]"
                  >
                    <span className="font-semibold">{year.year}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{year.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      {dialog ? (
        <ChapterDialog
          chapter={dialog.chapter}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            setRefresh((count) => count + 1)
          }}
        />
      ) : null}
    </div>
  )
}

export default Timeline
