import {
  ArrowLeft,
  Edit3,
  Film,
  Heart,
  Link2,
  MoreVertical,
  Play,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import LinkTmdbDialog from '../components/LinkTmdbDialog'
import MoodChange from '../components/MoodChange'
import PosterPlaceholder from '../components/PosterPlaceholder'
import RatingStars from '../components/RatingStars'
import SectionPanel from '../components/SectionPanel'
import WatchEntryCard from '../components/WatchEntryCard'
import WatchEntryDialog from '../components/WatchEntryDialog'
import type { Title, TitleCredits, WatchEntry } from '../../../shared/types'

type DialogMode = 'start' | 'finish' | 'past' | 'edit'

function TitleDetails(): React.JSX.Element {
  const { titleId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState<Title | null>(null)
  const [entries, setEntries] = useState<WatchEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogMode | null>(null)
  const [editingEntry, setEditingEntry] = useState<WatchEntry | undefined>()
  const [posterFailed, setPosterFailed] = useState(false)
  const [backdropFailed, setBackdropFailed] = useState(false)
  const [credits, setCredits] = useState<TitleCredits | null>(null)
  const [linking, setLinking] = useState(false)

  const load = (): void => {
    const id = Number(titleId)
    if (!Number.isInteger(id) || id <= 0) return
    void Promise.all([
      window.api.titles.get(id),
      window.api.watchEntries.list(id),
      window.api.titles.credits(id)
    ])
      .then(([nextTitle, nextEntries, nextCredits]) => {
        setTitle(nextTitle)
        setEntries(nextEntries)
        setCredits(nextCredits)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [titleId])

  if (loading) return <p className="text-sm text-[var(--color-text-muted)]">Loading your memory…</p>
  if (!title)
    return (
      <EmptyState
        icon={Film}
        title="Title not found"
        description="This title could not be found in your collection."
      />
    )

  const showBackdrop = title.backdropFile !== null && !backdropFailed
  const activeEntry = entries.find((entry) => !entry.completedAt)
  const latest = entries[0]
  const primaryLabel =
    title.status === 'dropped'
      ? 'Resume watching'
      : activeEntry
        ? 'Finish & reflect'
        : entries.some((entry) => entry.completedAt)
          ? 'Watch again'
          : 'Start watching'
  const primaryIcon = activeEntry ? MoreVertical : title.status === 'dropped' ? RotateCcw : Play
  const PrimaryIcon = primaryIcon

  const deleteTitle = (): void => {
    if (!window.confirm(`Delete "${title.title}" and all of its watch memories?`)) return
    void window.api.titles.delete(title.id).then(() => navigate('/collection'))
  }

  const changeStatus = (): void => {
    const status =
      title.status === 'dropped' ? (activeEntry?.isRewatch ? 'rewatching' : 'watching') : 'dropped'
    void window.api.titles.setStatus(title.id, status).then(setTitle)
  }

  const primaryAction = (): void => {
    if (title.status === 'dropped') {
      changeStatus()
    } else if (activeEntry) {
      setEditingEntry(activeEntry)
      setDialog('finish')
    } else {
      setDialog(entries.some((entry) => entry.completedAt) ? 'start' : 'start')
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        type="button"
        onClick={() => navigate(`/collection?${searchParams.toString()}`)}
        className="mb-5 flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-white"
      >
        <ArrowLeft size={16} /> Back to My Collection
      </button>
      <section className="relative isolate overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 sm:p-8">
        {/* The TMDB backdrop when we have one; otherwise (or if it fails) the blurred poster. */}
        {showBackdrop ? (
          <img
            src={`poster://backdrops/${title.id}`}
            alt=""
            onError={() => setBackdropFailed(true)}
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
          />
        ) : title.posterFile && !posterFailed ? (
          <img
            src={`poster://titles/${title.id}?v=${encodeURIComponent(title.updatedAt)}`}
            alt=""
            onError={() => setPosterFailed(true)}
            className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
          />
        ) : null}
        <div
          className={`absolute inset-0 -z-10 bg-gradient-to-r ${
            showBackdrop
              ? 'from-[var(--color-panel)] via-[var(--color-panel)]/85 to-[var(--color-panel)]/20'
              : 'from-[var(--color-panel)] via-[var(--color-panel)]/95 to-[var(--color-panel)]/70'
          }`}
        />
        {showBackdrop ? (
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-[var(--color-panel)] to-transparent" />
        ) : null}
        <div className="grid gap-8 sm:grid-cols-[190px_1fr]">
          <div>
            {title.posterFile && !posterFailed ? (
              <img
                src={`poster://titles/${title.id}?v=${encodeURIComponent(title.updatedAt)}`}
                alt={`${title.title} poster`}
                onError={() => setPosterFailed(true)}
                className="aspect-[2/3] w-full rounded-[var(--radius-card)] object-cover shadow-xl"
              />
            ) : (
              <PosterPlaceholder title={title.title} />
            )}
          </div>
          <div className="flex flex-col justify-end">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent-light)]">
                  {title.type === 'series' ? 'TV Series' : 'Movie'}
                </p>
                <h1 className="mt-2 font-display text-4xl text-[var(--color-text-primary)] sm:text-5xl">
                  {title.title}
                </h1>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  {title.year ?? 'Year unknown'}
                  {title.runtimeMinutes ? ` · ${title.runtimeMinutes} min` : ''}
                </p>
              </div>{' '}
              <button
                type="button"
                onClick={() => void window.api.titles.toggleFavorite(title.id).then(setTitle)}
                className="text-[var(--color-favorite)]"
              >
                <Heart size={24} fill={title.isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {title.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-[var(--color-accent-muted)] px-3 py-1 text-xs text-[var(--color-accent-light)]"
                >
                  {genre}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
              <span className="rounded-full bg-[var(--color-panel-elevated)] px-3 py-1 capitalize">
                {title.status}
              </span>
              {title.rating ? <RatingStars value={title.rating} /> : null}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={primaryAction}
                className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white"
              >
                <PrimaryIcon size={17} /> {primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingEntry(undefined)
                  setDialog('past')
                }}
                className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
              >
                Log a past watch
              </button>
              <button
                type="button"
                onClick={() => navigate(`/title/${title.id}/edit`)}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
              >
                <Edit3 size={15} /> Edit
              </button>
              {title.tmdbId === null ? (
                <button
                  type="button"
                  onClick={() => setLinking(true)}
                  className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
                >
                  <Link2 size={15} /> Link to TMDB
                </button>
              ) : null}
              <button
                type="button"
                onClick={changeStatus}
                className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
              >
                {title.status === 'dropped' ? 'Resume' : 'Drop'}
              </button>
              <button
                type="button"
                onClick={deleteTitle}
                aria-label="Delete title"
                className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-3 text-[var(--color-favorite)]"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionPanel title="Overview">
          <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
            {title.overview ||
              'No synopsis yet. This is a space for the story itself, and the reasons it found you.'}
          </p>
          {latest?.reasonNote ? (
            <div className="mt-5 border-l-2 border-[var(--color-accent)] pl-4">
              <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                Why I watched it
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{latest.reasonNote}</p>
            </div>
          ) : null}
          {latest ? (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                Latest mood change
              </span>
              <MoodChange before={latest.moodBeforeScore} after={latest.moodAfterScore} />
            </div>
          ) : null}
        </SectionPanel>
        <SectionPanel title="My Reflection">
          {latest?.thoughts ||
          latest?.lessons ||
          latest?.favoriteCharacter ||
          latest?.favoriteScene ||
          latest?.favoriteQuote ? (
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
              {latest.thoughts ? (
                <p>
                  <strong>Thoughts:</strong> {latest.thoughts}
                </p>
              ) : null}
              {latest.lessons ? (
                <p>
                  <strong>Lessons:</strong> {latest.lessons}
                </p>
              ) : null}
              {latest.favoriteCharacter ? (
                <p>
                  <strong>Favorite character:</strong> {latest.favoriteCharacter}
                </p>
              ) : null}
              {latest.favoriteScene ? (
                <p>
                  <strong>Favorite scene:</strong> {latest.favoriteScene}
                </p>
              ) : null}
              {latest.favoriteQuote ? (
                <p>
                  <strong>Favorite quote:</strong> “{latest.favoriteQuote}”
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Your reflections will live here after you finish a watch.
            </p>
          )}
        </SectionPanel>
      </div>
      {credits && (credits.cast.length || credits.directors.length || credits.creators.length) ? (
        <SectionPanel title="Cast & crew" className="mt-6">
          {credits.directors.length || credits.creators.length ? (
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-muted)]">
                {credits.directors.length
                  ? credits.directors.length > 1
                    ? 'Directors'
                    : 'Director'
                  : 'Created by'}
                :
              </span>{' '}
              {(credits.directors.length ? credits.directors : credits.creators).join(', ')}
            </p>
          ) : null}
          {credits.cast.length ? (
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {credits.cast.map((member) => (
                <li key={`${member.order}-${member.name}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {member.name}
                  </p>
                  {member.character ? (
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {member.character}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionPanel>
      ) : null}
      {title.type === 'series' && activeEntry ? (
        <SectionPanel title="Series progress" className="mt-6">
          <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>
              {activeEntry.episodesWatched} / {title.totalEpisodes ?? '?'} episodes
            </span>
            <button
              type="button"
              onClick={() =>
                void window.api.watchEntries.incrementEpisodes(activeEntry.id).then(load)
              }
              className="text-[var(--color-accent-light)]"
            >
              +1 episode
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-panel-elevated)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{
                width: `${title.totalEpisodes ? Math.min(100, (activeEntry.episodesWatched / title.totalEpisodes) * 100) : 0}%`
              }}
            />
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Watch history" className="mt-6">
        <div className="space-y-4">
          {entries.length ? (
            entries.map((entry) => (
              <WatchEntryCard
                key={entry.id}
                entry={entry}
                totalEpisodes={title.totalEpisodes}
                onEdit={() => {
                  setEditingEntry(entry)
                  setDialog(entry.completedAt ? 'edit' : 'finish')
                }}
                onDelete={() => {
                  if (window.confirm('Delete this memory?'))
                    void window.api.watchEntries.delete(entry.id).then(load)
                }}
                onIncrement={() =>
                  void window.api.watchEntries.incrementEpisodes(entry.id).then(load)
                }
                onToggleHighlight={() =>
                  void window.api.watchEntries.setHighlight(entry.id, !entry.isHighlight).then(load)
                }
              />
            ))
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No watch memories yet. Start when this story finds you.
            </p>
          )}
        </div>
      </SectionPanel>
      {linking ? (
        <LinkTmdbDialog
          title={title}
          onClose={() => setLinking(false)}
          onLinked={(linked) => {
            setLinking(false)
            setTitle(linked)
            setPosterFailed(false)
            setBackdropFailed(false)
            load()
          }}
        />
      ) : null}
      {dialog ? (
        <WatchEntryDialog
          mode={dialog}
          titleId={title.id}
          entry={editingEntry}
          totalEpisodes={title.totalEpisodes}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            load()
          }}
        />
      ) : null}
    </div>
  )
}

export default TitleDetails
