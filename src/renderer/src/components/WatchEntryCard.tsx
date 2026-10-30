import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import type { WatchEntry } from '../../../shared/types'
import HighlightToggle from './HighlightToggle'
import MoodBadge from './MoodBadge'
import MoodChange from './MoodChange'
import ReasonChip from './ReasonChip'
import { formatWatchDates } from '../format'

interface WatchEntryCardProps {
  entry: WatchEntry
  totalEpisodes?: number | null
  onEdit: () => void
  /** Shown while the watch is in progress (editing keeps it in progress). */
  onFinish?: () => void
  onDelete: () => void
  onIncrement: () => void
  onToggleHighlight: () => void
}

function WatchEntryCard({
  entry,
  totalEpisodes,
  onEdit,
  onFinish,
  onDelete,
  onIncrement,
  onToggleHighlight
}: WatchEntryCardProps): React.JSX.Element {
  return (
    <article
      className={`rounded-[var(--radius-card)] border p-5 ${
        entry.isHighlight
          ? 'border-[var(--color-highlight)] bg-[var(--color-highlight-surface)] shadow-[0_0_24px_var(--color-highlight-glow)]'
          : 'border-[var(--color-border)] bg-[var(--color-panel)]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text-secondary)]">
              {entry.isRewatch ? 'Rewatch' : 'Watch'}
            </span>{' '}
            · {formatWatchDates(entry.startedAt, entry.completedAt, entry.datePrecision)}
            {entry.completedAt ? '' : ' · In progress'}
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            {entry.moodBefore ? (
              <MoodBadge mood={entry.moodBefore} score={entry.moodBeforeScore} />
            ) : null}
            {entry.moodAfter ? (
              <MoodBadge mood={entry.moodAfter} score={entry.moodAfterScore} />
            ) : null}
            <MoodChange before={entry.moodBeforeScore} after={entry.moodAfterScore} />
          </div>
        </div>
        <div className="-mr-2 -mt-2 flex items-center gap-1">
          <HighlightToggle isHighlight={entry.isHighlight} onToggle={onToggleHighlight} />
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit memory"
            title="Edit memory"
            className="btn btn-ghost btn-icon btn-sm"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete memory"
            title="Delete memory"
            className="btn btn-ghost btn-icon btn-sm !text-[var(--color-danger)]"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {entry.reasons.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.reasons.map((reason) => (
            <ReasonChip key={reason.id} label={reason.label} />
          ))}
        </div>
      ) : null}
      {entry.reasonNote ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">“{entry.reasonNote}”</p>
      ) : null}
      <div className="grid gap-3 text-sm text-[var(--color-text-muted)] empty:hidden sm:grid-cols-2 [&:not(:empty)]:mt-4">
        {entry.thoughts ? (
          <p>
            <strong className="text-[var(--color-text-secondary)]">Thoughts:</strong>{' '}
            {entry.thoughts}
          </p>
        ) : null}
        {entry.lessons ? (
          <p>
            <strong className="text-[var(--color-text-secondary)]">Lessons:</strong> {entry.lessons}
          </p>
        ) : null}
        {entry.favoriteCharacter ? (
          <p>
            <strong className="text-[var(--color-text-secondary)]">Favorite character:</strong>{' '}
            {entry.favoriteCharacter}
          </p>
        ) : null}
        {entry.favoriteScene ? (
          <p>
            <strong className="text-[var(--color-text-secondary)]">Favorite scene:</strong>{' '}
            {entry.favoriteScene}
          </p>
        ) : null}
        {entry.favoriteQuote ? (
          <p>
            <strong className="text-[var(--color-text-secondary)]">Favorite quote:</strong> “
            {entry.favoriteQuote}”
          </p>
        ) : null}
      </div>
      {!entry.completedAt && onFinish ? (
        <button type="button" onClick={onFinish} className="btn btn-secondary btn-sm mt-4">
          <Check size={15} /> Finish &amp; reflect
        </button>
      ) : null}
      {!entry.completedAt && totalEpisodes ? (
        <div className="mt-5 flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--color-panel-elevated)] p-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {entry.episodesWatched} / {totalEpisodes} episodes
          </span>
          <button type="button" onClick={onIncrement} className="link">
            <Plus size={15} /> 1 episode
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default WatchEntryCard
