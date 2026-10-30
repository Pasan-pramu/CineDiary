import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TimelineItem } from '../../../../shared/types'
import MoodChange from '../MoodChange'
import PosterPlaceholder from '../PosterPlaceholder'
import SectionPanel from '../SectionPanel'
import ViewAllLink from './ViewAllLink'
import { formatWatchDate } from '../../format'

function TimelineRow({ item }: { item: TimelineItem }): React.JSX.Element {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  return (
    <li className="relative flex gap-4 pl-24">
      <span className="absolute left-0 top-3 w-16 text-sm font-semibold text-[var(--color-accent-light)]">
        {formatWatchDate(item.date, item.datePrecision, true)}
      </span>
      {/* The dot sits on the vertical line drawn by the list. */}
      <span className="absolute left-[71px] top-4 size-2.5 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-panel)]" />
      <button
        type="button"
        onClick={() => void navigate(`/title/${item.title.id}`)}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-[var(--radius-card)] p-2 text-left transition hover:bg-[var(--color-panel-elevated)]"
      >
        <div className="w-10 shrink-0 overflow-hidden rounded-lg">
          {item.title.posterFile && !failed ? (
            <img
              src={`poster://titles/${item.title.id}`}
              alt=""
              onError={() => setFailed(true)}
              className="aspect-[2/3] w-full object-cover"
            />
          ) : (
            <PosterPlaceholder title={item.title.title} compact />
          )}
        </div>
        <div className="w-40 min-w-0 shrink-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {item.title.title}
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            {item.title.type === 'series' ? 'TV Series' : 'Movie'}
            {item.title.genres[0] ? ` · ${item.title.genres[0]}` : ''}
          </p>
        </div>
        <div className="w-20 shrink-0">
          {item.completed ? (
            <MoodChange before={item.moodBeforeScore} after={item.moodAfterScore} />
          ) : (
            <span className="rounded-full bg-[var(--color-accent-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent-light)]">
              Watching
            </span>
          )}
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-sm italic text-[var(--color-text-secondary)] md:block">
          {item.excerpt ? `“${item.excerpt}”` : ''}
        </p>
      </button>
    </li>
  )
}

/** The last few watches, newest first, on a small vertical timeline. */
function MiniTimeline({ items }: { items: TimelineItem[] }): React.JSX.Element {
  return (
    <SectionPanel title="Watch history timeline" action={<ViewAllLink to="/journal" />}>
      {items.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
          <CalendarDays size={20} className="text-[var(--color-accent-light)]" />
          Your watches will line up here as you log them.
        </div>
      ) : (
        <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[75px] before:top-4 before:w-0.5 before:bg-[var(--color-panel-elevated)]">
          {items.map((item) => (
            <TimelineRow key={item.entryId} item={item} />
          ))}
        </ol>
      )}
    </SectionPanel>
  )
}

export default MiniTimeline
