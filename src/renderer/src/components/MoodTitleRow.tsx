import { useState } from 'react'
import type { TitleMoodChange } from '../../../shared/types'
import { changeColor, formatChange, watchCount } from './insightSentences'
import PosterPlaceholder from './PosterPlaceholder'

interface MoodTitleRowProps {
  item: TitleMoodChange
  onClick: () => void
}

/** A title with its average mood change and how many watches that average is based on. */
function MoodTitleRow({ item, onClick }: MoodTitleRowProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] p-2 text-left transition hover:bg-[var(--color-panel-elevated)]"
    >
      <div className="w-10 shrink-0 overflow-hidden rounded-lg">
        {item.posterFile && !failed ? (
          <img
            src={`poster://titles/${item.titleId}`}
            alt=""
            onError={() => setFailed(true)}
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <PosterPlaceholder title={item.title} compact />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {item.title}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {item.type === 'series' ? 'TV Series' : 'Movie'} · based on {watchCount(item.n)}
        </p>
      </div>
      <span
        className="text-base font-semibold tabular-nums"
        style={{ color: changeColor(item.averageChange) }}
      >
        {formatChange(item.averageChange)}
      </span>
    </button>
  )
}

export default MoodTitleRow
