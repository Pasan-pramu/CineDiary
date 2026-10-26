import { BookOpen } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function Library(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Your collection"
      title="Your library is waiting"
      description="Add your first movie or series to start building a personal collection of stories."
      icon={BookOpen}
    />
  )
}

export default Library
