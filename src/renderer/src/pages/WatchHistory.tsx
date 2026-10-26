import { Clock3 } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function WatchHistory(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Your timeline"
      title="No watch history yet"
      description="Every watch entry will become part of a timeline that captures not just what you watched, but how it made you feel."
      icon={Clock3}
    />
  )
}

export default WatchHistory
