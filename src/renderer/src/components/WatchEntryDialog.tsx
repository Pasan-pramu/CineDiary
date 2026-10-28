import { X } from 'lucide-react'
import { useState } from 'react'
import { getLocalDate, type MoodKey } from '../../../shared/constants'
import type { WatchEntry } from '../../../shared/types'
import { pickable, refreshMoods, useReasons } from '../hooks/useMoods'
import InlineAddForm from './InlineAddForm'
import MoodPicker from './MoodPicker'
import RatingStars from './RatingStars'
import Dialog from './Dialog'
import { logError, showToast, userMessage } from '../errors'
import ReasonChip from './ReasonChip'

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
  const reasons = useReasons()
  const [addingReason, setAddingReason] = useState(false)
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

  // Reasons are known by key in a pre-fill (Discover); select them once the list has loaded.
  const [prefilled, setPrefilled] = useState(Boolean(entry) || !initialReasonKeys?.length)
  if (!prefilled && reasons.length) {
    setPrefilled(true)
    setSelectedReasons(
      reasons.filter((reason) => initialReasonKeys?.includes(reason.key)).map((reason) => reason.id)
    )
  }

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
      // The dialog stays open with everything you entered.
      logError('renderer', caught)
      showToast(`Couldn’t save this memory. ${userMessage(caught)}`)
    }
  }

  const addReason = async (label: string): Promise<void> => {
    const reason = await window.api.reasons.create(label)
    await refreshMoods()
    setSelectedReasons((current) => [...current, reason.id])
    setAddingReason(false)
  }

  return (
    <Dialog onClose={onClose} labelledBy="watch-dialog-title" className="max-w-2xl">
      {(close) => (
        <>
          {/* Header and buttons stay put; only the form scrolls. */}
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <h2
                id="watch-dialog-title"
                className="font-display text-2xl text-[var(--color-text-primary)]"
              >
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
              onClick={close}
              aria-label="Close"
              title="Close (Esc)"
              className="btn btn-ghost btn-icon btn-sm -mr-2"
            >
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[var(--color-text-secondary)]">
                Started
                <input
                  type="date"
                  value={startedAt}
                  onChange={(event) => setStartedAt(event.target.value)}
                  className="field mt-2 w-full"
                />
              </label>
              {mode !== 'start' ? (
                <label className="text-sm text-[var(--color-text-secondary)]">
                  Completed
                  <input
                    type="date"
                    value={completedAt}
                    onChange={(event) => setCompletedAt(event.target.value)}
                    className="field mt-2 w-full"
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
                className="field mt-2 block w-24"
              />
            </label>
            <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
              Why did you watch it?
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {pickable(reasons, (reason) => selectedReasons.includes(reason.id)).map((reason) => (
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
              {addingReason ? null : (
                <ReasonChip label="+ New reason" onClick={() => setAddingReason(true)} />
              )}
            </div>
            {addingReason ? (
              <InlineAddForm
                kind="reason"
                onCancel={() => setAddingReason(false)}
                onSave={({ label }) => addReason(label)}
              />
            ) : null}
            <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
              A note about why
              <input
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                className="field mt-2 w-full"
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
                  Mood score{' '}
                  <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={moodAfterScore}
                    onChange={(event) => setMoodAfterScore(event.target.value)}
                    className="field mt-2 block w-24"
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
                      className="field mt-2 block w-32"
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => setMore((value) => !value)}
                  aria-expanded={more}
                  className="link mt-6"
                >
                  {more ? 'Hide reflection' : 'Add more reflection'}
                </button>
                {more ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <textarea
                      value={thoughts}
                      onChange={(event) => setThoughts(event.target.value)}
                      placeholder="Thoughts"
                      aria-label="Thoughts"
                      className="field sm:col-span-2"
                    />
                    <textarea
                      value={lessons}
                      onChange={(event) => setLessons(event.target.value)}
                      placeholder="Lessons"
                      aria-label="Lessons"
                      className="field"
                    />
                    <input
                      value={favoriteCharacter}
                      onChange={(event) => setFavoriteCharacter(event.target.value)}
                      placeholder="Favorite character"
                      aria-label="Favorite character"
                      className="field"
                    />
                    <input
                      value={favoriteScene}
                      onChange={(event) => setFavoriteScene(event.target.value)}
                      placeholder="Favorite scene"
                      aria-label="Favorite scene"
                      className="field"
                    />
                    <input
                      value={favoriteQuote}
                      onChange={(event) => setFavoriteQuote(event.target.value)}
                      placeholder="Favorite quote"
                      aria-label="Favorite quote"
                      className="field"
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
            <button type="button" onClick={close} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={() => void submit()} className="btn btn-primary">
              Save memory
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}

export default WatchEntryDialog
