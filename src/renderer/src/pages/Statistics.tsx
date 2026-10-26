import { BarChart3 } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function Statistics(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Patterns in your watching"
      title="Your statistics will appear here"
      description="As you log watches, CineDiary will reveal your favorite genres, mood changes, and viewing patterns."
      icon={BarChart3}
    />
  )
}

export default Statistics
