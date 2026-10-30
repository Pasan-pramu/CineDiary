import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Grid2X2, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageTitle from '../components/PageTitle'
import PosterCard from '../components/PosterCard'
import { ListSkeleton, PosterGridSkeleton } from '../components/Skeleton'
import TitleListRow from '../components/TitleListRow'
import { NOT_RECORDED_LANGUAGE, languageLabel } from '../../../shared/languages'
import type { CollectionQuery, LanguageOption, Title, TitleStatus } from '../../../shared/types'
import { failed } from '../errors'
import { useIncrementalList } from '../hooks/useIncrementalList'

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
    language: params.get('language') ?? '',
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
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [view, setView] = useState<'grid' | 'list'>(params.get('view') === 'list' ? 'list' : 'grid')
  const [loading, setLoading] = useState(true)
  const { visible, hasMore, sentinel } = useIncrementalList(titles, 60)
  // Only typing waits a moment; the first load and filter changes go at once.
  const lastSearch = useRef(query.search)

  useEffect(() => {
    void window.api.titles.listGenres().then(setGenres).catch(failed('Couldn’t load your genres.'))
    void window.api.titles
      .listLanguages()
      .then(setLanguages)
      .catch(failed('Couldn’t load your languages.'))
  }, [])

  useEffect(() => {
    const typing = query.search !== lastSearch.current
    lastSearch.current = query.search
    const timer = window.setTimeout(
      () => {
        void window.api.titles
          .collection(query)
          .then((result) => {
            setTitles(result.titles)
            setTotal(result.total)
          })
          // Keep what's on screen; an empty grid would wrongly say "Your collection is empty".
          .catch(failed('Couldn’t load your collection. Try again in a moment.'))
          .finally(() => setLoading(false))
      },
      typing ? 250 : 0
    )
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

  // A language from a link (Home, Insights) may not be in the list yet, or no longer.
  const languageOptions =
    query.language &&
    query.language !== NOT_RECORDED_LANGUAGE &&
    !languages.some((language) => language.key === query.language)
      ? [...languages, { key: query.language, label: languageLabel(query.language) }]
      : languages
  const filtered = Boolean(
    query.search ||
    query.type !== 'all' ||
    query.status !== 'all' ||
    query.genre ||
    query.language ||
    query.favorite ||
    query.minimumRating
  )

  const setViewMode = (nextView: 'grid' | 'list'): void => {
    setView(nextView)
    update('view', nextView === 'grid' ? null : nextView)
  }

  return (
    <div className="page-wide">
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
              placeholder="Search your collection…"
              aria-label="Search your collection"
              className="field w-full pl-10"
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
            value={query.language}
            onChange={(value) => update('language', value)}
            options={[
              '',
              ...languageOptions.map((language) => language.key),
              NOT_RECORDED_LANGUAGE
            ]}
            labels={[
              'All languages',
              ...languageOptions.map((language) => language.label),
              languageLabel(NOT_RECORDED_LANGUAGE)
            ]}
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
        </div>
      </div>
      <div className="mb-5 flex min-h-11 items-center gap-4 text-sm text-[var(--color-text-muted)]">
        <span>
          {loading ? '' : `${total.toLocaleString()} ${total === 1 ? 'title' : 'titles'}`}
        </span>
        {filtered ? (
          <button type="button" onClick={clearFilters} className="link">
            <X size={14} /> Clear filters
          </button>
        ) : null}
        <div className="segmented ml-auto" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === 'grid'}
            aria-label="Poster grid"
            title="Poster grid"
            onClick={() => setViewMode('grid')}
            className="segment"
          >
            <Grid2X2 size={16} />
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            aria-label="List"
            title="List"
            onClick={() => setViewMode('list')}
            className="segment"
          >
            <List size={16} />
          </button>
        </div>
      </div>
      {loading ? (
        view === 'grid' ? (
          <PosterGridSkeleton />
        ) : (
          <ListSkeleton label="Loading titles" />
        )
      ) : total === 0 ? (
        <EmptyState
          icon={titles.length === 0 && !filtered ? BookOpen : SlidersHorizontal}
          title={titles.length === 0 && !filtered ? 'Your collection is empty' : 'No matches'}
          description={
            titles.length === 0 && !filtered
              ? 'Add your first movie or series to start your personal cinema.'
              : 'Try adjusting your search or filters to find what you are looking for.'
          }
          action={
            titles.length === 0 && !filtered ? (
              <button type="button" onClick={() => navigate('/add')} className="btn btn-primary">
                <Plus size={16} /> Add Title
              </button>
            ) : (
              <button type="button" onClick={clearFilters} className="btn btn-primary">
                Clear filters
              </button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="poster-grid">
          {visible.map((title) => (
            <PosterCard
              key={title.id}
              title={title}
              onClick={() => navigate(`/title/${title.id}?${params.toString()}`)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((title) => (
            <TitleListRow
              key={title.id}
              title={title}
              onClick={() => navigate(`/title/${title.id}?${params.toString()}`)}
            />
          ))}
        </div>
      )}
      {/* More titles appear as you scroll (a big collection opens quickly). */}
      {hasMore ? <div ref={sentinel} aria-hidden="true" className="h-px" /> : null}
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
    <button type="button" onClick={onClick} aria-pressed={active} className="chip px-4 py-2">
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

export default Library
