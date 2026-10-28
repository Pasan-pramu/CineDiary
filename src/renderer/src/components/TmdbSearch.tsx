import { ArrowRight, Film, Loader2, Search, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useSettings } from '../hooks/useSettings'
import type { TitleType, TmdbPick, TmdbResult, TmdbSearchResult } from '../../../shared/types'
import SectionPanel from './SectionPanel'
import { quietly } from '../errors'

const MIN_QUERY_LENGTH = 2
const SEARCH_DELAY_MS = 400

/** Thumbnails fetched through the main process, kept in memory for this session only. */
const thumbnailCache = new Map<string, string | null>()

function Thumbnail({ path }: { path: string | null }): React.JSX.Element {
  const [src, setSrc] = useState(() => (path ? (thumbnailCache.get(path) ?? null) : null))

  useEffect(() => {
    if (!path || thumbnailCache.has(path)) return
    let cancelled = false
    void window.api.tmdb
      .thumbnail(path)
      .then((url) => {
        thumbnailCache.set(path, url)
        if (!cancelled) setSrc(url)
      })
      .catch(quietly('tmdb:thumbnail'))
    return () => {
      cancelled = true
    }
  }, [path])

  return (
    <div className="flex aspect-[2/3] w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--color-panel-elevated)] text-[var(--color-text-muted)]">
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <Film size={16} />}
    </div>
  )
}

function Notice({
  icon,
  children
}: {
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <p className="flex items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
      {icon}
      <span>{children}</span>
    </p>
  )
}

interface TmdbSearchProps {
  /** Called with the mapped details and downloaded poster of the chosen result. */
  onPick: (pick: TmdbPick) => void
  /** Text to start with, e.g. the title being linked. */
  initialQuery?: string
  /** Only show results of this type (linking keeps a title's type). */
  typeFilter?: TitleType
  /** Without the "Search TMDB" panel around it (for use inside a dialog). */
  bare?: boolean
}

/** "Search TMDB" box for Add Title and Link to TMDB. Manual entry always works. */
function TmdbSearch({
  onPick,
  initialQuery = '',
  typeFilter,
  bare = false
}: TmdbSearchProps): React.JSX.Element {
  const online = useOnlineStatus()
  const settings = useSettings()
  const [query, setQuery] = useState(initialQuery)
  const [result, setResult] = useState<{
    query: string
    value: TmdbResult<TmdbSearchResult[]>
  } | null>(null)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  const trimmed = query.trim()
  const tokenState = settings?.tmdbToken.state ?? 'none'
  const ready = online && tokenState === 'saved'

  useEffect(() => {
    if (!ready || trimmed.length < MIN_QUERY_LENGTH) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.api.tmdb.search(trimmed).then((value) => {
        if (!cancelled) setResult({ query: trimmed, value })
      })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ready, trimmed])

  const loaded =
    trimmed.length >= MIN_QUERY_LENGTH && result?.query === trimmed ? result.value : null
  const current: TmdbResult<TmdbSearchResult[]> | null =
    loaded?.ok && typeFilter
      ? { ok: true, data: loaded.data.filter((item) => item.type === typeFilter) }
      : loaded
  const searching = ready && trimmed.length >= MIN_QUERY_LENGTH && current === null

  const choose = (item: TmdbSearchResult): void => {
    const id = `${item.type}:${item.tmdbId}`
    setPickingId(id)
    setPickError(null)
    void window.api.tmdb
      .pick(item.type, item.tmdbId)
      .then((picked) => {
        if (!picked.ok) {
          setPickError(picked.error.message)
          return
        }
        onPick(picked.data)
        setQuery('')
      })
      .finally(() => setPickingId(null))
  }

  return (
    <Wrapper bare={bare}>
      {settings === null ? null : !online ? (
        <Notice icon={<WifiOff size={18} />}>You’re offline — add the title manually below.</Notice>
      ) : tokenState !== 'saved' ? (
        <Notice icon={<Search size={18} />}>
          {tokenState === 'unreadable'
            ? 'Your saved TMDB token can’t be read on this computer. Enter it again in '
            : 'Add your TMDB token in '}
          <Link to="/settings" className="text-[var(--color-accent-light)] hover:underline">
            Settings
          </Link>{' '}
          to search and autofill. You can always add titles manually below.
        </Notice>
      ) : (
        <>
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies and series, e.g. Interstellar"
              aria-label="Search TMDB"
              className="field w-full pl-11 pr-11"
            />
            {searching ? (
              <Loader2
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-muted)] motion-reduce:animate-none"
              />
            ) : null}
          </label>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Pick a result to fill in the details and poster. You can change anything before saving.
          </p>
          {pickError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]">{pickError}</p>
          ) : null}
          {current && !current.ok ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]">{current.error.message}</p>
          ) : null}
          {current?.ok && current.data.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              No matches on TMDB. Try another spelling, or add it manually below.
            </p>
          ) : null}
          {current?.ok && current.data.length > 0 ? (
            <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto pr-1">
              {current.data.map((item) => {
                const id = `${item.type}:${item.tmdbId}`
                const busy = pickingId === id
                const content = (
                  <>
                    <Thumbnail path={item.posterPath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {item.type === 'series' ? 'TV Series' : 'Movie'}
                        {item.year ? ` · ${item.year}` : ''}
                        {item.originalTitle && item.originalTitle !== item.title
                          ? ` · ${item.originalTitle}`
                          : ''}
                      </p>
                    </div>
                  </>
                )
                return (
                  <li key={id}>
                    {item.existingTitleId !== null ? (
                      <div className="flex items-center gap-3 rounded-[var(--radius-card)] p-2 opacity-80">
                        {content}
                        <Link
                          to={`/title/${item.existingTitleId}`}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-accent-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-light)] hover:underline"
                        >
                          Already in your collection <ArrowRight size={13} />
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={pickingId !== null}
                        onClick={() => choose(item)}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] p-2 text-left transition hover:bg-[var(--color-panel-elevated)] disabled:cursor-wait"
                      >
                        {content}
                        {busy ? (
                          <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
                            <Loader2
                              size={14}
                              className="animate-spin motion-reduce:animate-none"
                            />
                            Filling in…
                          </span>
                        ) : null}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}
    </Wrapper>
  )
}

function Wrapper({
  bare,
  children
}: {
  bare: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return bare ? (
    <div>{children}</div>
  ) : (
    <SectionPanel title="Search TMDB" className="mb-6">
      {children}
    </SectionPanel>
  )
}

export default TmdbSearch
