import { Heart, Star } from 'lucide-react'
import { useState } from 'react'
import type { Title } from '../../../shared/types'
import PosterPlaceholder from './PosterPlaceholder'

interface PosterCardProps {
  title: Title
  onClick?: () => void
  /** Replaces the "Movie · 2014" line, e.g. with the date you watched it. */
  meta?: React.ReactNode
  /** Extra line under the meta, e.g. a progress bar. */
  footer?: React.ReactNode
}

function PosterCard({ title, onClick, meta, footer }: PosterCardProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[var(--radius-card)] text-left"
    >
      <div className="relative overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-poster)] transition duration-200 group-hover:translate-y-[var(--lift-hover)] group-focus-visible:translate-y-[var(--lift-hover)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-visible:translate-y-0">
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
        {title.isFavorite ? (
          <Heart
            size={17}
            fill="currentColor"
            className="absolute right-3 top-3 text-[var(--color-favorite-icon)]"
          />
        ) : null}
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold text-[var(--color-text-primary)]">
        {title.title}
      </h3>
      <p className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="min-w-0 truncate">
          {meta ??
            `${title.type === 'series' ? 'TV Series' : 'Movie'}${title.year ? ` · ${title.year}` : ''}`}
        </span>
        {title.rating ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[var(--color-rating)]">
            <Star size={12} fill="var(--color-rating-icon)" />
            {title.rating}
          </span>
        ) : null}
      </p>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </button>
  )
}

export default PosterCard
