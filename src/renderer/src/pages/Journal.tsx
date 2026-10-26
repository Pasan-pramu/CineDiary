import { BookHeart, CalendarDays, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MoodBadge from '../components/MoodBadge'
import MoodChange from '../components/MoodChange'
import PageTitle from '../components/PageTitle'
import PosterPlaceholder from '../components/PosterPlaceholder'
import ReasonChip from '../components/ReasonChip'
import SectionPanel from '../components/SectionPanel'
import { useJournalQuery } from '../hooks/useJournalQuery'
import { MOODS } from '../../../shared/constants'
import type { JournalEntry, JournalResult, Reason } from '../../../shared/types'

function Journal(): React.JSX.Element {
  const navigate = useNavigate()
  const { query, update, clear } = useJournalQuery()
  const [result, setResult] = useState<JournalResult | null>(null)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.api.watchEntries
      .listReasons()
      .then(setReasons)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void window.api.watchEntries
        .journal(query)
        .then(setResult)
        .catch(() => setResult(null))
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const groups = useMemo(() => {
    const grouped = new Map<string, JournalEntry[]>()
    for (const entry of result?.entries ?? []) {
      const date = entry.completedAt ?? entry.startedAt
      const key = date.slice(0, 7)
      grouped.set(key, [...(grouped.get(key) ?? []), entry])
    }
    return [...grouped.entries()]
  }, [result])

  const selectedReason = reasons.find((reason) => reason.id === query.reasonId)?.label
  const showingLabel =
    selectedReason ??
    (query.moodBefore
      ? MOODS.find((mood) => mood.key === query.moodBefore)?.label
      : query.moodImproved
        ? 'Mood improved'
        : query.hasReflection
          ? 'Has reflection'
          : null)
  const hasEntries = Boolean(result?.entries.length || result?.currentlyWatching.length)

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle description="A quiet place for the stories you watched and the feelings you carried with them.">
        My Cinema Journal
      </PageTitle>
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Summary label="Entries this month" value={result?.summary.entriesThisMonth ?? '–'} />
        <Summary
          label="Average mood before"
          value={formatAverage(result?.summary.averageMoodBefore)}
        />
        <Summary
          label="Average mood after"
          value={formatAverage(result?.summary.averageMoodAfter)}
        />
        <Summary
          label="Average mood change"
          value={formatChange(result?.summary.averageMoodChange)}
        />
      </div>
      {showingLabel ? (
        <p className="mb-4 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          Showing: {showingLabel}
        </p>
      ) : null}
      <SectionPanel title="Find a memory" className="mb-6">
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={query.search}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Search your memories..."
              className="h-10 w-full pl-9"
            />
          </label>
          <Select
            value={query.type}
            onChange={(value) => update('type', value)}
            options={['all', 'movie', 'series']}
            labels={['All types', 'Movies', 'Series']}
          />
          <Select
            value={query.reasonId?.toString() ?? ''}
            onChange={(value) => update('reasonId', value ? Number(value) : null)}
            options={['', ...reasons.map((reason) => reason.id.toString())]}
            labels={['Any reason', ...reasons.map((reason) => reason.label)]}
          />
          <Select
            value={query.moodBefore ?? ''}
            onChange={(value) => update('moodBefore', value || null)}
            options={['', ...MOODS.map((mood) => mood.key)]}
            labels={['Any mood before', ...MOODS.map((mood) => `${mood.emoji} ${mood.label}`)]}
          />
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
          {query.search ||
          query.type !== 'all' ||
          query.reasonId ||
          query.moodBefore ||
          query.moodImproved ||
          query.hasReflection ? (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 px-2 text-sm text-[var(--color-accent-light)]"
            >
              <SlidersHorizontal size={15} /> Clear
            </button>
          ) : null}
        </div>
      </SectionPanel>
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
      {!loading && !hasEntries ? (
        <EmptyState
          icon={result ? SlidersHorizontal : BookHeart}
          title={result ? 'No matching memories' : 'Start watching something to begin your journal'}
          description={
            result
              ? 'Try adjusting your filters to find another memory.'
              : 'Your reasons, moods, and reflections will gather here over time.'
          }
          action={
            result ? (
              <button
                type="button"
                onClick={clear}
                className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : null}
      {groups.map(([month, entries]) => (
        <section key={month} className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-display text-2xl text-[var(--color-text-primary)]">
            <CalendarDays size={20} className="text-[var(--color-accent-light)]" />{' '}
            {formatMonth(month)}
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
      className="flex w-full gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-panel-elevated)]"
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
            <h3 className="font-display text-xl text-[var(--color-text-primary)]">
              {entry.title.title}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {entry.title.type === 'series' ? 'TV Series' : 'Movie'} ·{' '}
              {entry.completedAt
                ? `${entry.startedAt} → ${entry.completedAt}`
                : `Started ${entry.startedAt}`}
            </p>
          </div>
          <div className="flex gap-2">
            {entry.isRewatch ? (
              <span className="rounded-full bg-[var(--color-accent-muted)] px-2 py-1 text-[10px] text-[var(--color-accent-light)]">
                Rewatch
              </span>
            ) : null}
            {entry.title.status === 'dropped' ? (
              <span className="rounded-full bg-[var(--color-favorite)]/15 px-2 py-1 text-[10px] text-[var(--color-favorite)]">
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

function Summary({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  )
}
function formatAverage(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : value.toFixed(1)
}
function formatChange(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}
function formatMonth(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(`${value}-01T00:00:00`)
  )
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
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs ${active ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'}`}
    >
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
      className="h-10 max-w-full"
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
