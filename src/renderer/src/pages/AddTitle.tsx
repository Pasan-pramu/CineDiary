import { Plus } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function AddTitle(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Add something new"
      title="Add a title"
      description="The title form will make it easy to add a movie or series, poster, genres, and the details you want to remember."
      icon={Plus}
    />
  )
}

export default AddTitle
