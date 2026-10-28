import { useEffect, useState } from 'react'
import { getLocalDate, type MoodKey } from '../../../shared/constants'
import type { Reason, WatchEntry } from '../../../shared/types'
import MoodPicker from './MoodPicker'
import RatingStars from './RatingStars'
import ReasonChip from './ReasonChip'
import { useEscape } from '../hooks/useEscape'

type DialogMode = 'start' | 'finish' | 'past' | 'edit'

interface WatchEntryDialogProps {
  mode: DialogMode
  titleId: number
  entry?: WatchEntry
  totalEpisodes?: number | null
  /** Pre-fills a new watch (e.g. from Discover); everything stays editable. */
  initialMoodBefore?: MoodKey | null
  initialReasonKeys?: string[]
  onClose: () => void
  onSaved: () => void
}

function WatchEntryDialog({
  mode,
  titleId,
  entry,
  totalEpisodes,
  initialMoodBefore,
  initialReasonKeys,
  onClose,
  onSaved
}: WatchEntryDialogProps): React.JSX.Element {
  useEscape(onClose)
  const [startedAt, setStartedAt] = useState(entry?.startedAt ?? getLocalDate())
  const [completedAt, setCompletedAt] = useState(entry?.completedAt ?? getLocalDate())
  const [moodBefore, setMoodBefore] = useState<MoodKey | undefined>(
    entry?.moodBefore ?? initialMoodBefore ?? undefined
  )
  const [moodBeforeScore, setMoodBeforeScore] = useState(entry?.moodBeforeScore?.toString() ?? '')
  const [moodAfter, setMoodAfter] = useState<MoodKey | undefined>(entry?.moodAfter ?? undefined)
  const [moodAfterScore, setMoodAfterScore] = useState(entry?.moodAfterScore?.toString() ?? '')
  const [rating, setRating] = useState<number | null>(null)
  const [reasonNote, setReasonNote] = useState(entry?.reasonNote ?? '')
  const [thoughts, setThoughts] = useState(entry?.thoughts ?? '')
  const [lessons, setLessons] = useState(entry?.lessons ?? '')
  const [favoriteCharacter, setFavoriteCharacter] = useState(entry?.favoriteCharacter ?? '')
  const [favoriteScene, setFavoriteScene] = useState(entry?.favoriteScene ?? '')
  const [favoriteQuote, setFavoriteQuote] = useState(entry?.favoriteQuote ?? '')
  const [episodesWatched, setEpisodesWatched] = useState(entry?.episodesWatched ?? 0)
  const [reasons, setReasons] = useState<Reason[]>([])
  const [selectedReasons, setSelectedReasons] = useState<number[]>(
    entry?.reasons.map((reason) => reason.id) ?? []
  )
  const [more, setMore] = useState(
    Boolean(
      entry?.thoughts ||
      entry?.lessons ||
      entry?.favoriteCharacter ||
      entry?.favoriteScene ||
      entry?.favoriteQuote
    )
  )
  const [error, setError] = useState('')

  useEffect(() => {
    void window.api.watchEntries
      .listReasons()
      .then((loaded) => {
        setReasons(loaded)
        // Reasons are known by key in the pre-fill; select the matching ones once loaded.
        if (!entry && initialReasonKeys?.length) {
          setSelectedReasons(
            loaded
              .filter((reason) => initialReasonKeys.includes(reason.key))
              .map((reason) => reason.id)
          )
        }
      })
      .catch(() => setError('Reasons could not be loaded.'))
    // Only on open: the pre-fill must not overwrite choices made in the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (): Promise<void> => {
    const input = {
      titleId,
      startedAt,
      completedAt: mode === 'start' ? undefined : completedAt,
      isRewatch: entry?.isRewatch,
      episodesWatched,
      moodBefore,
      moodBeforeScore: moodBeforeScore ? Number(moodBeforeScore) : undefined,
      reasonIds: selectedReasons,
      reasonNote: reasonNote || undefined,
      moodAfter: mode === 'start' ? undefined : moodAfter,
      moodAfterScore: mode === 'start' || !moodAfterScore ? undefined : Number(moodAfterScore),
      thoughts: thoughts || undefined,
      lessons: lessons || undefined,
      favoriteCharacter: favoriteCharacter || undefined,
      favoriteScene: favoriteScene || undefined,
      favoriteQuote: favoriteQuote || undefined,
      rating: rating ?? undefined
    }
    try {
      if (mode === 'start') await window.api.watchEntries.start(input)
      else if (mode === 'finish')
        await window.api.watchEntries.finish({ ...input, id: entry?.id ?? 0 })
      else if (mode === 'edit')
        await window.api.watchEntries.update({ ...input, id: entry?.id ?? 0 })
      else await window.api.watchEntries.create(input)
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The watch entry could not be saved.')
    }
  }

  const addCustomReason = async (): Promise<void> => {
    const label = window.prompt('New reason')
    if (!label?.trim()) return
    try {
      const reason = await window.api.watchEntries.createReason(label)
      setReasons((current) => [...current, reason])
      setSelectedReasons((current) => [...current, reason.id])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The reason could not be created.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-[var(--shadow-raised)]">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-display text-3xl text-[var(--color-text-primary)]">
              {mode === 'start'
                ? 'Start watching'
                : mode === 'finish'
                  ? 'Finish & reflect'
                  : mode === 'past'
                    ? 'Log a past watch'
                    : 'Edit memory'}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              The essentials first. Add more only if you feel like it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            ×
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-[var(--color-text-secondary)]">
            Started
            <input
              type="date"
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
              className="mt-2 w-full"
            />
          </label>
          {mode !== 'start' ? (
            <label className="text-sm text-[var(--color-text-secondary)]">
              Completed
              <input
                type="date"
                value={completedAt}
                onChange={(event) => setCompletedAt(event.target.value)}
                className="mt-2 w-full"
              />
            </label>
          ) : null}
        </div>
        <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
          How did you feel before?
        </label>
        <div className="mt-2">
          <MoodPicker value={moodBefore} onChange={setMoodBefore} />
        </div>
        <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
          Mood score <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
          <input
            type="number"
            min="1"
            max="10"
            value={moodBeforeScore}
            onChange={(event) => setMoodBeforeScore(event.target.value)}
            className="mt-2 w-24"
          />
        </label>
        <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
          Why did you watch it?
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <ReasonChip
              key={reason.id}
              label={reason.label}
              selected={selectedReasons.includes(reason.id)}
              onClick={() =>
                setSelectedReasons((current) =>
                  current.includes(reason.id)
                    ? current.filter((id) => id !== reason.id)
                    : [...current, reason.id]
                )
              }
            />
          ))}
          <ReasonChip label="+ Add custom reason" onClick={() => void addCustomReason()} />
        </div>
        <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
          A note about why
          <input
            value={reasonNote}
            onChange={(event) => setReasonNote(event.target.value)}
            className="mt-2 w-full"
            placeholder="What brought you to this story?"
          />
        </label>
        {mode !== 'start' ? (
          <>
            <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
              How did you feel after?
            </label>
            <div className="mt-2">
              <MoodPicker value={moodAfter} onChange={setMoodAfter} />
            </div>
            <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
              After score{' '}
              <input
                type="number"
                min="1"
                max="10"
                value={moodAfterScore}
                onChange={(event) => setMoodAfterScore(event.target.value)}
                className="ml-2 w-20"
              />
            </label>
            <div className="mt-5">
              <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Personal rating</p>
              <RatingStars value={rating} onChange={setRating} />
            </div>
            {totalEpisodes ? (
              <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
                Episodes watched
                <input
                  type="number"
                  min="0"
                  max={totalEpisodes}
                  value={episodesWatched}
                  onChange={(event) =>
                    setEpisodesWatched(Math.min(totalEpisodes, Number(event.target.value)))
                  }
                  className="mt-2 w-32"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => setMore((value) => !value)}
              className="mt-6 text-sm font-semibold text-[var(--color-accent-light)]"
            >
              {more ? 'Hide reflection' : 'Add more reflection'}
            </button>
            {more ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <textarea
                  value={thoughts}
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="Thoughts"
                  className="sm:col-span-2"
                />
                <textarea
                  value={lessons}
                  onChange={(event) => setLessons(event.target.value)}
                  placeholder="Lessons"
                />
                <input
                  value={favoriteCharacter}
                  onChange={(event) => setFavoriteCharacter(event.target.value)}
                  placeholder="Favorite character"
                />
                <input
                  value={favoriteScene}
                  onChange={(event) => setFavoriteScene(event.target.value)}
                  placeholder="Favorite scene"
                />
                <input
                  value={favoriteQuote}
                  onChange={(event) => setFavoriteQuote(event.target.value)}
                  placeholder="Favorite quote"
                />
              </div>
            ) : null}
          </>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[var(--color-favorite)]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-on-accent)]"
          >
            Save memory
          </button>
        </div>
      </div>
    </div>
  )
}

export default WatchEntryDialog
