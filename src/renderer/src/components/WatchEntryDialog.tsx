import { X } from 'lucide-react'
import { useState } from 'react'
import { getLocalDate, suggestedScore, type MoodKey } from '../../../shared/constants'
import { storedWatchDate, type DatePrecision } from '../../../shared/watchDate'
import FinishedDateField from './FinishedDateField'
import type { WatchEntry } from '../../../shared/types'
import { pickable, refreshMoods, useReasons } from '../hooks/useMoods'
import InlineAddForm from './InlineAddForm'
import MoodPicker from './MoodPicker'
import RatingStars from './RatingStars'
import Dialog from './Dialog'
import { logError, showToast, userMessage } from '../errors'
import ReasonChip from './ReasonChip'
import ScorePicker from './ScorePicker'

type DialogMode = 'start' | 'finish' | 'past' | 'edit'

interface WatchEntryDialogProps {
  mode: DialogMode
  titleId: number
  entry?: WatchEntry
  totalEpisodes?: number | null
  /** The title's personal rating, shown in the stars (it belongs to the title, not the watch). */
  initialRating?: number | null
  /** Pre-fills a new watch (e.g. from Discover); everything stays editable. */
  initialMoodBefore?: MoodKey | null
  initialReasonKeys?: string[]
  /** Replaces the line under the heading (e.g. "Saved as watching since today…"). */
  intro?: string
  /** The close button's label: "Skip" when the watch is already saved (adding a title). */
  cancelLabel?: string
  /** Shows "Save & add another past movie": saves, then calls this instead of onSaved. */
  onSaveAndAddAnother?: () => void
  onClose: () => void
  onSaved: () => void
}

