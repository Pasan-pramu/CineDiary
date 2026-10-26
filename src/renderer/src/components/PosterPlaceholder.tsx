interface PosterPlaceholderProps {
  title?: string
  className?: string
}

function PosterPlaceholder({
  title = 'Your story',
  className = ''
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
      className={`flex aspect-[2/3] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-panel-elevated)] to-[var(--color-background)] p-4 text-center shadow-inner ${className}`}
    >
      <div>
        <p className="font-display text-4xl text-white/90">{initials || '?'}</p>
        <p className="mt-2 line-clamp-2 text-xs font-medium text-white/60">{title}</p>
      </div>
    </div>
  )
}

export default PosterPlaceholder
