interface PosterPlaceholderProps {
  title?: string
  className?: string
  /** Initials only, for small thumbnails. */
  compact?: boolean
}

function PosterPlaceholder({
  title = 'Your story',
  className = '',
  compact = false
}: PosterPlaceholderProps): React.JSX.Element {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  return (
    <div
      className={`flex aspect-[2/3] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-placeholder-from)] via-[var(--color-placeholder-via)] to-[var(--color-placeholder-to)] text-center shadow-inner ${compact ? 'p-1' : 'p-4'} ${className}`}
    >
      {compact ? (
        <p className="font-display text-sm text-[var(--color-placeholder-text)]">
          {initials || '?'}
        </p>
      ) : (
        <div>
          <p className="font-display text-4xl text-[var(--color-placeholder-text)]">
            {initials || '?'}
          </p>
          <p className="mt-2 line-clamp-2 text-xs font-medium text-[var(--color-placeholder-subtext)]">
            {title}
          </p>
        </div>
      )}
    </div>
  )
}

export default PosterPlaceholder
