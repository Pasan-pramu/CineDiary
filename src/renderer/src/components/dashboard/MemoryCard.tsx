import { History } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WatchMemory } from '../../../../shared/types'
import MoodBadge from '../MoodBadge'
import MoodChange from '../MoodChange'
import PosterPlaceholder from '../PosterPlaceholder'
import SectionPanel from '../SectionPanel'
import { formatMonth } from '../../format'

function memoryLabel(memory: WatchMemory): string {
  if (memory.kind === 'on_this_day') return `On this day in ${memory.completedAt.slice(0, 4)}`
  // "October 2019", or just "2019" when only the year is remembered.
  return memory.datePrecision === 'year'
    ? memory.completedAt.slice(0, 4)
    : formatMonth(memory.completedAt)
}

/** "From your past": one watch memory, the same one all day. */
function MemoryCard({ memory }: { memory: WatchMemory | null }): React.JSX.Element {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  return (
    <SectionPanel title="From your past">
      {memory === null ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
          <History size={20} className="text-[var(--color-accent-light)]" />
          Watches older than a month will resurface here as memories.
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void navigate(`/title/${memory.title.id}`)}
          className="flex w-full gap-5 rounded-[var(--radius-card)] text-left"
        >
          <div className="w-24 shrink-0 overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-poster)]">
            {memory.title.posterFile && !failed ? (
              <img
                src={`poster://titles/${memory.title.id}`}
                alt=""
                onError={() => setFailed(true)}
                className="aspect-[2/3] w-full object-cover"
              />
            ) : (
              <PosterPlaceholder title={memory.title.title} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-light)]">
              {memoryLabel(memory)}
            </p>
            <h3 className="mt-1 text-xl font-semibold leading-tight text-[var(--color-text-primary)]">
              {memory.title.title}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {memory.moodBefore ? <MoodBadge mood={memory.moodBefore} /> : null}
              {memory.moodBefore && memory.moodAfter ? (
                <span className="text-[var(--color-text-muted)]">→</span>
              ) : null}
              {memory.moodAfter ? <MoodBadge mood={memory.moodAfter} /> : null}
              <MoodChange before={memory.moodBeforeScore} after={memory.moodAfterScore} />
            </div>
            {memory.excerpt ? (
              <p className="mt-3 line-clamp-3 text-sm italic leading-6 text-[var(--color-text-secondary)]">
                “{memory.excerpt}”
              </p>
            ) : null}
          </div>
        </button>
      )}
    </SectionPanel>
  )
}

export default MemoryCard
