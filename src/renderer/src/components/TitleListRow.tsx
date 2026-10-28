import { Heart, Star } from 'lucide-react'
import { useState } from 'react'
import { STATUS_LABELS } from '../../../shared/constants'
import type { Title } from '../../../shared/types'
import PosterPlaceholder from './PosterPlaceholder'

interface TitleListRowProps {
  title: Title
  onClick: () => void
}

function TitleListRow({ title, onClick }: TitleListRowProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="lift flex w-full items-center gap-4 rounded-[var(--radius-card)] border border-transparent bg-[var(--color-panel)] p-3 text-left hover:border-[var(--color-border)] hover:bg-[var(--color-panel-elevated)]"
    >
      <div className="w-12 shrink-0 overflow-hidden rounded-lg">
        {title.posterFile && !failed ? (
          <img
            src={`poster://titles/${title.id}`}
            alt=""
            onError={() => setFailed(true)}
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <PosterPlaceholder title={title.title} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {title.title}
        </h3>
        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
          {title.type === 'series' ? 'TV Series' : 'Movie'}
          {title.year ? ` · ${title.year}` : ''}
          {title.genres.length ? ` · ${title.genres.join(', ')}` : ''}
        </p>
      </div>
      <span className="chip chip-selected hidden sm:inline-flex">
        {STATUS_LABELS[title.status]}
      </span>
      {title.rating ? (
        <span className="flex items-center gap-1 text-xs text-[var(--color-rating)]">
          <Star size={13} fill="var(--color-rating-icon)" />
          {title.rating}
        </span>
      ) : null}
      {title.isFavorite ? (
        <Heart size={16} fill="currentColor" className="text-[var(--color-favorite-icon)]" />
      ) : null}
    </button>
  )
}

export default TitleListRow
