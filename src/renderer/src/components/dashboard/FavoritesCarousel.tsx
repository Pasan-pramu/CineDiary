import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { Title } from '../../../../shared/types'
import PosterCard from '../PosterCard'
import SectionPanel from '../SectionPanel'
import ViewAllLink from './ViewAllLink'

const arrowClass =
  'flex size-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-panel-elevated)] hover:text-white'

function FavoritesCarousel({ favorites }: { favorites: Title[] }): React.JSX.Element {
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()
  const track = useRef<HTMLDivElement>(null)

  const scroll = (direction: 1 | -1): void => {
    const element = track.current
    if (!element) return
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: reducedMotion ? 'auto' : 'smooth'
    })
  }

  return (
    <SectionPanel
      title="Favorite movies & series"
      action={
        <div className="flex items-center gap-2">
          {favorites.length > 2 ? (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => scroll(-1)}
                className={arrowClass}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => scroll(1)}
                className={arrowClass}
              >
                <ChevronRight size={16} />
              </button>
            </>
          ) : null}
          <ViewAllLink to="/collection?favorite=true" />
        </div>
      }
    >
      {favorites.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 text-center text-sm leading-6 text-[var(--color-text-muted)]">
          <Heart size={20} className="text-[var(--color-favorite)]" />
          Tap the heart on a title to keep your all-time favorites here.
        </div>
      ) : (
        <div
          ref={track}
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-color:var(--color-panel-elevated)_transparent] [scrollbar-width:thin]"
        >
          {favorites.map((title) => (
            <div key={title.id} className="w-28 shrink-0 snap-start">
              <PosterCard title={title} onClick={() => void navigate(`/title/${title.id}`)} />
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  )
}

export default FavoritesCarousel
