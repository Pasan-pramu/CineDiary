import { ArrowRight, Check, ImagePlus, Play, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FIRST_WATCH_INTRO, answerToTitle, type WatchedAnswer } from '../../../shared/constants'
import type { PreparedPoster, Title, TitleType, TmdbPick, WatchEntry } from '../../../shared/types'
import { createTitleSchema } from '../../../shared/validation'
import Dialog from './Dialog'
import PosterPlaceholder from './PosterPlaceholder'
import TmdbSearch from './TmdbSearch'
import WatchedQuestion from './WatchedQuestion'
import WatchEntryDialog from './WatchEntryDialog'

// Quick Add (Ctrl+N): the essentials only, saved without leaving the page you're on.
// The full form at /add is one click away ("More details…"). Watching now / Already watched
// save a watch with the title and open the watch form on it (on top of this dialog).

function QuickAddDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TitleType>('movie')
  const [answer, setAnswer] = useState<WatchedAnswer>('not_yet')
  /** The watch saved with the title, while its form is open. */
  const [firstWatch, setFirstWatch] = useState<WatchEntry | null>(null)
  const [poster, setPoster] = useState<PreparedPoster | null>(null)
  /** The TMDB result the fields came from: its details are saved too. */
  const [tmdb, setTmdb] = useState<TmdbPick | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Title | null>(null)

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
      status: answerToTitle(answer).status,
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
      const { firstWatch: first } = answerToTitle(answer)
      const created = await window.api.titles.create({ ...parsed.data, firstWatch: first })
      setSaved(created)
      if (first) {
        const [entry] = await window.api.watchEntries.list(created.id)
        if (entry) setFirstWatch(entry)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The title could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const startOver = (nextAnswer: WatchedAnswer): void => {
    setSaved(null)
    setFirstWatch(null)
    setTitle('')
    setPoster(null)
    setTmdb(null)
    setAnswer(nextAnswer)
  }

  const moreDetails = `/add?${new URLSearchParams({ title, type, watched: answer }).toString()}`
  const duplicateId = tmdb?.existingTitleId ?? null

  return (
    <>
      <Dialog
        onClose={onClose}
        labelledBy="quick-add-title"
        className="max-w-xl"
        position="top"
        closeOnBackdrop
      >
        {(close) => (
          <div className="overflow-y-auto p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2
                id="quick-add-title"
                className="font-display text-2xl text-[var(--color-text-primary)]"
              >
                {saved ? 'Added' : 'Quick add'}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                title="Close (Esc)"
                className="btn btn-ghost btn-icon btn-sm -mr-2"
              >
                <X size={18} />
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
                  <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                    {saved.title}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => navigate(`/title/${saved.id}`)}
                      className="btn btn-secondary"
                    >
                      Open details
                    </button>
                    {answer === 'not_yet' || answer === 'dropped' ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/title/${saved.id}`, { state: { start: true } })}
                        className="btn btn-primary"
                      >
                        <Play size={15} /> Start watching
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startOver('not_yet')}
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
                        alt="Chosen poster"
                        className="aspect-[2/3] w-full object-cover"
                      />
                    ) : (
                      <PosterPlaceholder title={title || 'Poster'} compact />
                    )}
                    <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-[var(--color-image-scrim)] py-1 text-xs font-semibold text-[var(--color-on-image)]">
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
                        className="field w-full"
                      />
                    </label>
                    <div>
                      <div role="radiogroup" aria-label="Type" className="segmented">
                        {(['movie', 'series'] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={type === value}
                            onClick={() => changeType(value)}
                            className="segment"
                          >
                            {value === 'movie' ? 'Movie' : 'Series'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <WatchedQuestion value={answer} onChange={setAnswer} />
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
                  <button type="button" onClick={close} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || Boolean(duplicateId)}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
      {saved && firstWatch ? (
        <WatchEntryDialog
          mode={firstWatch.completedAt === null ? 'start' : 'past'}
          titleId={saved.id}
          entry={firstWatch}
          totalEpisodes={saved.totalEpisodes}
          initialRating={saved.rating}
          intro={FIRST_WATCH_INTRO[firstWatch.completedAt === null ? 'watching' : 'watched']}
          cancelLabel="Skip"
          onSaveAndAddAnother={
            firstWatch.completedAt === null ? undefined : () => startOver('watched')
          }
          onClose={() => setFirstWatch(null)}
          onSaved={() => setFirstWatch(null)}
        />
      ) : null}
    </>
  )
}

export default QuickAddDialog
