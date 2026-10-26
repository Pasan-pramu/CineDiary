import { MOODS, type MoodKey } from '../../../shared/constants'

interface MoodBadgeProps {
  mood: MoodKey
  score?: number | null
}

function MoodBadge({ mood, score }: MoodBadgeProps): React.JSX.Element {
  const found = MOODS.find((item) => item.key === mood)
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
      {found?.emoji} {found?.label}
      {score ? ` · ${score}/10` : ''}
    </span>
  )
}

export default MoodBadge
