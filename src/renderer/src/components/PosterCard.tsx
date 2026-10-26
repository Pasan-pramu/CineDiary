import { Heart, Star } from 'lucide-react'
import type { Title } from '../../../shared/types'
import PosterPlaceholder from './PosterPlaceholder'

interface PosterCardProps {
  title: Title
}

function PosterCard({ title }: PosterCardProps): React.JSX.Element {
  return (
    <article className="group w-40">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] shadow-lg shadow-black/20 transition duration-200 group-hover:-translate-y-1">
        {title.posterFile ? (
          <img src={`poster://${title.id}`} alt="" className="aspect-[2/3] w-full object-cover" />
        ) : (
          <PosterPlaceholder title={title.title} />
        )}
        {title.isFavorite ? (
          <Heart
            size={17}
            fill="currentColor"
            className="absolute right-3 top-3 text-[var(--color-favorite)]"
          />
        ) : null}
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold text-[var(--color-text-primary)]">
        {title.title}
      </h3>
      <p className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span>{title.type === 'series' ? 'TV Series' : 'Movie'}</span>
        {title.year ? <span>· {title.year}</span> : null}
        {title.rating ? (
          <span className="ml-auto flex items-center gap-1 text-[var(--color-rating)]">
            <Star size={12} fill="currentColor" />
            {title.rating}
          </span>
        ) : null}
      </p>
    </article>
  )
}

export default PosterCard