function WatchEntryDialog({
  mode,
  titleId,
  entry,
  totalEpisodes,
  initialRating,
  initialMoodBefore,
  initialReasonKeys,
  intro,
  cancelLabel = 'Cancel',
  onSaveAndAddAnother,
  onClose,
  onSaved
}: WatchEntryDialogProps): React.JSX.Element {
  // A remembered finished date (partial ones as their first day); "I don't remember" starts the
  // date pickers at today, in case you change your mind.
  const known = entry?.completedAt && entry.datePrecision !== 'unknown' ? entry : null
  const [datePrecision, setDatePrecision] = useState<DatePrecision>(
    entry?.completedAt ? entry.datePrecision : 'day'
  )
  const [completedAt, setCompletedAt] = useState(known?.completedAt ?? getLocalDate())
  const [startedAt, setStartedAt] = useState(
    entry && entry.datePrecision === 'day'
      ? entry.startedAt
      : (known?.completedAt ?? getLocalDate())
  )
  // Editing a watch that's still in progress keeps it in progress (no completed date, no "after").
  const inProgress = mode === 'start' || (mode === 'edit' && entry?.completedAt === null)
  const initialBefore = entry?.moodBefore ?? initialMoodBefore ?? undefined
  const [moodBefore, setMoodBefore] = useState<MoodKey | undefined>(initialBefore)
  const [moodBeforeScore, setMoodBeforeScore] = useState<number | null>(
    entry ? entry.moodBeforeScore : suggestedScore(initialBefore)
  )
  const [moodAfter, setMoodAfter] = useState<MoodKey | undefined>(entry?.moodAfter ?? undefined)
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(entry?.moodAfterScore ?? null)
  // Picking a mood pre-selects its suggested score until you choose a score yourself.
  const [beforeScoreChosen, setBeforeScoreChosen] = useState(entry?.moodBeforeScore != null)
  const [afterScoreChosen, setAfterScoreChosen] = useState(entry?.moodAfterScore != null)
  const [rating, setRating] = useState<number | null>(initialRating ?? null)
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

  const submit = async (then: () => void): Promise<void> => {
    const input = {
      titleId,
      startedAt,
      // Only an exact date has its own start; main stores partial dates as their first day.
      completedAt:
        inProgress || datePrecision === 'unknown'
          ? undefined
          : storedWatchDate(completedAt, datePrecision),
      datePrecision: inProgress ? undefined : datePrecision,
      isRewatch: entry?.isRewatch,
      episodesWatched,
      moodBefore,
      moodBeforeScore: moodBeforeScore ?? undefined,
      reasonIds: selectedReasons,
      reasonNote: reasonNote || undefined,
      moodAfter: inProgress ? undefined : moodAfter,
      moodAfterScore: inProgress ? undefined : (moodAfterScore ?? undefined),
      thoughts: thoughts || undefined,
      lessons: lessons || undefined,
      favoriteCharacter: favoriteCharacter || undefined,
      favoriteScene: favoriteScene || undefined,
      favoriteQuote: favoriteQuote || undefined,
      // Only forms that show the stars change the rating (null clears it).
      rating: inProgress ? undefined : rating
    }
    try {
      // With an entry (Edit, or the watch saved with a new title) the form updates that watch.
      if (mode === 'finish') await window.api.watchEntries.finish({ ...input, id: entry?.id ?? 0 })
      else if (entry) await window.api.watchEntries.update({ ...input, id: entry.id })
      else if (mode === 'start') await window.api.watchEntries.start(input)
      else await window.api.watchEntries.create(input)
      then()
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
                {intro ??
                  (mode === 'edit' && inProgress
                    ? 'This watch stays in progress. Use Finish & reflect when you’re done.'
                    : 'The essentials first. Every feeling is optional.')}
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
            {!inProgress ? (
              <FinishedDateField
                precision={datePrecision}
                date={completedAt}
                onPrecisionChange={setDatePrecision}
                onDateChange={setCompletedAt}
              />
            ) : null}
            {/* Only an exact finish date has a separate start date. */}
            {inProgress || datePrecision === 'day' ? (
              <label
                className={`block text-sm text-[var(--color-text-secondary)] ${inProgress ? '' : 'mt-4'}`}
              >
                Started
                <input
                  type="date"
                  value={startedAt}
                  onChange={(event) => setStartedAt(event.target.value)}
                  className="field mt-2 w-full sm:w-56"
                />
              </label>
            ) : null}
            <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
              How did you feel before? <Optional />
            </label>
            <div className="mt-2">
              <MoodPicker
                value={moodBefore}
                onChange={(mood) => {
                  setMoodBefore(mood)
                  if (!beforeScoreChosen) setMoodBeforeScore(suggestedScore(mood))
                }}
              />
            </div>
            <ScoreField
              label="Mood score before"
              value={moodBeforeScore}
              onChange={(score) => {
                setMoodBeforeScore(score)
                setBeforeScoreChosen(score !== null)
              }}
            />
            <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
              Why did you watch it? <Optional />
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
              A note about why <Optional />
              <input
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                className="field mt-2 w-full"
                placeholder="What brought you to this story?"
              />
            </label>
            {!inProgress ? (
              <>
                <label className="mt-5 block text-sm text-[var(--color-text-secondary)]">
                  How did you feel after? <Optional />
                </label>
                <div className="mt-2">
                  <MoodPicker
                    value={moodAfter}
                    onChange={(mood) => {
                      setMoodAfter(mood)
                      if (!afterScoreChosen) setMoodAfterScore(suggestedScore(mood))
                    }}
                  />
                </div>
                <ScoreField
                  label="Mood score after"
                  value={moodAfterScore}
                  onChange={(score) => {
                    setMoodAfterScore(score)
                    setAfterScoreChosen(score !== null)
                  }}
                />
                <div className="mt-5">
                  <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
                    Personal rating <Optional />
                  </p>
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
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
            <button type="button" onClick={close} className="btn btn-secondary">
              {cancelLabel}
            </button>
            {onSaveAndAddAnother ? (
              <button
                type="button"
                onClick={() => void submit(onSaveAndAddAnother)}
                className="btn btn-secondary"
              >
                Save &amp; add another past movie
              </button>
            ) : null}
            <button type="button" onClick={() => void submit(onSaved)} className="btn btn-primary">
              Save memory
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}

function Optional(): React.JSX.Element {
  return <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
}

/** "Mood score (optional)" with its 1–10 buttons. */
function ScoreField({
  label,
  value,
  onChange
}: {
  label: string
  value: number | null
  onChange: (score: number | null) => void
}): React.JSX.Element {
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
        Mood score{' '}
        <span className="text-xs text-[var(--color-text-muted)]">
          (optional · 1 very low, 10 great)
        </span>
      </p>
      <ScorePicker label={label} value={value} onChange={onChange} />
    </div>
  )
}

export default WatchEntryDialog
