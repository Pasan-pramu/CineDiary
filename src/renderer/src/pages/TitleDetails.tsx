import { Clapperboard } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function TitleDetails(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="A story worth remembering"
      title="Title details"
      description="Details, watch entries, moods, and reflections for each title will live here."
      icon={Clapperboard}
    />
  )
}

export default TitleDetails
