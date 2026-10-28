import { Star } from 'lucide-react'

interface RatingStarsProps {
  value: number | null
  onChange?: (value: number) => void
}

function RatingStars({ value, onChange }: RatingStarsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }, (_, index) => {
        const rating = index + 1
        return (
          <button
            key={rating}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(rating)}
            aria-label={`${rating} out of 10`}
          >
            <Star
              size={18}
              fill={value && rating <= value ? 'var(--color-rating-icon)' : 'none'}
              className={
                value && rating <= value
                  ? 'text-[var(--color-rating)]'
                  : 'text-[var(--color-text-muted)]'
              }
            />
          </button>
        )
      })}
    </div>
  )
}

export default RatingStars
