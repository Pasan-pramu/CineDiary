import { Flag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chapterColorVar } from '../../../../shared/timeline'
import type { LifePeriod, TimelineEntry } from '../../../../shared/types'
import HighlightToggle from '../HighlightToggle'
import MoodBadge from '../MoodBadge'
import MoodChange from '../MoodChange'
import PosterPlaceholder from '../PosterPlaceholder'
import { formatShortDay } from '../../format'

interface TimelineItemProps {
  entry: TimelineEntry
  chapters: Map<number, LifePeriod>
  onToggleHighlight: () => void
}

/** One watch on the timeline. Highlights glow; chapters show as colored side bars. */
function TimelineItem({
  entry,
  chapters,
  onToggleHighlight
}: TimelineItemProps): React.JSX.Element {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const open = (): void => {
    void navigate(`/title/${entry.title.id}`)
  }
  const entryChapters = entry.chapterIds.flatMap((id) => chapters.get(id) ?? [])

  return (
    <li className="relative pl-24">
      <span className="absolute left-0 top-5 w-16 text-right text-sm font-semibold text-[var(--color-accent-light)]">
        {formatShortDay(entry.date)}
      </span>
      {/* The dot sits on the vertical line drawn by the month list. */}
      <span
        className={`absolute left-[76px] top-6 rounded-full ring-4 ring-[var(--color-background)] ${
          entry.isHighlight
            ? 'size-3.5 -translate-x-[3px] bg-[var(--color-highlight)]'
            : 'size-2.5 bg-[var(--color-accent)]'
        }`}
      />
      <article
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter') open()
        }}
        className={`relative flex cursor-pointer gap-4 overflow-hidden rounded-[var(--radius-card)] border lift p-3 pl-5 ${
          entry.isHighlight
            ? 'border-[var(--color-highlight)] bg-[var(--color-highlight-surface)] py-4 shadow-[0_0_28px_var(--color-highlight-glow)]'
            : 'border-[var(--color-border)] bg-[var(--color-panel)] hover:bg-[var(--color-panel-elevated)]'
        }`}
      >
        {entryChapters.length ? (
          <span className="absolute inset-y-2 left-1.5 flex gap-0.5" aria-hidden="true">
            {entryChapters.map((chapter) => (
              <span
                key={chapter.id}
                title={chapter.name}
                className="w-1 rounded-full"
                style={{ background: chapterColorVar(chapter.color) }}
              />
            ))}
          </span>
        ) : null}
        <div
          className={`shrink-0 overflow-hidden rounded-lg ${entry.isHighlight ? 'w-16' : 'w-12'}`}
        >
          {entry.title.posterFile && !failed ? (
            <img
              src={`poster://titles/${entry.title.id}`}
              alt=""
              onError={() => setFailed(true)}
              className="aspect-[2/3] w-full object-cover"
            />
          ) : (
            <PosterPlaceholder title={entry.title.title} compact />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              className={`min-w-0 flex-1 truncate font-semibold text-[var(--color-text-primary)] ${entry.isHighlight ? 'text-base' : 'text-sm'}`}
            >
              {entry.title.title}
            </h3>
            {entry.isHighlight ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--color-highlight)_12%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-highlight)]">
                Highlight
              </span>
            ) : null}
            <HighlightToggle
              isHighlight={entry.isHighlight}
              onToggle={onToggleHighlight}
              className="-my-2 -mr-1"
            />
          </div>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {entry.title.type === 'series' ? 'TV Series' : 'Movie'}
            {entry.isRewatch ? ' · Rewatch' : ''}
            {entry.reasons.length ? ` · ${entry.reasons.join(', ')}` : ''}
            {entry.completed ? '' : ' · Watching'}
          </p>
          {entry.moodBefore || entry.moodAfter ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {entry.moodBefore ? <MoodBadge mood={entry.moodBefore} /> : null}
              {entry.moodBefore && entry.moodAfter ? (
                <span className="text-[var(--color-text-muted)]">→</span>
              ) : null}
              {entry.moodAfter ? <MoodBadge mood={entry.moodAfter} /> : null}
              <MoodChange before={entry.moodBeforeScore} after={entry.moodAfterScore} />
            </div>
          ) : null}
          {entry.note ? (
            <p className="mt-1.5 truncate text-sm italic text-[var(--color-text-secondary)]">
              “{entry.note}”
            </p>
          ) : null}
          {entry.milestones.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.milestones.map((milestone) => (
                <span
                  key={milestone.label}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--color-milestone-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-milestone)]"
                >
                  <Flag size={11} /> {milestone.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  )
}

export default TimelineItem
