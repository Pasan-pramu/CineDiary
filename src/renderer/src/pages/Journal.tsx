import {
  BookHeart,
  CalendarDays,
  Meh,
  Search,
  SlidersHorizontal,
  Smile,
  TrendingUp
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MoodBadge from '../components/MoodBadge'
import MoodChange from '../components/MoodChange'
import PageTitle from '../components/PageTitle'
import PosterPlaceholder from '../components/PosterPlaceholder'
import ReasonChip from '../components/ReasonChip'
import SectionPanel from '../components/SectionPanel'
import { ListSkeleton } from '../components/Skeleton'
import StatCard from '../components/StatCard'
import { useJournalQuery } from '../hooks/useJournalQuery'
import type { JournalEntry, JournalResult, LifePeriod, Reason } from '../../../shared/types'
import { formatMonthGroup, formatWatchDates } from '../format'
import { timelineMonthKey } from '../../../shared/timeline'
import { failed } from '../errors'
import { useIncrementalList } from '../hooks/useIncrementalList'
import { filterOptions, useMoods, useReasons } from '../hooks/useMoods'

const NO_ENTRIES: JournalEntry[] = []

function Journal(): React.JSX.Element {
  const navigate = useNavigate()
  const { query, update, updateMany, clear } = useJournalQuery()
  const [result, setResult] = useState<JournalResult | null>(null)
  const moods = useMoods()
  const reasons = useReasons()
  const [chapters, setChapters] = useState<LifePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const { visible, hasMore, sentinel } = useIncrementalList(result?.entries ?? NO_ENTRIES, 40)
  // Only typing waits a moment; the first load and filter changes go at once.
  const lastSearch = useRef(query.search)

  useEffect(() => {
    void window.api.timeline
      .chapters()
      .then(setChapters)
      .catch(failed('Couldn’t load your life chapters.'))
  }, [])

  useEffect(() => {
    const typing = query.search !== lastSearch.current
    lastSearch.current = query.search
    const timer = window.setTimeout(
      () => {
        void window.api.watchEntries
          .journal(query)
          .then(setResult)
          .catch(failed('Couldn’t load your journal. Try again in a moment.'))
          .finally(() => setLoading(false))
      },
      typing ? 250 : 0
    )
    return () => window.clearTimeout(timer)
  }, [query])

  const groups = useMemo(() => {
    const grouped = new Map<string, JournalEntry[]>()
    for (const entry of visible) {
      // Same groups as the Timeline: months, "Sometime in 2019", then "date not remembered".
      const key = timelineMonthKey(entry.completedAt ?? entry.startedAt, entry.datePrecision)
      grouped.set(key, [...(grouped.get(key) ?? []), entry])
    }
    return [...grouped.entries()]
  }, [visible])

  // "Showing: Lonely (feeling or reason) · Final year at university"
  const moodLabel = (key: string | null): string | undefined =>
    moods.find((mood) => mood.key === key)?.label ?? key ?? undefined

  // One "why" filter: a feeling (mood before, or the reason with the same name), or a reason
  // that has no mood twin. "Stressed" the feeling and "Stressed" the reason are one option.
  const isTwin = (reason: Reason): boolean =>
    moods.some(
      (mood) => mood.key === reason.key || mood.label.toLowerCase() === reason.label.toLowerCase()
    )
  const whyValue = query.feelingOrReason
    ? `either:${query.feelingOrReason}`
    : query.reasonId
      ? `reason:${query.reasonId}`
      : ''
  const whyOptions = [
    ...filterOptions(moods).map((mood) => ({
      value: `either:${mood.key}`,
      label: `${mood.emoji} ${mood.optionLabel}`,
      group: 'Feelings (felt it, or watched because of it)'
    })),
    ...filterOptions(reasons)
      // A twin reason only shows when an old link selected it directly.
      .filter((reason) => !isTwin(reason) || reason.id === query.reasonId)
      .map((reason) => ({
        value: `reason:${reason.id}`,
        label: reason.optionLabel,
        group: 'Other reasons'
      }))
  ]
  const setWhy = (value: string): void => {
    const [kind, id] = value.split(/:(.*)/s)
    updateMany({
      feelingOrReason: kind === 'either' ? id : null,
      reasonId: kind === 'reason' ? Number(id) : null
    })
  }
  const showingLabel =
    [
      reasons.find((reason) => reason.id === query.reasonId)?.label,
      query.moodBefore ? `${moodLabel(query.moodBefore)} before` : undefined,
      query.feelingOrReason ? `${moodLabel(query.feelingOrReason)} (feeling or reason)` : undefined,
      chapters.find((chapter) => chapter.id === query.chapterId)?.name,
      query.moodImproved ? 'Mood improved' : undefined,
      query.hasReflection ? 'Has reflection' : undefined
    ]
      .filter(Boolean)
      .join(' · ') || null
  const hasEntries = Boolean(result?.entries.length || result?.currentlyWatching.length)
  const filtering = Boolean(
    query.search ||
    query.type !== 'all' ||
    query.reasonId ||
    query.moodBefore ||
    query.feelingOrReason ||
    query.chapterId ||
    query.moodImproved ||
    query.hasReflection
  )

  return (
    <div className="page-reading">
      <PageTitle description="A quiet place for the stories you watched and the feelings you carried with them.">
        My Cinema Journal
      </PageTitle>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Entries this month"
          value={result?.summary.entriesThisMonth ?? null}
        />
        <StatCard
          icon={Meh}
          tone="blue"
          label="Avg. mood before"
          value={result?.summary.averageMoodBefore ?? null}
          format={formatAverage}
        />
        <StatCard
          icon={Smile}
          tone="positive"
          label="Avg. mood after"
          value={result?.summary.averageMoodAfter ?? null}
          format={formatAverage}
        />
        <StatCard
          icon={TrendingUp}
          tone="positive"
          label="Avg. mood change"
          value={result?.summary.averageMoodChange ?? null}
          format={formatChange}
        />
      </div>
      <SectionPanel title="Find a memory" className="mb-4">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={query.search}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Search your memories…"
              aria-label="Search your memories"
              className="field w-full pl-9"
            />
          </label>
          <Select
            value={query.type}
            onChange={(value) => update('type', value)}
            options={['all', 'movie', 'series']}
            labels={['All types', 'Movies', 'Series']}
          />
          <select
            value={whyValue}
            onChange={(event) => setWhy(event.target.value)}
            aria-label="Why I watched"
            className="field max-w-full"
          >
            <option value="">Any feeling or reason</option>
            {[...new Set(whyOptions.map((option) => option.group))].map((group) => (
              <optgroup key={group} label={group}>
                {whyOptions
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <Select
            value={query.moodBefore ?? ''}
            onChange={(value) => update('moodBefore', value || null)}
            options={['', ...filterOptions(moods).map((mood) => mood.key)]}
            labels={[
              'Any mood before',
              ...filterOptions(moods).map((mood) => `${mood.emoji} ${mood.optionLabel}`)
            ]}
          />
          {chapters.length ? (
            <Select
              value={query.chapterId?.toString() ?? ''}
              onChange={(value) => update('chapterId', value ? Number(value) : null)}
              options={['', ...chapters.map((chapter) => chapter.id.toString())]}
              labels={['Any chapter', ...chapters.map((chapter) => chapter.name)]}
            />
          ) : null}
          <Toggle
            active={query.moodImproved}
            onClick={() => update('moodImproved', !query.moodImproved)}
          >
            Mood improved
          </Toggle>
          <Toggle
            active={query.hasReflection}
            onClick={() => update('hasReflection', !query.hasReflection)}
          >
            Has reflection
          </Toggle>
          {filtering ? (
            <button type="button" onClick={clear} className="link px-2">
              <SlidersHorizontal size={15} /> Clear filters
            </button>
          ) : null}
        </div>
      </SectionPanel>
      <p className="mb-6 flex min-h-5 flex-wrap items-baseline gap-x-3 text-sm text-[var(--color-text-muted)]">
        {result ? (
          <span>
            {result.total.toLocaleString()} {result.total === 1 ? 'watch' : 'watches'}
          </span>
        ) : null}
        {showingLabel ? <span>Showing: {showingLabel}</span> : null}
      </p>
      {result?.currentlyWatching.length ? (
        <SectionPanel title="Currently watching" className="mb-6">
          <div className="grid gap-3 md:grid-cols-2">
            {result.currentlyWatching.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onClick={() => navigate(`/title/${entry.title.id}`)}
              />
            ))}
          </div>
        </SectionPanel>
      ) : null}
      {loading ? <ListSkeleton label="Loading your journal" /> : null}
      {!loading && !hasEntries ? (
        filtering ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No matching memories"
            description="Try adjusting your filters to find another memory."
            action={
              <button type="button" onClick={clear} className="btn btn-primary">
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={BookHeart}
            title="Your journal starts with your first watch"
            description="Start or log a watch on any title. Your reasons, moods and reflections will gather here over time."
            action={
              <button
                type="button"
                onClick={() => navigate('/collection')}
                className="btn btn-primary"
              >
                Open My Collection
              </button>
            }
          />
        )
      ) : null}
      {groups.map(([month, entries]) => (
        <section key={month} className="mb-8">
          <h2 className="section-heading mb-4 flex items-center gap-2 text-[var(--color-text-primary)]">
            <CalendarDays size={18} className="text-[var(--color-accent-light)]" />
            {formatMonthGroup(month)}
          </h2>
          <div className="space-y-3">
            {entries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onClick={() => navigate(`/title/${entry.title.id}`)}
              />
            ))}
          </div>
        </section>
      ))}
      {/* Older memories appear as you scroll. */}
      {hasMore ? <div ref={sentinel} aria-hidden="true" className="h-px" /> : null}
    </div>
  )
}

function JournalEntryCard({
  entry,
  onClick
}: {
  entry: JournalEntry
  onClick: () => void
}): React.JSX.Element {
  const [posterFailed, setPosterFailed] = useState(false)
  const excerpt = entry.reasonNote || entry.thoughts || entry.lessons
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick()
      }}
      aria-label={`Open ${entry.title.title}`}
      className="lift flex w-full cursor-pointer gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left hover:border-[var(--color-accent)] hover:bg-[var(--color-panel-elevated)]"
    >
      <div className="w-16 shrink-0">
        {entry.title.posterFile && !posterFailed ? (
          <img
            src={`poster://titles/${entry.title.id}`}
            alt=""
            onError={() => setPosterFailed(true)}
            className="aspect-[2/3] w-full rounded-lg object-cover"
          />
        ) : (
          <PosterPlaceholder title={entry.title.title} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {entry.title.title}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {entry.title.type === 'series' ? 'TV Series' : 'Movie'} ·{' '}
              {formatWatchDates(entry.startedAt, entry.completedAt, entry.datePrecision)}
            </p>
          </div>
          <div className="flex gap-2">
            {entry.isRewatch ? (
              <span className="rounded-full bg-[var(--color-accent-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent-light)]">
                Rewatch
              </span>
            ) : null}
            {entry.title.status === 'dropped' ? (
              <span className="rounded-full bg-[var(--color-favorite)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-favorite)]">
                Dropped
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {entry.moodBefore ? (
            <MoodBadge mood={entry.moodBefore} score={entry.moodBeforeScore} />
          ) : null}
          {entry.moodAfter ? (
            <>
              <span className="text-[var(--color-text-muted)]">→</span>
              <MoodBadge mood={entry.moodAfter} score={entry.moodAfterScore} />
            </>
          ) : null}
          <MoodChange before={entry.moodBeforeScore} after={entry.moodAfterScore} />
        </div>
        {entry.reasons.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.reasons.map((reason) => (
              <ReasonChip key={reason.id} label={reason.label} />
            ))}
          </div>
        ) : null}
        {excerpt ? (
          <p className="mt-3 line-clamp-2 text-sm italic text-[var(--color-text-secondary)]">
            “{excerpt}”
          </p>
        ) : null}
      </div>
    </article>
  )
}

function formatAverage(value: number): string {
  return value.toFixed(1)
}
function formatChange(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}
function Toggle({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="chip h-11 px-4">
      {children}
    </button>
  )
}
function Select({
  value,
  onChange,
  options,
  labels
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  labels: string[]
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={labels[0]}
      className="field max-w-full"
    >
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  )
}

export default Journal
