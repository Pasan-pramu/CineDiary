import type { MoodKey } from '../../../shared/constants'
import { useMoods } from '../hooks/useMoods'

interface MoodBadgeProps {
  mood: MoodKey
  score?: number | null
}

/** Emoji + label (+ score). Works for hidden and renamed moods; an unknown key shows as is. */
function MoodBadge({ mood, score }: MoodBadgeProps): React.JSX.Element {
  const found = useMoods().find((item) => item.key === mood)
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
      {found?.emoji ?? '•'} {found?.label ?? mood}
      {score ? ` · ${score}/10` : ''}
    </span>
  )
}

export default MoodBadge
