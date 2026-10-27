import { Star } from 'lucide-react'

interface HighlightToggleProps {
  isHighlight: boolean
  onToggle: () => void
  className?: string
}

/** ☆ / ★ button that marks a watch as a highlight on My Timeline. */
function HighlightToggle({
  isHighlight,
  onToggle,
  className = ''
}: HighlightToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={isHighlight}
      aria-label={isHighlight ? 'Remove highlight' : 'Mark as a highlight'}
      title={isHighlight ? 'Highlight — click to remove' : 'Mark as a highlight on your timeline'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`transition hover:scale-110 motion-reduce:hover:scale-100 ${
        isHighlight
          ? 'text-[var(--color-highlight)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-highlight)]'
      } ${className}`}
    >
      <Star size={17} fill={isHighlight ? 'currentColor' : 'none'} />
    </button>
  )
}

export default HighlightToggle
