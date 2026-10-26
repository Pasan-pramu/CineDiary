import { Home } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function Dashboard(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Your story starts here"
      title="Welcome to CineDiary"
      description="Your dashboard will bring together the movies, series, moods, and memories that make your watching life yours."
      icon={Home}
    />
  )
}

export default Dashboard
