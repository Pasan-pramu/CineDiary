import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Grid2X2, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import PosterCard from '../components/PosterCard'
import TitleListRow from '../components/TitleListRow'
import type { CollectionQuery, Title, TitleStatus } from '../../../shared/types'

const statuses: Array<TitleStatus | 'all'> = [
  'all',
  'watching',
  'completed',
  'planned',
  'dropped',
  'rewatching'
]

function parseQuery(params: URLSearchParams): CollectionQuery {
  const type = params.get('type')
  const status = params.get('status')
  const sort = params.get('sort')
  const minimumRating = Number(params.get('minRating'))
  return {
    search: params.get('q') ?? '',
    type: type === 'movie' || type === 'series' ? type : 'all',
    status: statuses.includes(status as TitleStatus)
      ? (status as CollectionQuery['status'])
      : 'all',
    genre: params.get('genre') ?? '',
    favorite: params.get('favorite') === 'true',
    minimumRating:
      Number.isInteger(minimumRating) && minimumRating >= 1 && minimumRating <= 10
        ? minimumRating
        : null,
    sort: sort === 'title' || sort === 'rating' || sort === 'year' ? sort : 'recent',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc'
  }
}

function Library(): React.JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseQuery(params), [params])
  const [titles, setTitles] = useState<Title[]>([])
  const [total, setTotal] = useState(0)
  const [genres, setGenres] = useState<string[]>([])
  const [view, setView] = useState<'grid' | 'list'>(params.get('view') === 'list' ? 'list' : 'grid')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.api.titles
      .listGenres()
      .then(setGenres)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void window.api.titles
        .collection(query)
        .then((result) => {
          setTitles(result.titles)
          setTotal(result.total)
        })
        .catch(() => {
          setTitles([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const update = (key: string, value: string | number | boolean | null): void => {
    const next = new URLSearchParams(params)
    const paramKey = key === 'search' ? 'q' : key === 'minimumRating' ? 'minRating' : key
    if (
      value === '' ||
      value === false ||
      value === null ||
      value === 'all' ||
      value === 'recent'
    ) {
      next.delete(paramKey)
    } else {
      next.set(paramKey, String(value))
    }
    setParams(next)
  }

  const clearFilters = (): void => {
    setParams(query.search ? new URLSearchParams({ q: query.search }) : new URLSearchParams())
  }

  const setViewMode = (nextView: 'grid' | 'list'): void => {
    setView(nextView)
    update('view', nextView === 'grid' ? null : nextView)
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageTitle description="A home for every story you have watched, loved, or saved for later.">
        My Collection
      </PageTitle>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <QuickChip active={!query.favorite && query.status === 'all'} onClick={clearFilters}>
            All titles
          </QuickChip>
          <QuickChip
            active={query.status === 'planned'}
            onClick={() => update('status', 'planned')}
          >
            Watchlist
          </QuickChip>
          <QuickChip active={query.favorite} onClick={() => update('favorite', !query.favorite)}>
            Favorites
          </QuickChip>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={query.search}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Search your collection..."
              className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] pl-10 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <Select
            value={query.type}
            onChange={(value) => update('type', value)}
            options={['all', 'movie', 'series']}
            labels={['All types', 'Movies', 'Series']}
          />
          <Select
            value={query.status}
            onChange={(value) => update('status', value)}
            options={statuses}
            labels={['All statuses', 'Watching', 'Completed', 'Planned', 'Dropped', 'Rewatching']}
          />
          <Select
            value={query.genre}
            onChange={(value) => update('genre', value)}
            options={['', ...genres]}
            labels={['All genres', ...genres]}
          />
          <Select
            value={query.minimumRating ? String(query.minimumRating) : ''}
            onChange={(value) => update('minimumRating', value ? Number(value) : null)}
            options={['', '7', '8', '9']}
            labels={['Any rating', '7+', '8+', '9+']}
          />
          <Select
            value={query.sort}
            onChange={(value) => update('sort', value)}
            options={['recent', 'title', 'rating', 'year']}
            labels={['Recently added', 'Title A–Z', 'Rating', 'Year']}
          />
          <button
            type="button"
            onClick={() => setViewMode(view === 'grid' ? 'list' : 'grid')}
            aria-label="Toggle collection view"
            className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-elevated)]"
          >
            {view === 'grid' ? <List size={17} /> : <Grid2X2 size={17} />}
          </button>
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <span>{loading ? 'Loading…' : `${total} ${total === 1 ? 'title' : 'titles'}`}</span>
        {query.search ||
        query.type !== 'all' ||
        query.status !== 'all' ||
        query.genre ||
        query.favorite ||
        query.minimumRating ? (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]"
          >
            <X size={14} /> Clear filters
          </button>
        ) : null}
      </div>
      {!loading && total === 0 ? (
        <EmptyState
          icon={
            titles.length === 0 && !query.search && query.status === 'all' && query.type === 'all'
              ? BookOpen
              : SlidersHorizontal
          }
          title={
            titles.length === 0 && !query.search && query.status === 'all' && query.type === 'all'
              ? 'Your collection is empty'
              : 'No matches'
          }
          description={
            titles.length === 0 && !query.search && query.status === 'all' && query.type === 'all'
              ? 'Add your first movie or series to start your personal cinema.'
              : 'Try adjusting your search or filters to find what you are looking for.'
          }
          action={
            titles.length === 0 &&
            !query.search &&
            query.status === 'all' &&
            query.type === 'all' ? (
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-on-accent)]"
              >
                <Plus size={16} /> Add Title
              </button>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-on-accent)]"
              >
                Clear filters
              </button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {titles.map((title) => (
            <PosterCard
              key={title.id}
              title={title}
              onClick={() => navigate(`/title/${title.id}?${params.toString()}`)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {titles.map((title) => (
            <TitleListRow
              key={title.id}
              title={title}
              onClick={() => navigate(`/title/${title.id}?${params.toString()}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface QuickChipProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}
function QuickChip({ active, onClick, children }: QuickChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${active ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
    >
      {children}
    </button>
  )
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  labels: readonly string[]
}
function Select({ value, onChange, options, labels }: SelectProps): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 max-w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
    >
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  )
}

export default Library
