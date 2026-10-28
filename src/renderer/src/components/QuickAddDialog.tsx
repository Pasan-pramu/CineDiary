import { ArrowRight, Check, ImagePlus, Play, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEscape } from '../hooks/useEscape'
import type { PreparedPoster, Title, TitleStatus, TitleType, TmdbPick } from '../../../shared/types'
import { createTitleSchema } from '../../../shared/validation'
import PosterPlaceholder from './PosterPlaceholder'
import TmdbSearch from './TmdbSearch'

// Quick Add (Ctrl+N): the essentials only, saved without leaving the page you're on.
// The full form at /add is one click away ("More details…").

const STATUSES: Array<{ value: TitleStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' }
]

const fieldClass =
  'h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]'

function QuickAddDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TitleType>('movie')
  const [status, setStatus] = useState<TitleStatus>('planned')
  const [poster, setPoster] = useState<PreparedPoster | null>(null)
  /** The TMDB result the fields came from: its details are saved too. */
  const [tmdb, setTmdb] = useState<TmdbPick | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Title | null>(null)
  useEscape(onClose)

  const applyPick = (pick: TmdbPick): void => {
    setTmdb(pick)
    setTitle(pick.draft.title)
    setType(pick.draft.type)
    setPoster(pick.poster)
    setError('')
  }

  const changeType = (next: TitleType): void => {
    setType(next)
    // A TMDB match is for one type; switching type makes it a manual title again.
    if (tmdb && tmdb.draft.type !== next) {
      setTmdb(null)
      setPoster(null)
    }
  }

  const pickPoster = async (): Promise<void> => {
    try {
      const picked = await window.api.posters.pick()
      if (picked) setPoster(picked)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That poster could not be added.')
    }
  }

  const save = async (): Promise<void> => {
    const draft = tmdb?.draft
    const parsed = createTitleSchema.safeParse({
      type,
      title,
      status,
      isFavorite: false,
      genres: draft?.genres ?? [],
      tempPosterFile: poster?.tempFile,
      ...(draft
        ? {
            tmdbId: draft.tmdbId,
            imdbId: draft.imdbId ?? undefined,
            originalTitle: draft.originalTitle ?? undefined,
            year: draft.year ?? undefined,
            overview: draft.overview ?? undefined,
            country: draft.country ?? undefined,
            language: draft.language ?? undefined,
            runtimeMinutes: draft.runtimeMinutes ?? undefined,
            totalSeasons: type === 'series' ? (draft.totalSeasons ?? undefined) : undefined,
            totalEpisodes: type === 'series' ? (draft.totalEpisodes ?? undefined) : undefined
          }
        : {})
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the title.')
      return
    }
    setSaving(true)
    setError('')
    try {
      setSaved(await window.api.titles.create(parsed.data))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The title could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const moreDetails = `/add?${new URLSearchParams({ title, type, status }).toString()}`
  const duplicateId = tmdb?.existingTitleId ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--color-overlay)] p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-raised)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2
            id="quick-add-title"
            className="font-display text-3xl text-[var(--color-text-primary)]"
          >
            {saved ? 'Added' : 'Quick add'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        {saved ? (
          <div className="flex gap-5">
            <div className="w-24 shrink-0 overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-poster)]">
              {saved.posterFile ? (
                <img
                  src={`poster://titles/${saved.id}`}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <PosterPlaceholder title={saved.title} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm text-[var(--color-positive)]">
                <Check size={16} /> In your collection
              </p>
              <p className="mt-1 font-display text-2xl text-[var(--color-text-primary)]">
                {saved.title}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => navigate(`/title/${saved.id}`)}
                  className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text-primary)]"
                >
                  Open details
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/title/${saved.id}`, { state: { start: true } })}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
                >
                  <Play size={15} /> Start watching
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaved(null)
                    setTitle('')
                    setPoster(null)
                    setTmdb(null)
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm font-semibold text-[var(--color-accent-light)] hover:underline"
                >
                  <Plus size={15} /> Add another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!saving && !duplicateId) void save()
            }}
          >
            <TmdbSearch onPick={applyPick} bare />
            <div className="mt-5 flex gap-4 border-t border-[var(--color-border)] pt-5">
              <button
                type="button"
                onClick={() => void pickPoster()}
                title={poster ? 'Change poster' : 'Choose a poster (optional)'}
                className="group relative w-24 shrink-0 overflow-hidden rounded-[var(--radius-card)]"
              >
                {poster ? (
                  <img
                    src={poster.previewDataUrl}
                    alt=""
                    className="aspect-[2/3] w-full object-cover"
                  />
                ) : (
                  <PosterPlaceholder title={title || 'Poster'} compact />
                )}
                <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-[var(--color-image-scrim)] py-1 text-[11px] font-semibold text-[var(--color-on-image)]">
                  <ImagePlus size={12} /> {poster ? 'Change' : 'Poster'}
                </span>
              </button>
              <div className="min-w-0 flex-1 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
                    Title
                  </span>
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      setError('')
                    }}
                    placeholder="What are you adding?"
                    className={fieldClass}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <div
                    role="radiogroup"
                    aria-label="Type"
                    className="flex rounded-[var(--radius-control)] border border-[var(--color-border)] p-0.5"
                  >
                    {(['movie', 'series'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={type === value}
                        onClick={() => changeType(value)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          type === value
                            ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {value === 'movie' ? 'Movie' : 'Series'}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as TitleStatus)}
                    className="h-10 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-2 text-sm text-[var(--color-text-primary)]"
                  >
                    {STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {duplicateId ? (
              <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--color-rating)]/10 px-4 py-3 text-sm text-[var(--color-rating)]">
                This title is already in your collection.{' '}
                <Link to={`/title/${duplicateId}`} className="font-semibold underline">
                  Open it
                </Link>
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--color-danger-surface)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex items-center gap-3">
              <Link
                to={moreDetails}
                className="mr-auto inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-accent-light)] hover:underline"
              >
                More details <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || Boolean(duplicateId)}
                className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default QuickAddDialog
